import { describe, it, expect, vi, beforeEach } from 'vitest';
import { estimateOpenRouterCostUsd } from './perplexity.service';

// Mock axios pour piloter la réponse OpenRouter.
let postImpl: () => Promise<unknown>;
vi.mock('axios', () => ({
  default: { post: () => postImpl() },
}));

// Cache transparent : exécute le fetcher, capture les clés stockées.
const storedKeys: string[] = [];
vi.mock('@/lib/cache/redis', () => ({
  withCache: async (k: string, f: () => Promise<unknown>) => {
    const data = await f();
    storedKeys.push(k);
    return { data, fromCache: false };
  },
  buildCacheKey: (...p: string[]) => p.join(':'),
}));

vi.mock('@/lib/utils/logger', () => ({
  logger: { api: () => {}, error: () => {}, warn: () => {} },
}));

const VALID_JSON = JSON.stringify({
  whereToStay: ['Centre historique'],
  zonesToAvoid: ['Quartier X la nuit'],
  commonScams: ['Faux taxis'],
  classicMistakes: ['Vouloir tout faire en 3 jours'],
  localCustoms: ['Pourboire usuel'],
  fieldTips: ["SIM locale à l'aéroport"],
});

function chat(content: string) {
  return { data: { choices: [{ message: { content } }] } };
}

beforeEach(() => {
  vi.resetModules();
  process.env.OPENROUTER_API_KEY = 'sk-or-test-key-1234567890';
  storedKeys.length = 0;
});

async function load() {
  return import('./perplexity.service');
}

describe('getPerplexityCountryFacts', () => {
  it('parse un JSON valide et retourne source live', async () => {
    postImpl = () => Promise.resolve(chat(VALID_JSON));
    const { getPerplexityCountryFacts } = await load();
    const res = await getPerplexityCountryFacts('PT', 'Portugal');
    expect(res.source).toBe('live');
    expect(res.data.whereToStay).toContain('Centre historique');
    expect(res.data.commonScams.length).toBeGreaterThan(0);
  });

  it('extrait le JSON même encapsulé dans du markdown', async () => {
    postImpl = () => Promise.resolve(chat('```json\n' + VALID_JSON + '\n```'));
    const { getPerplexityCountryFacts } = await load();
    const res = await getPerplexityCountryFacts('PT', 'Portugal');
    expect(res.source).toBe('live');
    expect(res.data.zonesToAvoid.length).toBeGreaterThan(0);
  });

  it('retourne un fallback (listes vides) si la clé est absente', async () => {
    delete process.env.OPENROUTER_API_KEY;
    const { getPerplexityCountryFacts } = await load();
    const res = await getPerplexityCountryFacts('PT', 'Portugal');
    expect(res.source).toBe('fallback');
    expect(res.data.whereToStay).toEqual([]);
  });

  it('retourne un fallback si OpenRouter échoue (réseau)', async () => {
    postImpl = () => Promise.reject(new Error('network'));
    const { getPerplexityCountryFacts } = await load();
    const res = await getPerplexityCountryFacts('PT', 'Portugal');
    expect(res.source).toBe('fallback');
    expect(res.data.commonScams).toEqual([]);
  });

  it('retourne un fallback si la réponse est malformée (Zod rejette)', async () => {
    postImpl = () => Promise.resolve(chat('{"whereToStay": "pas un tableau"}'));
    const { getPerplexityCountryFacts } = await load();
    const res = await getPerplexityCountryFacts('PT', 'Portugal');
    expect(res.source).toBe('fallback');
  });

  it('utilise une clé de cache versionnée country-facts ... guide-v1', async () => {
    postImpl = () => Promise.resolve(chat(VALID_JSON));
    const { getPerplexityCountryFacts } = await load();
    await getPerplexityCountryFacts('PT', 'Portugal');
    expect(storedKeys.some((k) => k.includes('country-facts') && k.includes('guide-v1'))).toBe(true);
  });

  // ── AI-COST-001 — logs usage présents quand OpenRouter répond avec usage ──────

  it('ne plante pas si usage est absent dans la réponse OpenRouter', async () => {
    // La réponse n'a pas de champ usage → usageMissing: true dans le log, pas d'exception.
    postImpl = () => Promise.resolve({ data: { choices: [{ message: { content: VALID_JSON } }] } });
    const { getPerplexityCountryFacts } = await load();
    await expect(getPerplexityCountryFacts('PT', 'Portugal')).resolves.not.toThrow();
  });

  it('ne plante pas si usage est présent dans la réponse OpenRouter', async () => {
    postImpl = () => Promise.resolve({
      data: {
        choices: [{ message: { content: VALID_JSON } }],
        usage: { prompt_tokens: 300, completion_tokens: 400, total_tokens: 700 },
        model: 'perplexity/sonar-pro',
      },
    });
    const { getPerplexityCountryFacts } = await load();
    await expect(getPerplexityCountryFacts('PT', 'Portugal')).resolves.not.toThrow();
  });
});

// ── AI-COST-001 — tests helper coût OpenRouter ────────────────────────────────

describe('estimateOpenRouterCostUsd (AI-COST-001)', () => {
  it('calcule correctement pour 0 tokens', () => {
    expect(estimateOpenRouterCostUsd(0, 0)).toBe(0);
  });

  it('calcule correctement input seul', () => {
    // 1000 input @ $3/M = $0.003
    expect(estimateOpenRouterCostUsd(1000, 0)).toBeCloseTo(0.003, 5);
  });

  it('calcule correctement output seul', () => {
    // 500 completion @ $15/M = $0.0075
    expect(estimateOpenRouterCostUsd(0, 500)).toBeCloseTo(0.0075, 5);
  });

  it('calcule correctement input + output', () => {
    // 200 prompt @ $3/M + 200 completion @ $15/M = $0.0006 + $0.003 = $0.0036
    expect(estimateOpenRouterCostUsd(200, 200)).toBeCloseTo(0.0036, 5);
  });

  it('arrondit à 6 décimales maximum', () => {
    const cost = estimateOpenRouterCostUsd(1, 1);
    const decimals = cost.toString().split('.')[1]?.length ?? 0;
    expect(decimals).toBeLessThanOrEqual(6);
  });

  it('retourne toujours un nombre positif ou nul (jamais négatif)', () => {
    expect(estimateOpenRouterCostUsd(0, 0)).toBeGreaterThanOrEqual(0);
    expect(estimateOpenRouterCostUsd(1000, 500)).toBeGreaterThan(0);
  });
});
