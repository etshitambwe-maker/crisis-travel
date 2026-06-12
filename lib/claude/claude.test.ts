import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Pilote le comportement de client.messages.create().
let createImpl: () => Promise<unknown>;
let capturedClientOpts: Record<string, unknown> | undefined;

vi.mock('@anthropic-ai/sdk', () => ({
  default: class {
    constructor(opts: Record<string, unknown>) {
      capturedClientOpts = opts;
    }
    messages = { create: () => createImpl() };
  },
}));

// Capture les clés de cache construites — permet de prouver qu'une clé inclut le profil.
const capturedCacheKeys: string[] = [];
vi.mock('@/lib/cache/redis', () => ({
  withCache: async (_k: string, f: () => Promise<unknown>) => ({ data: await f(), fromCache: false }),
  buildCacheKey: (...p: string[]) => { const k = p.join(':'); capturedCacheKeys.push(k); return k; },
}));

const scores = [
  { countryCode: 'PT', country: 'Portugal', total: 80, budget: { value: 70, details: { currencyVariation: 0 } } },
  { countryCode: 'GE', country: 'Géorgie', total: 78, budget: { value: 85, details: { currencyVariation: 0 } } },
] as never[];

beforeEach(() => {
  vi.resetModules();
  process.env.ANTHROPIC_API_KEY = 'sk-test';
  capturedClientOpts = undefined;
  capturedCacheKeys.length = 0;
});

afterEach(() => {
  vi.useRealTimers();
});

async function load() {
  return import('./claude.service');
}

describe('detectOpportunities — hard timeout strict (GOAL-034)', () => {
  it('configure le client Anthropic avec maxRetries: 0', async () => {
    createImpl = () => Promise.resolve({ content: [{ text: '[]' }] });
    await load(); // l'import construit le client
    expect(capturedClientOpts).toBeDefined();
    expect(capturedClientOpts!.maxRetries).toBe(0);
  });

  it('renvoie [] sans attendre quand Claude pend au-delà du budget (8s)', async () => {
    vi.useFakeTimers();
    // Claude ne résout jamais (simule un appel bloqué ~20s+)
    createImpl = () => new Promise(() => {});
    const { detectOpportunities } = await load();

    const p = detectOpportunities(scores, 1500);
    // Avance le temps jusqu'au hard timeout
    await vi.advanceTimersByTimeAsync(8000);
    const result = await p;
    expect(result).toEqual([]);
  });

  it('renvoie les opportunités quand Claude répond vite', async () => {
    createImpl = () => Promise.resolve({
      content: [{ text: '[{"countryCode":"GE","type":"currency","explanation":"x","estimatedSaving":300}]' }],
    });
    const { detectOpportunities } = await load();
    const result = await detectOpportunities(scores, 1500);
    expect(result).toHaveLength(1);
    expect(result[0].countryCode).toBe('GE');
  });

  it('renvoie [] si Claude throw (erreur réseau)', async () => {
    createImpl = () => Promise.reject(new Error('Request timed out'));
    const { detectOpportunities } = await load();
    const result = await detectOpportunities(scores, 1500);
    expect(result).toEqual([]);
  });

  it('renvoie [] immédiatement sans clé API (pas d’appel)', async () => {
    delete process.env.ANTHROPIC_API_KEY;
    createImpl = () => Promise.reject(new Error('should not be called'));
    const { detectOpportunities } = await load();
    const result = await detectOpportunities(scores, 1500);
    expect(result).toEqual([]);
  });
});

// ── ANALYZE-PROFILE-001 — la clé cache narrative distingue les profils ──────────

describe('generateDestinationNarrative — clé cache profile-aware (ANALYZE-PROFILE-001)', () => {
  const score = {
    country: 'Cameroun', countryCode: 'CM', total: 55,
    security:     { value: 50, source: 'live', confidence: 'medium', details: {} },
    geopolitical: { value: 55, source: 'live', confidence: 'medium', details: { trend: 'stable' } },
    budget:       { value: 60, source: 'live', confidence: 'medium', details: { currencyVariation: 0, mealCheap: 8, hotelAvg: 60 } },
    practicality: { value: 45, source: 'live', confidence: 'medium', details: {} },
    status: 'possible', confidence: 'medium', calculatedAt: new Date().toISOString(),
  } as never;

  const mk = (travelType: string) =>
    ({ departureCountry: 'FR', budget: 1500, duration: 7, period: 'flexible', travelType, mode: 'standard' }) as never;

  it('la clé narrative inclut le travelType', async () => {
    createImpl = () => Promise.resolve({ content: [{ text: 'Analyse famille.' }] });
    const { generateDestinationNarrative } = await load();
    await generateDestinationNarrative(score, mk('family'));
    const narrativeKey = capturedCacheKeys.find((k) => k.includes('claude-narrative'));
    expect(narrativeKey).toBeDefined();
    expect(narrativeKey).toContain('family');
  });

  it('solo et family produisent des clés narrative DIFFÉRENTES (pas de partage cache)', async () => {
    createImpl = () => Promise.resolve({ content: [{ text: 'x' }] });
    const { generateDestinationNarrative } = await load();

    capturedCacheKeys.length = 0;
    await generateDestinationNarrative(score, mk('solo'));
    const soloKey = capturedCacheKeys.find((k) => k.includes('claude-narrative'));

    capturedCacheKeys.length = 0;
    await generateDestinationNarrative(score, mk('family'));
    const familyKey = capturedCacheKeys.find((k) => k.includes('claude-narrative'));

    expect(soloKey).toBeDefined();
    expect(familyKey).toBeDefined();
    expect(soloKey).not.toBe(familyKey);
  });
});
