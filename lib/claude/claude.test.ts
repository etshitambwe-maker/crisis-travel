import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Pilote le comportement de client.messages.create() ET de client.messages.stream().
// createImpl résout le « message final » (mêmes objets { content:[{text}], stop_reason }).
let createImpl: () => Promise<unknown>;
let capturedClientOpts: Record<string, unknown> | undefined;
// Compte les abort() déclenchés par le hard timeout (PREMIUM-GUIDE-001B-timeout).
let abortCount = 0;

vi.mock('@anthropic-ai/sdk', () => ({
  default: class {
    constructor(opts: Record<string, unknown>) {
      capturedClientOpts = opts;
    }
    messages = {
      // generateItinerary / generateDestinationNarrative passent au streaming :
      // stream() renvoie un objet dont finalMessage() résout createImpl(), et un
      // abort() espionné. detectOpportunities utilise toujours create() — conservé.
      create: () => createImpl(),
      stream: () => ({
        finalMessage: () => createImpl(),
        abort: () => { abortCount++; },
      }),
    };
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

// Capture les warns émis par le service — permet de prouver le diagnostic
// narrativeText insuffisant (PREMIUM-GUIDE-001B, point 5) sans dépendre de la console.
const capturedWarns: string[] = [];
vi.mock('@/lib/utils/logger', () => ({
  logger: {
    api: () => {},
    error: () => {},
    warn: (_service: string, message: string) => { capturedWarns.push(message); },
  },
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
  capturedWarns.length = 0;
  abortCount = 0;
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

  // PREMIUM-EXPERIENCE-001 (B) — la clé narrative est versionnée pour ne plus servir
  // les anciennes narratives courtes générées avant la refonte du prompt (10 sections).
  it('la clé narrative inclut un segment de version v2', async () => {
    createImpl = () => Promise.resolve({ content: [{ text: 'Analyse versionnée.' }] });
    const { generateDestinationNarrative } = await load();
    await generateDestinationNarrative(score, mk('solo'));
    const narrativeKey = capturedCacheKeys.find((k) => k.includes('claude-narrative'));
    expect(narrativeKey).toBeDefined();
    expect(narrativeKey).toContain('v2');
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

  // GUIDE-V1 : l'itinéraire est un TEXTE de guide (>= MIN_NARRATIVE_WORDS=200 mots), pas un JSON.
  const validGuideText =
    '**Le fil conducteur du séjour**\n\n' +
    Array.from({ length: 70 }, (_, i) => `phrase${i} de guide concrète et utile pour le voyageur`).join(' ') +
    '\n\n**Mon conseil final**\n\nNe surcharge pas et vérifie diplomatie.gouv.fr avant le départ.';

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

  it('le plafond max_tokens de l\'itinéraire est réduit pour un texte de guide (<= 4000, GUIDE-V1)', async () => {
    const src = readFileSync(resolve(process.cwd(), 'lib/claude/claude.service.ts'), 'utf-8');
    // Bloc generateItinerary uniquement. La sortie texte étant plus courte que l'ancien
    // JSON jour/jour, max_tokens baisse → moins de risque de timeout/troncature.
    const itinBlock = src.slice(src.indexOf('export async function generateItinerary'));
    const m = itinBlock.match(/max_tokens:\s*(\d+)/);
    expect(m).not.toBeNull();
    expect(Number(m![1])).toBeLessThanOrEqual(4000);
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

  it('itinéraire : stop_reason="max_tokens" → fallback honnête (sans days, sans narrativeText)', async () => {
    createImpl = () => Promise.resolve({
      content: [{ text: 'Texte de guide coupé en plein milieu' }],
      stop_reason: 'max_tokens',
    });
    const { generateItinerary } = await load();
    const result = await generateItinerary(itinReq);
    // GUIDE-V1 : le fallback ne fabrique plus de fausses cartes.
    expect(result.isFallback).toBe(true);
    expect(result.days).toHaveLength(0);
    expect(result.narrativeText).toBeUndefined();
  });

  it('itinéraire tronqué : la réponse n\'est JAMAIS mise en cache', async () => {
    createImpl = () => Promise.resolve({
      content: [{ text: validGuideText }],
      stop_reason: 'max_tokens',
    });
    const { generateItinerary } = await load();
    await generateItinerary(itinReq);
    const itinKey = storedCacheKeys.find((k) => k.includes('itinerary'));
    expect(itinKey).toBeUndefined();
  });

  it('itinéraire complet (stop_reason="end_turn") : texte de guide en narrativeText, mis en cache', async () => {
    createImpl = () => Promise.resolve({
      content: [{ text: validGuideText }],
      stop_reason: 'end_turn',
    });
    const { generateItinerary } = await load();
    const result = await generateItinerary(itinReq);
    expect(result.narrativeText).toContain('fil conducteur');
    expect(result.days).toHaveLength(0);
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

// ── PREMIUM-CONTENT-001 — richesse minimale des prompts ─────────────────────────

describe('PREMIUM-CONTENT-001 — prompt narrative : 10 sections premium présentes', () => {
  const src = readFileSync(resolve(process.cwd(), 'lib/claude/claude.service.ts'), 'utf-8');
  // Bloc generateDestinationNarrative uniquement (avant fetchOpportunities)
  const narrativeBlock = src.slice(
    src.indexOf('export async function generateDestinationNarrative'),
    src.indexOf('async function fetchOpportunities')
  );

  it('le prompt narrative contient la section Santé', () => {
    expect(narrativeBlock).toMatch(/[Ss]ant[eé]/);
  });

  it('le prompt narrative contient la section vaccins', () => {
    expect(narrativeBlock).toMatch(/vaccin/i);
  });

  it('le prompt narrative contient la section consulaire ou administrative', () => {
    expect(narrativeBlock).toMatch(/consulaire|administratif/i);
  });

  it('le prompt narrative contient la section géopolitique', () => {
    expect(narrativeBlock).toMatch(/géopolitique/i);
  });

  it('le prompt narrative contient la section économique', () => {
    expect(narrativeBlock).toMatch(/économique/i);
  });

  it('le prompt narrative contient la section transport ou déplacements', () => {
    expect(narrativeBlock).toMatch(/transport|déplacements/i);
  });

  it('le prompt narrative contient la section mises en garde', () => {
    expect(narrativeBlock).toMatch(/mises? en garde|signaux d'alerte/i);
  });

  it('le prompt narrative mentionne le profil travelType', () => {
    expect(narrativeBlock).toMatch(/travelType|profil/i);
  });

  it('le prompt narrative demande de ne pas affirmer une obligation vaccinale', () => {
    expect(narrativeBlock).toMatch(/médecin|vaccination|professionnel de santé/i);
  });

  it('le prompt narrative mentionne diplomatie.gouv ou Ariane', () => {
    expect(narrativeBlock).toMatch(/diplomatie\.gouv|[Aa]riane/);
  });

  it('le max_tokens narrative est passé à 3000', () => {
    const m = narrativeBlock.match(/max_tokens:\s*(\d+)/);
    expect(m).not.toBeNull();
    expect(Number(m![1])).toBe(3000);
  });
});

describe('GUIDE-V1 — prompt itinéraire : texte de guide (pas de JSON, pas de cases)', () => {
  const src = readFileSync(resolve(process.cwd(), 'lib/claude/claude.service.ts'), 'utf-8');
  // Bloc generateItinerary uniquement
  const itinBlock = src.slice(src.indexOf('export async function generateItinerary'));

  it('le prompt itinéraire injecte travelType via travelTypeContext', () => {
    expect(itinBlock).toMatch(/travelTypeContext/);
  });

  it('le prompt itinéraire adapte le rythme selon le profil (req.travelType)', () => {
    expect(itinBlock).toMatch(/req\.travelType/);
  });

  it('le prompt demande une LOGIQUE DE PARCOURS (zones/étapes cohérentes)', () => {
    expect(itinBlock).toMatch(/LOGIQUE DE PARCOURS|parcours|étapes/i);
  });

  it('le prompt demande un conseil de RYTHME', () => {
    expect(itinBlock).toMatch(/RYTHME/i);
  });

  it('le prompt demande des ALTERNATIVES (fatigue/météo/budget)', () => {
    expect(itinBlock).toMatch(/ALTERNATIVES/i);
    expect(itinBlock).toMatch(/fatigue/i);
    expect(itinBlock).toMatch(/météo/i);
  });

  it('le prompt demande les ERREURS À ÉVITER', () => {
    expect(itinBlock).toMatch(/ERREURS À ÉVITER|erreurs à éviter/i);
  });

  it('le prompt mentionne la vigilance selon MEAE', () => {
    expect(itinBlock).toMatch(/meaeLevel|MEAE/);
  });

  it('le prompt mentionne diplomatie.gouv et Ariane', () => {
    expect(itinBlock).toMatch(/diplomatie\.gouv/);
    expect(itinBlock).toMatch(/[Aa]riane/);
  });

  it('le prompt INTERDIT explicitement le découpage jour/matin/après-midi/soir et le JSON', () => {
    expect(itinBlock).toMatch(/NE PRODUIS PAS de découpage jour/i);
    expect(itinBlock).toMatch(/NI de JSON|pas de JSON/i);
  });

  it('le prompt reste dans le contrat de sécurité (pas de sécurité absolue)', () => {
    expect(itinBlock).toContain('Ne promets pas de sécurité absolue');
    expect(itinBlock).toContain('diplomatie.gouv.fr');
  });

  it('le max_tokens itinéraire est réduit à 3000 (sortie texte, moins de timeout)', () => {
    const m = itinBlock.match(/max_tokens:\s*(\d+)/);
    expect(m).not.toBeNull();
    expect(Number(m![1])).toBe(3000);
  });
});

describe('GUIDE-V1 — sortie texte : narrativeText unique livrable, days vide', () => {
  const itinReq = {
    countryCode: 'MA', countryName: 'Maroc',
    from: '2026-07-10', to: '2026-07-15',
    budget: 900, currency: 'EUR', travelers: 1, travelType: 'solo', preferences: [],
  } as never;

  const validGuideText =
    '**Le fil conducteur du séjour**\n\n' +
    Array.from({ length: 70 }, (_, i) => `phrase${i} de guide concrète et utile`).join(' ') +
    '\n\n**Mon conseil final**\n\nVérifie diplomatie.gouv.fr avant le départ.';

  it('un guide substantiel devient narrativeText ; days reste vide', async () => {
    createImpl = () => Promise.resolve({ content: [{ text: validGuideText }], stop_reason: 'end_turn' });
    const { generateItinerary } = await load();
    const result = await generateItinerary(itinReq);
    expect(result.narrativeText).toContain('fil conducteur');
    expect(result.days).toHaveLength(0);
    expect(result.isFallback).toBeFalsy();
  });

  it('un texte trop court → fallback honnête (sans days, sans narrativeText), NON caché', async () => {
    createImpl = () => Promise.resolve({ content: [{ text: 'Trop court.' }], stop_reason: 'end_turn' });
    const { generateItinerary } = await load();
    const result = await generateItinerary(itinReq);
    expect(result.isFallback).toBe(true);
    expect(result.narrativeText).toBeUndefined();
    expect(result.days).toHaveLength(0);
    const storedKey = storedCacheKeys.find((k) => k.includes('itinerary'));
    expect(storedKey).toBeUndefined();
  });

  it('le fallback déterministe ne fabrique JAMAIS de fausses cartes', async () => {
    createImpl = () => Promise.resolve({ content: [{ text: '' }], stop_reason: 'end_turn' });
    const { generateItinerary } = await load();
    const result = await generateItinerary(itinReq);
    expect(result.isFallback).toBe(true);
    expect(result.days).toHaveLength(0);
  });
});

// ── GUIDE-V1 — cache itinéraire versionné guide-v1 ──────────

describe('GUIDE-V1 — clé cache itinéraire versionnée guide-v1', () => {
  const itinReq = {
    countryCode: 'JP', countryName: 'Japon',
    from: '2026-09-01', to: '2026-09-08',
    budget: 2000, currency: 'EUR', travelers: 2, travelType: 'couple', preferences: [],
  } as never;

  const validGuideText =
    '**Le fil conducteur**\n\n' +
    Array.from({ length: 70 }, (_, i) => `phrase${i} de guide concrète et utile`).join(' ') +
    '\n\n**Mon conseil final**\n\nVérifie diplomatie.gouv.fr.';

  it('la clé itinéraire inclut un segment de version guide-v1', async () => {
    createImpl = () => Promise.resolve({ content: [{ text: validGuideText }], stop_reason: 'end_turn' });
    const { generateItinerary } = await load();
    await generateItinerary(itinReq);
    const itinKey = capturedCacheKeys.find((k) => k.includes('itinerary'));
    expect(itinKey).toBeDefined();
    expect(itinKey).toContain('guide-v1');
  });

  it('le segment de version est présent dans la clé EFFECTIVEMENT stockée', async () => {
    createImpl = () => Promise.resolve({ content: [{ text: validGuideText }], stop_reason: 'end_turn' });
    const { generateItinerary } = await load();
    await generateItinerary(itinReq);
    const storedKey = storedCacheKeys.find((k) => k.includes('itinerary'));
    expect(storedKey).toBeDefined();
    expect(storedKey).toContain('guide-v1');
  });

  it('la clé ne contient PLUS les anciens segments (narrative-v1/v2)', async () => {
    createImpl = () => Promise.resolve({ content: [{ text: validGuideText }], stop_reason: 'end_turn' });
    const { generateItinerary } = await load();
    await generateItinerary(itinReq);
    const itinKey = capturedCacheKeys.find((k) => k.includes('itinerary'));
    expect(itinKey).toBeDefined();
    expect(itinKey).not.toContain('narrative-v1');
    expect(itinKey).not.toContain('narrative-v2');
  });

  // Le fallback (catch) ne doit JAMAIS être mis en cache : il est construit HORS withCache.
  it('le fallback (JSON malformé) n\'est PAS mis en cache', async () => {
    createImpl = () => Promise.resolve({ content: [{ text: 'pas du json' }], stop_reason: 'end_turn' });
    const { generateItinerary } = await load();
    const result = await generateItinerary(itinReq);
    expect(result.isFallback).toBe(true);
    const storedKey = storedCacheKeys.find((k) => k.includes('itinerary'));
    expect(storedKey).toBeUndefined();
  });

  it('le fallback (timeout) n\'est PAS mis en cache', async () => {
    vi.useFakeTimers();
    createImpl = () => new Promise(() => {}); // ne résout jamais
    const { generateItinerary } = await load();
    const p = generateItinerary(itinReq);
    await vi.advanceTimersByTimeAsync(45000);
    const result = await p;
    expect(result.isFallback).toBe(true);
    const storedKey = storedCacheKeys.find((k) => k.includes('itinerary'));
    expect(storedKey).toBeUndefined();
  });
});

// ── GUIDE-V1 — prompt : texte guide substantiel, formulations humaines ──

describe('GUIDE-V1 — prompt itinéraire : texte guide substantiel, voix humaine', () => {
  const src = readFileSync(resolve(process.cwd(), 'lib/claude/claude.service.ts'), 'utf-8');
  const itinBlock = src.slice(src.indexOf('export async function generateItinerary'));

  it('le prompt impose un nombre de paragraphes mis à l\'échelle de la durée', () => {
    expect(itinBlock).toMatch(/narrativeParagraphTarget/);
    expect(itinBlock).toMatch(/paragraphes/i);
  });

  it('le prompt impose une cible de mots mise à l\'échelle de la durée', () => {
    expect(itinBlock).toMatch(/narrativeWordTarget/);
  });

  it('la cible de paragraphes croît avec la durée (court < long séjour)', () => {
    expect(itinBlock).toMatch(/days <= 4 \? 6/);
    expect(itinBlock).toMatch(/: 10/);
  });

  it('le prompt emploie des formulations de guide humain (je te conseille / j\'éviterais)', () => {
    expect(itinBlock).toMatch(/je te conseille/i);
    expect(itinBlock).toMatch(/j'éviterais/i);
    expect(itinBlock).toMatch(/le bon compromis/i);
    expect(itinBlock).toMatch(/rythme le plus intelligent/i);
  });

  it('le prompt demande d\'expliquer POURQUOI chaque étape est recommandée', () => {
    expect(itinBlock).toMatch(/POURQUOI/);
  });

  it('le prompt demande un format markdown (titres en gras + paragraphes), pas de cases', () => {
    expect(itinBlock).toMatch(/markdown/i);
    expect(itinBlock).toMatch(/Titres? courts? en gras/i);
  });
});

// ── GUIDE-V1 — fallback honnête quand le guide est insuffisant ──

describe('GUIDE-V1 — fallback honnête quand le guide est insuffisant', () => {
  const itinReq = {
    countryCode: 'JP', countryName: 'Japon',
    from: '2026-09-01', to: '2026-09-08',
    budget: 2000, currency: 'EUR', travelers: 2, travelType: 'couple', preferences: [],
  } as never;

  const longGuide =
    '**Le fil conducteur du séjour**\n\n' +
    Array.from({ length: 60 }, (_, i) => `phrase${i} de guide détaillée pour le voyageur`).join(' ') +
    '\n\n**Mon conseil final**\n\nProfite bien et vérifie diplomatie.gouv.fr.';

  it('texte vide → fallback honnête NON caché (pas de faux contenu)', async () => {
    createImpl = () => Promise.resolve({ content: [{ text: '' }], stop_reason: 'end_turn' });
    const { generateItinerary } = await load();
    const result = await generateItinerary(itinReq);
    expect(result.isFallback).toBe(true);
    expect(result.narrativeText).toBeUndefined();
    const storedKey = storedCacheKeys.find((k) => k.includes('itinerary'));
    expect(storedKey).toBeUndefined();
  });

  it('texte trop court → fallback honnête NON caché', async () => {
    createImpl = () => Promise.resolve({ content: [{ text: 'Quelques mots seulement.' }], stop_reason: 'end_turn' });
    const { generateItinerary } = await load();
    const result = await generateItinerary(itinReq);
    expect(result.isFallback).toBe(true);
    const storedKey = storedCacheKeys.find((k) => k.includes('itinerary'));
    expect(storedKey).toBeUndefined();
  });

  it('guide substantiel → narrativeText présent, PAS fallback, mis en cache', async () => {
    createImpl = () => Promise.resolve({ content: [{ text: longGuide }], stop_reason: 'end_turn' });
    const { generateItinerary } = await load();
    const result = await generateItinerary(itinReq);
    expect(result.narrativeText).toBeDefined();
    expect(result.isFallback).toBeFalsy();
    const storedKey = storedCacheKeys.find((k) => k.includes('itinerary'));
    expect(storedKey).toBeDefined();
  });

  it('le fallback ne lève JAMAIS d\'exception et ne fabrique pas de days', async () => {
    createImpl = () => Promise.resolve({ content: [{ text: '' }], stop_reason: 'end_turn' });
    const { generateItinerary } = await load();
    const result = await generateItinerary(itinReq);
    expect(result.days).toHaveLength(0);
  });
});

// ── PREMIUM-GUIDE-001B-timeout — streaming + timeouts relevés + repli marqué ──────

describe('PREMIUM-GUIDE-001B-timeout — streaming, timeouts, repli honnête', () => {
  const itinReq = {
    countryCode: 'JP', countryName: 'Japon',
    from: '2026-09-01', to: '2026-09-08',
    budget: 2000, currency: 'EUR', travelers: 2, travelType: 'couple', preferences: [],
  } as never;

  // GUIDE-V1 : la sortie est un TEXTE de guide (>= 200 mots), pas un JSON.
  const validGuideText =
    '**Le fil conducteur**\n\n' +
    Array.from({ length: 70 }, (_, i) => `phrase${i} de guide concrète et utile`).join(' ') +
    '\n\n**Mon conseil final**\n\nVérifie diplomatie.gouv.fr.';

  // ── Le service appelle bien stream() (pas create non-streamé) ──────────────────

  it('generateItinerary utilise client.messages.stream().finalMessage() (source)', () => {
    const src = readFileSync(resolve(process.cwd(), 'lib/claude/claude.service.ts'), 'utf-8');
    const itinBlock = src.slice(src.indexOf('export async function generateItinerary'));
    expect(itinBlock).toMatch(/client\.messages\.stream\(/);
    expect(itinBlock).toMatch(/\.finalMessage\(\)/);
  });

  it('generateDestinationNarrative utilise client.messages.stream() (source)', () => {
    const src = readFileSync(resolve(process.cwd(), 'lib/claude/claude.service.ts'), 'utf-8');
    const narrativeBlock = src.slice(
      src.indexOf('export async function generateDestinationNarrative'),
      src.indexOf('async function fetchOpportunities'),
    );
    expect(narrativeBlock).toMatch(/client\.messages\.stream\(/);
    expect(narrativeBlock).toMatch(/\.finalMessage\(\)/);
  });

  // ── Timeouts internes relevés ──────────────────────────────────────────────────

  it('le hard timeout itinéraire est relevé à 45000ms', () => {
    const src = readFileSync(resolve(process.cwd(), 'lib/claude/claude.service.ts'), 'utf-8');
    expect(src).toMatch(/ITINERARY_HARD_TIMEOUT_MS\s*=\s*45000/);
  });

  it('le hard timeout narrative est relevé à 40000ms', () => {
    const src = readFileSync(resolve(process.cwd(), 'lib/claude/claude.service.ts'), 'utf-8');
    expect(src).toMatch(/NARRATIVE_HARD_TIMEOUT_MS\s*=\s*40000/);
  });

  // ── Cas nominal : streaming réussit ──────────────────────────────────────────────

  it('streaming nominal : texte de guide en narrativeText, PAS isFallback, days vide', async () => {
    createImpl = () => Promise.resolve({ content: [{ text: validGuideText }], stop_reason: 'end_turn' });
    const { generateItinerary } = await load();
    const result = await generateItinerary(itinReq);
    expect(result.narrativeText).toContain('fil conducteur');
    expect(result.isFallback).toBeFalsy();
    expect(result.days).toHaveLength(0);
  });

  // ── Cas timeout : abort + repli marqué isFallback ────────────────────────────────

  it('timeout itinéraire : abort() appelé + repli marqué isFallback (pas de fausses cartes silencieuses)', async () => {
    vi.useFakeTimers();
    // finalMessage() ne résout jamais → seul le hard timeout tranche.
    createImpl = () => new Promise(() => {});
    const { generateItinerary } = await load();

    const p = generateItinerary(itinReq);
    await vi.advanceTimersByTimeAsync(45000);
    const result = await p;

    expect(abortCount).toBeGreaterThanOrEqual(1); // le stream a été aborté proprement
    expect(result.isFallback).toBe(true);          // repli marqué → UI honnête
    expect(result.narrativeText).toBeUndefined();  // pas de faux narratif
    expect(result.days).toHaveLength(0);           // GUIDE-V1 : pas de fausses cartes
  });

  it('le repli déterministe porte le marqueur isFallback (texte vide → fallback)', async () => {
    createImpl = () => Promise.resolve({ content: [{ text: '' }], stop_reason: 'end_turn' });
    const { generateItinerary } = await load();
    const result = await generateItinerary(itinReq);
    expect(result.isFallback).toBe(true);
  });

  // ── Garde anti-troncature toujours active via le stream ──────────────────────────

  it('stop_reason="max_tokens" via stream → repli marqué isFallback (jamais le texte tronqué)', async () => {
    createImpl = () => Promise.resolve({
      content: [{ text: 'texte de guide coupé au milieu' }],
      stop_reason: 'max_tokens',
    });
    const { generateItinerary } = await load();
    const result = await generateItinerary(itinReq);
    expect(result.isFallback).toBe(true);
    const itinKey = storedCacheKeys.find((k) => k.includes('itinerary'));
    expect(itinKey).toBeUndefined(); // tronqué → jamais mis en cache
  });
});
