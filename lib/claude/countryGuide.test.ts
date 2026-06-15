import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

let createImpl: () => Promise<unknown>;
let capturedPrompt = '';
let abortCount = 0;

vi.mock('@anthropic-ai/sdk', () => ({
  default: class {
    messages = {
      create: () => createImpl(),
      stream: (opts: { messages: { content: string }[] }) => {
        capturedPrompt = opts.messages[0].content;
        return { finalMessage: () => createImpl(), abort: () => { abortCount++; } };
      },
    };
  },
}));

const storedCacheKeys: string[] = [];
vi.mock('@/lib/cache/redis', () => ({
  withCache: async (k: string, f: () => Promise<unknown>) => {
    const data = await f(); // throw du fetcher → storedCacheKeys non touché
    storedCacheKeys.push(k);
    return { data, fromCache: false };
  },
  buildCacheKey: (...p: string[]) => p.join(':'),
}));

const capturedWarns: string[] = [];
vi.mock('@/lib/utils/logger', () => ({
  logger: { api: () => {}, error: () => {}, warn: (_s: string, m: string) => { capturedWarns.push(m); } },
}));

// Un faux guide assez long pour passer le plancher de mots (GUIDE_MIN_WORDS = 250).
const LONG_GUIDE = "**Vue d'ensemble**\n\n" + Array(160).fill('mot').join(' ') + '\n\n**Conseil final**\n\n' + Array(160).fill('mot').join(' ');

function makeScore() {
  return {
    country: 'Portugal', countryCode: 'PT', total: 80,
    security: { value: 75, source: 'live', confidence: 'high', details: { meaeLevel: 1 } },
    geopolitical: { value: 80, source: 'live', confidence: 'high', details: { trend: 'stable' } },
    budget: { value: 70, source: 'live', confidence: 'high', details: { currencyVariation: 0, mealCheap: 8, hotelAvg: 60 } },
    practicality: { value: 65, source: 'live', confidence: 'high', details: {} },
    status: 'ideal', confidence: 'high', calculatedAt: new Date().toISOString(),
    liveRisks: ['Pickpockets dans les zones touristiques'], recentEvents: [],
  } as never;
}

const facts = {
  whereToStay: ['Lisbonne centre'], zonesToAvoid: [], commonScams: ['Faux pétards'],
  classicMistakes: [], localCustoms: [], fieldTips: [],
};

const profile = { travelType: 'solo' as const, budget: 1500, duration: 7 };

beforeEach(() => {
  vi.resetModules();
  process.env.ANTHROPIC_API_KEY = 'sk-test';
  capturedPrompt = ''; storedCacheKeys.length = 0; capturedWarns.length = 0; abortCount = 0;
});
afterEach(() => { vi.useRealTimers(); });

async function load() { return import('./claude.service'); }

describe('generatePremiumCountryGuide', () => {
  it('le prompt contient le pays, le profil et des données de score', async () => {
    createImpl = () => Promise.resolve({ content: [{ text: LONG_GUIDE }], stop_reason: 'end_turn' });
    const { generatePremiumCountryGuide } = await load();
    await generatePremiumCountryGuide(makeScore(), facts, profile);
    expect(capturedPrompt).toContain('Portugal');
    expect(capturedPrompt).toContain('solo');
    expect(capturedPrompt).toMatch(/80/); // score total
  });

  it('intègre les faits Perplexity dans le prompt', async () => {
    createImpl = () => Promise.resolve({ content: [{ text: LONG_GUIDE }], stop_reason: 'end_turn' });
    const { generatePremiumCountryGuide } = await load();
    await generatePremiumCountryGuide(makeScore(), facts, profile);
    expect(capturedPrompt).toContain('Lisbonne centre');
  });

  it('renvoie un guide non-fallback sur succès et le met en cache', async () => {
    createImpl = () => Promise.resolve({ content: [{ text: LONG_GUIDE }], stop_reason: 'end_turn' });
    const { generatePremiumCountryGuide } = await load();
    const guide = await generatePremiumCountryGuide(makeScore(), facts, profile);
    expect(guide.isFallback).toBeFalsy();
    expect(guide.guideText.length).toBeGreaterThan(0);
    expect(storedCacheKeys.length).toBe(1);
  });

  it('clé de cache versionnée guide-v1, segmentée par pays + profil', async () => {
    createImpl = () => Promise.resolve({ content: [{ text: LONG_GUIDE }], stop_reason: 'end_turn' });
    const { generatePremiumCountryGuide } = await load();
    await generatePremiumCountryGuide(makeScore(), facts, profile);
    const key = storedCacheKeys[0];
    expect(key).toContain('country-guide');
    expect(key).toContain('PT');
    expect(key).toContain('solo');
    expect(key).toContain('guide-v1');
  });

  it('stop_reason=max_tokens → fallback NON caché', async () => {
    createImpl = () => Promise.resolve({ content: [{ text: LONG_GUIDE }], stop_reason: 'max_tokens' });
    const { generatePremiumCountryGuide } = await load();
    const guide = await generatePremiumCountryGuide(makeScore(), facts, profile);
    expect(guide.isFallback).toBe(true);
    expect(storedCacheKeys.length).toBe(0); // rien mis en cache
  });

  it('guide trop court → fallback NON caché', async () => {
    createImpl = () => Promise.resolve({ content: [{ text: '**Trop court**' }], stop_reason: 'end_turn' });
    const { generatePremiumCountryGuide } = await load();
    const guide = await generatePremiumCountryGuide(makeScore(), facts, profile);
    expect(guide.isFallback).toBe(true);
    expect(storedCacheKeys.length).toBe(0);
  });

  it('erreur/timeout Claude → fallback honnête NON caché + warn', async () => {
    createImpl = () => Promise.reject(new Error('boom'));
    const { generatePremiumCountryGuide } = await load();
    const guide = await generatePremiumCountryGuide(makeScore(), facts, profile);
    expect(guide.isFallback).toBe(true);
    expect(storedCacheKeys.length).toBe(0);
    expect(capturedWarns.some((w) => w.includes('fallback'))).toBe(true);
  });

  it("sans clé API → fallback (pas d'appel)", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const { generatePremiumCountryGuide } = await load();
    const guide = await generatePremiumCountryGuide(makeScore(), facts, profile);
    expect(guide.isFallback).toBe(true);
  });
});
