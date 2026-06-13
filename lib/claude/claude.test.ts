import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

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
// Clés EFFECTIVEMENT stockées : le mock reproduit le contrat réel de withCache —
// si le fetcher throw (réponse tronquée), setInCache n'est jamais atteint, donc la
// clé n'est PAS enregistrée ici (REPORT-LENGTH-001).
const storedCacheKeys: string[] = [];
vi.mock('@/lib/cache/redis', () => ({
  withCache: async (k: string, f: () => Promise<unknown>) => {
    const data = await f(); // throw du fetcher → propagé, storedCacheKeys non touché
    storedCacheKeys.push(k);
    return { data, fromCache: false };
  },
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
  storedCacheKeys.length = 0;
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

// ── REPORT-LENGTH-001 — détection de réponse Claude tronquée ────────────────────

describe('garde anti-troncature (REPORT-LENGTH-001)', () => {
  const itinReq = {
    countryCode: 'MA', countryName: 'Maroc',
    from: '2026-07-01', to: '2026-07-15', // 14 jours — cas long
    budget: 2000, currency: 'EUR', travelers: 1, travelType: 'solo', preferences: [],
  } as never;

  const validItineraryJson = JSON.stringify({
    days: [{ day: 1, title: 'J1', summary: 's', morning: 'm', afternoon: 'a', evening: 'e', estimatedBudget: '~80', safetyNote: 'ok' }],
    globalAdvice: ['conseil'],
    safetyDisclaimer: 'disclaimer',
    officialSourceReminder: 'Vérifiez toujours les informations officielles sur diplomatie.gouv.fr avant votre départ.',
  });

  const narrativeScore = {
    country: 'Maroc', countryCode: 'MA', total: 70,
    security:     { value: 70, source: 'live', confidence: 'medium', details: {} },
    geopolitical: { value: 70, source: 'live', confidence: 'medium', details: { trend: 'stable' } },
    budget:       { value: 70, source: 'live', confidence: 'medium', details: { currencyVariation: 0, mealCheap: 8, hotelAvg: 60 } },
    practicality: { value: 60, source: 'live', confidence: 'medium', details: {} },
    status: 'recommended', confidence: 'medium', calculatedAt: new Date().toISOString(),
  } as never;
  const narrativeProfile = { departureCountry: 'FR', budget: 1500, duration: 7, period: 'flexible', travelType: 'solo', mode: 'standard' } as never;

  // ── max_tokens relevés (plafonds suffisants pour les rapports longs) ──────────

  it('le plafond max_tokens de l\'itinéraire couvre les longs séjours (>= 8000)', async () => {
    const src = readFileSync(resolve(process.cwd(), 'lib/claude/claude.service.ts'), 'utf-8');
    // Bloc generateItinerary uniquement
    const itinBlock = src.slice(src.indexOf('export async function generateItinerary'));
    const m = itinBlock.match(/max_tokens:\s*(\d+)/);
    expect(m).not.toBeNull();
    expect(Number(m![1])).toBeGreaterThanOrEqual(8000);
  });

  it('le plafond max_tokens de la narrative est relevé (>= 1000)', async () => {
    const src = readFileSync(resolve(process.cwd(), 'lib/claude/claude.service.ts'), 'utf-8');
    // Premier appel = generateDestinationNarrative
    const narrativeBlock = src.slice(0, src.indexOf('async function fetchOpportunities'));
    const m = narrativeBlock.match(/max_tokens:\s*(\d+)/);
    expect(m).not.toBeNull();
    expect(Number(m![1])).toBeGreaterThanOrEqual(1000);
  });

  // ── Itinéraire tronqué ────────────────────────────────────────────────────────

  it('itinéraire : stop_reason="max_tokens" → fallback (pas le JSON tronqué)', async () => {
    // JSON volontairement coupé en plein milieu + signal de troncature
    createImpl = () => Promise.resolve({
      content: [{ text: '{"days":[{"day":1,"title":"J1","summary":"sss' }],
      stop_reason: 'max_tokens',
    });
    const { generateItinerary } = await load();
    const result = await generateItinerary(itinReq);
    // Fallback déterministe : 14 jours génériques "À planifier…"
    expect(result.days).toHaveLength(14);
    expect(result.days[0].morning).toContain('À planifier');
  });

  it('itinéraire tronqué : la réponse n\'est JAMAIS mise en cache', async () => {
    createImpl = () => Promise.resolve({
      content: [{ text: '{"days":[{"day":1' }],
      stop_reason: 'max_tokens',
    });
    const { generateItinerary } = await load();
    await generateItinerary(itinReq);
    const itinKey = storedCacheKeys.find((k) => k.includes('itinerary'));
    expect(itinKey).toBeUndefined();
  });

  it('itinéraire complet (stop_reason="end_turn") : mis en cache normalement', async () => {
    createImpl = () => Promise.resolve({
      content: [{ text: validItineraryJson }],
      stop_reason: 'end_turn',
    });
    const { generateItinerary } = await load();
    const result = await generateItinerary(itinReq);
    expect(result.days[0].title).toBe('J1');
    const itinKey = storedCacheKeys.find((k) => k.includes('itinerary'));
    expect(itinKey).toBeDefined();
  });

  // ── Narrative tronquée ────────────────────────────────────────────────────────

  it('narrative : stop_reason="max_tokens" → fallback, non mise en cache', async () => {
    createImpl = () => Promise.resolve({
      content: [{ text: '**Maroc** obtient un CrisisScore de 70/100, ce qui en fait une dest' }],
      stop_reason: 'max_tokens',
    });
    const { generateDestinationNarrative } = await load();
    const result = await generateDestinationNarrative(narrativeScore, narrativeProfile);
    // Le fallback déterministe contient toujours la section "Risques résiduels"
    expect(result).toContain('Risques résiduels');
    const narrativeKey = storedCacheKeys.find((k) => k.includes('claude-narrative'));
    expect(narrativeKey).toBeUndefined();
  });

  it('narrative complète (stop_reason="end_turn") : mise en cache normalement', async () => {
    createImpl = () => Promise.resolve({
      content: [{ text: 'Analyse complète du Maroc.' }],
      stop_reason: 'end_turn',
    });
    const { generateDestinationNarrative } = await load();
    const result = await generateDestinationNarrative(narrativeScore, narrativeProfile);
    expect(result).toBe('Analyse complète du Maroc.');
    const narrativeKey = storedCacheKeys.find((k) => k.includes('claude-narrative'));
    expect(narrativeKey).toBeDefined();
  });
});
