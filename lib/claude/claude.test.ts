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

describe('PREMIUM-CONTENT-001 — prompt itinéraire : travelType injecté + logique circuit', () => {
  const src = readFileSync(resolve(process.cwd(), 'lib/claude/claude.service.ts'), 'utf-8');
  // Bloc generateItinerary uniquement
  const itinBlock = src.slice(src.indexOf('export async function generateItinerary'));

  it('le prompt itinéraire injecte travelType via travelTypeContext', () => {
    expect(itinBlock).toMatch(/travelTypeContext/);
  });

  it('le prompt itinéraire adapte le rythme selon le profil (req.travelType)', () => {
    expect(itinBlock).toMatch(/req\.travelType/);
  });

  it('le prompt itinéraire demande une logique géographique cohérente', () => {
    expect(itinBlock).toMatch(/géographiquement cohérent|circuit/i);
  });

  it('le prompt itinéraire demande des conseils de déplacement (transport)', () => {
    expect(itinBlock).toMatch(/moyen de transport|transport inter/i);
  });

  it('le prompt itinéraire demande des alternatives', () => {
    expect(itinBlock).toMatch(/alternative/i);
  });

  it('le prompt itinéraire adapte le budget par jour', () => {
    expect(itinBlock).toMatch(/perDay|par jour/i);
  });

  it('le prompt itinéraire mentionne la vigilance selon MEAE', () => {
    expect(itinBlock).toMatch(/meaeLevel|MEAE/);
  });

  it('le prompt itinéraire mentionne diplomatie.gouv et Ariane', () => {
    expect(itinBlock).toMatch(/diplomatie\.gouv/);
    expect(itinBlock).toMatch(/[Aa]riane/);
  });
});

// ── PREMIUM-GUIDE-001B — itinéraire narratif (texte de guide) ─────────────────

describe('PREMIUM-GUIDE-001B — prompt itinéraire : narrativeText de guide demandé', () => {
  const src = readFileSync(resolve(process.cwd(), 'lib/claude/claude.service.ts'), 'utf-8');
  const itinBlock = src.slice(src.indexOf('export async function generateItinerary'));

  it('le prompt demande explicitement un champ narrativeText', () => {
    expect(itinBlock).toContain('narrativeText');
  });

  it('le narrativeText est décrit comme un texte de guide / parcours fluide', () => {
    expect(itinBlock).toMatch(/guide/i);
    expect(itinBlock).toMatch(/fil conducteur/i);
  });

  it('le prompt narrativeText couvre rythme, vigilance et conseil final', () => {
    expect(itinBlock).toMatch(/rythme/i);
    expect(itinBlock).toMatch(/vigilance|précautions/i);
    expect(itinBlock).toMatch(/conseil final/i);
  });

  it('le narrativeText doit s\'appuyer sur les jours structurés (ne pas les remplacer)', () => {
    // Le prompt précise que la narrative DÉCOULE des jours et ne les répète pas en liste.
    expect(itinBlock).toMatch(/DÉCOULE des jours|découle des jours/i);
  });

  it('le narrativeText reste dans le contrat de sécurité (pas de sécurité absolue, diplomatie.gouv.fr)', () => {
    // Ces garde-fous globaux du prompt s'appliquent aussi au texte narratif.
    expect(itinBlock).toContain('Ne promets pas de sécurité absolue');
    expect(itinBlock).toContain('diplomatie.gouv.fr');
  });

  it('le plafond max_tokens couvre le narratif additionnel sans augmentation (reste à 8000)', () => {
    // Aucun nouvel appel ni hausse de tokens : le narratif est produit dans le MÊME appel.
    const m = itinBlock.match(/max_tokens:\s*(\d+)/);
    expect(m).not.toBeNull();
    expect(Number(m![1])).toBe(8000);
  });
});

