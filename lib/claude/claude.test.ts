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

// Cache non utilisé par detectOpportunities, mais importé par le module — on neutralise.
vi.mock('@/lib/cache/redis', () => ({
  withCache: async (_k: string, f: () => Promise<unknown>) => ({ data: await f(), fromCache: false }),
  buildCacheKey: (...p: string[]) => p.join(':'),
}));

const scores = [
  { countryCode: 'PT', country: 'Portugal', total: 80, budget: { value: 70, details: { currencyVariation: 0 } } },
  { countryCode: 'GE', country: 'Géorgie', total: 78, budget: { value: 85, details: { currencyVariation: 0 } } },
] as never[];

beforeEach(() => {
  vi.resetModules();
  process.env.ANTHROPIC_API_KEY = 'sk-test';
  capturedClientOpts = undefined;
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