describe('PREMIUM-GUIDE-001B — parsing narrativeText (optionnel, rétro-compatible)', () => {
  const itinReq = {
    countryCode: 'MA', countryName: 'Maroc',
    from: '2026-07-10', to: '2026-07-15',
    budget: 900, currency: 'EUR', travelers: 1, travelType: 'solo', preferences: [],
  } as never;

  const dayPayload = {
    days: [{ day: 1, title: 'J1', summary: 's', morning: 'm', afternoon: 'a', evening: 'e', estimatedBudget: '~80', safetyNote: 'ok' }],
    globalAdvice: ['conseil'],
    safetyDisclaimer: 'disclaimer',
    officialSourceReminder: 'Vérifiez toujours les informations officielles sur diplomatie.gouv.fr avant votre départ.',
  };

  it('extrait narrativeText quand Claude le renvoie', async () => {
    createImpl = () => Promise.resolve({
      content: [{ text: JSON.stringify({ narrativeText: '**Le fil conducteur**\n\nÀ ton arrivée…', ...dayPayload }) }],
      stop_reason: 'end_turn',
    });
    const { generateItinerary } = await load();
    const result = await generateItinerary(itinReq);
    expect(result.narrativeText).toBeDefined();
    expect(result.narrativeText).toContain('fil conducteur');
    // Les jours structurés restent présents en parallèle (source d'autorité).
    expect(result.days).toHaveLength(1);
    expect(result.days[0].title).toBe('J1');
  });

  it('narrativeText absent → result.narrativeText undefined, days intacts (rétro-compatible)', async () => {
    createImpl = () => Promise.resolve({
      content: [{ text: JSON.stringify(dayPayload) }], // pas de narrativeText
      stop_reason: 'end_turn',
    });
    const { generateItinerary } = await load();
    const result = await generateItinerary(itinReq);
    expect(result.narrativeText).toBeUndefined();
    expect(result.days).toHaveLength(1);
    expect(result.globalAdvice).toContain('conseil');
  });

  it('narrativeText vide ou whitespace → traité comme absent (undefined)', async () => {
    createImpl = () => Promise.resolve({
      content: [{ text: JSON.stringify({ narrativeText: '   ', ...dayPayload }) }],
      stop_reason: 'end_turn',
    });
    const { generateItinerary } = await load();
    const result = await generateItinerary(itinReq);
    expect(result.narrativeText).toBeUndefined();
  });

  it('le fallback déterministe n\'a pas de narrativeText (rendu jour/jour assuré)', async () => {
    // Réponse JSON malformée → buildItineraryFallback, qui ne fournit pas de narrative.
    createImpl = () => Promise.resolve({ content: [{ text: 'pas du json' }], stop_reason: 'end_turn' });
    const { generateItinerary } = await load();
    const result = await generateItinerary(itinReq);
    expect(result.narrativeText).toBeUndefined();
    expect(result.days.length).toBeGreaterThan(0);
  });
});

// ── PREMIUM-GUIDE-001B (réouverture) — cache itinéraire versionné (H1) ──────────

describe('PREMIUM-GUIDE-001B — clé cache itinéraire versionnée (anti anciens JSON sans narrativeText)', () => {
  const itinReq = {
    countryCode: 'JP', countryName: 'Japon',
    from: '2026-09-01', to: '2026-09-08',
    budget: 2000, currency: 'EUR', travelers: 2, travelType: 'couple', preferences: [],
  } as never;

  const validJson = JSON.stringify({
    narrativeText: '**Le fil conducteur**\n\nÀ ton arrivée au Japon, je te conseille de commencer doucement.',
    days: [{ day: 1, title: 'J1', summary: 's', morning: 'm', afternoon: 'a', evening: 'e', estimatedBudget: '~80', safetyNote: 'ok' }],
    globalAdvice: ['conseil'],
    safetyDisclaimer: 'disclaimer',
    officialSourceReminder: 'Vérifiez toujours les informations officielles sur diplomatie.gouv.fr avant votre départ.',
  });

  it('la clé itinéraire inclut un segment de version narrative-v1', async () => {
    createImpl = () => Promise.resolve({ content: [{ text: validJson }], stop_reason: 'end_turn' });
    const { generateItinerary } = await load();
    await generateItinerary(itinReq);
    const itinKey = capturedCacheKeys.find((k) => k.includes('itinerary'));
    expect(itinKey).toBeDefined();
    expect(itinKey).toContain('narrative-v1');
  });

  it('le segment de version est présent dans la clé EFFECTIVEMENT stockée', async () => {
    createImpl = () => Promise.resolve({ content: [{ text: validJson }], stop_reason: 'end_turn' });
    const { generateItinerary } = await load();
    await generateItinerary(itinReq);
    const storedKey = storedCacheKeys.find((k) => k.includes('itinerary'));
    expect(storedKey).toBeDefined();
    expect(storedKey).toContain('narrative-v1');
  });
});

// ── PREMIUM-GUIDE-001B (réouverture) — prompt : narrativeText = livrable principal ──

describe('PREMIUM-GUIDE-001B — prompt itinéraire : narrativeText substantiel et prioritaire', () => {
  const src = readFileSync(resolve(process.cwd(), 'lib/claude/claude.service.ts'), 'utf-8');
  const itinBlock = src.slice(src.indexOf('export async function generateItinerary'));

  it('le prompt désigne narrativeText comme le LIVRABLE PRINCIPAL', () => {
    expect(itinBlock).toMatch(/LIVRABLE PRINCIPAL/);
  });

  it('le prompt impose un nombre de paragraphes mis à l\'échelle de la durée', () => {
    // La cible de paragraphes est interpolée depuis narrativeParagraphTarget.
    expect(itinBlock).toMatch(/narrativeParagraphTarget/);
    expect(itinBlock).toMatch(/paragraphes/i);
  });

  it('le prompt impose une cible de mots mise à l\'échelle de la durée', () => {
    expect(itinBlock).toMatch(/narrativeWordTarget/);
  });

  it('la cible de paragraphes croît avec la durée (court < long séjour)', () => {
    // Le service exporte la logique via une expression : court séjour 6, long séjour 10.
    expect(itinBlock).toMatch(/days <= 4 \? 6/);
    expect(itinBlock).toMatch(/: 10/);
  });

  it('le prompt emploie des formulations de guide humain (je te conseille / j\'éviterais)', () => {
    expect(itinBlock).toMatch(/je te conseille/i);
    expect(itinBlock).toMatch(/j'éviterais/i);
    expect(itinBlock).toMatch(/le bon compromis/i);
    expect(itinBlock).toMatch(/rythme le plus intelligent/i);
  });

  it('le prompt demande des transitions entre étapes et des alternatives (fatigue/météo/budget)', () => {
    expect(itinBlock).toMatch(/TRANSITIONS/i);
    expect(itinBlock).toMatch(/ALTERNATIVES/i);
    expect(itinBlock).toMatch(/fatigue/i);
    expect(itinBlock).toMatch(/météo/i);
  });

  it('le prompt demande d\'expliquer POURQUOI chaque étape est recommandée', () => {
    expect(itinBlock).toMatch(/POURQUOI/);
  });

  it('le prompt marque les days comme SECONDAIRES par rapport au narratif', () => {
    expect(itinBlock).toMatch(/SECONDAIRES/i);
  });

  it('le narratif reste dans le MÊME appel (max_tokens inchangé à 8000)', () => {
    const m = itinBlock.match(/max_tokens:\s*(\d+)/);
    expect(m).not.toBeNull();
    expect(Number(m![1])).toBe(8000);
  });
});

// ── PREMIUM-GUIDE-001B (réouverture) — diagnostic narrativeText insuffisant (point 5) ──

describe('PREMIUM-GUIDE-001B — diagnostic dev quand narrativeText absent/trop court', () => {
  const itinReq = {
    countryCode: 'JP', countryName: 'Japon',
    from: '2026-09-01', to: '2026-09-08',
    budget: 2000, currency: 'EUR', travelers: 2, travelType: 'couple', preferences: [],
  } as never;

  const dayPayload = {
    days: [{ day: 1, title: 'J1', summary: 's', morning: 'm', afternoon: 'a', evening: 'e', estimatedBudget: '~80', safetyNote: 'ok' }],
    globalAdvice: ['conseil'],
    safetyDisclaimer: 'disclaimer',
    officialSourceReminder: 'Vérifiez toujours les informations officielles sur diplomatie.gouv.fr avant votre départ.',
  };

  // Narratif réaliste > 200 mots (le plancher MIN_NARRATIVE_WORDS).
  const longNarrative =
    '**Le fil conducteur du séjour**\n\n' +
    Array.from({ length: 60 }, (_, i) => `phrase${i} de guide détaillée pour le voyageur`).join(' ') +
    '\n\n**Mon conseil final de guide**\n\nProfite bien et vérifie diplomatie.gouv.fr.';

  it('émet un warn quand une génération fraîche revient SANS narrativeText', async () => {
    createImpl = () => Promise.resolve({ content: [{ text: JSON.stringify(dayPayload) }], stop_reason: 'end_turn' });
    const { generateItinerary } = await load();
    await generateItinerary(itinReq);
    const warn = capturedWarns.find((w) => /narrativeText insuffisant/i.test(w));
    expect(warn).toBeDefined();
  });

  it('émet un warn quand le narrativeText est trop court', async () => {
    createImpl = () => Promise.resolve({
      content: [{ text: JSON.stringify({ narrativeText: 'Trop court.', ...dayPayload }) }],
      stop_reason: 'end_turn',
    });
    const { generateItinerary } = await load();
    await generateItinerary(itinReq);
    const warn = capturedWarns.find((w) => /narrativeText insuffisant/i.test(w));
    expect(warn).toBeDefined();
  });

  it('n\'émet PAS de warn quand le narrativeText est substantiel', async () => {
    createImpl = () => Promise.resolve({
      content: [{ text: JSON.stringify({ narrativeText: longNarrative, ...dayPayload }) }],
      stop_reason: 'end_turn',
    });
    const { generateItinerary } = await load();
    const result = await generateItinerary(itinReq);
    expect(result.narrativeText).toBeDefined();
    const warn = capturedWarns.find((w) => /narrativeText insuffisant/i.test(w));
    expect(warn).toBeUndefined();
  });

  it('le diagnostic ne lève JAMAIS d\'exception (rendu jour/jour reste un repli gracieux)', async () => {
    createImpl = () => Promise.resolve({ content: [{ text: JSON.stringify(dayPayload) }], stop_reason: 'end_turn' });
    const { generateItinerary } = await load();
    const result = await generateItinerary(itinReq);
    // Pas de narrativeText, mais les days du payload sont là et l'appel n'a pas throw.
    expect(result.narrativeText).toBeUndefined();
    expect(result.days).toHaveLength(dayPayload.days.length);
  });
});
