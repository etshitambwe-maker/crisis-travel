# PREMIUM-GUIDE-001C — Guide pays premium (Gate 2) — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ajouter un bloc « Guide pays premium » (texte de guide terrain en 8 sections) sous la narrative premium existante, généré on-demand côté client via une route dédiée, hybride Perplexity (faits frais) + Claude (rédaction), sans rien casser de l'existant.

**Architecture:** Option C hybride. Une nouvelle fonction `getPerplexityCountryFacts` (réutilise le pattern axios+Zod+withCache+fallback de `getPerplexityGeoScore`, cache ~6h) ramène des faits frais structurés. Une nouvelle fonction `generatePremiumCountryGuide` fait rédiger par Claude un guide terrain à partir de ces faits + scoreSnapshot + profil + liveRisks, en streaming avec hard timeout + garde anti-troncature + plancher mots + fallback honnête NON caché (cache versionné `guide-v1`). Une route premium-gated `/api/country-guide` (jamais SSR, `maxDuration=60`) orchestre. Un composant client `CountryGuideBlock` (idle/loading/success/échec+Réessayer) est monté additivement dans la section premium 07 de la page destination, sous la narrative. Aucun changement à l'itinéraire no-cards, au PDF, à Stripe/Supabase/quotas/pricing/safeNext/TARGET_COUNTRIES/CANDIDATE_CAP/analyze.

**Tech Stack:** Next.js 14 App Router, TypeScript strict, Zod, axios (OpenRouter sonar-pro), `@anthropic-ai/sdk` (claude-sonnet-4-6, streaming), Upstash Redis (withCache), Vitest.

**Conventions de test du repo (à respecter):**
- Tests **service** : mock `@anthropic-ai/sdk`, `@/lib/cache/redis`, `@/lib/utils/logger` ; piloter via `createImpl` ; asserter sur clés de cache capturées / warns. Voir `lib/claude/claude.test.ts`.
- Tests **route** : répliquer le schéma Zod en standalone (ne pas importer `next/server`) + source-assertion sur le gating auth/premium. Voir `__tests__/api/itinerary/itinerary.test.ts`.
- Tests **composant** : **source-assertion** (lire le fichier, asserter sur strings/testids), **pas de jsdom**. Voir `__tests__/components/ItineraryBlock.test.ts`.
- Pour axios : mock `axios` avec `vi.mock('axios', ...)`.

**Garde-fous contenu (dans le prompt Claude):** jamais d'adresse/prix/source officielle/règle locale inventée ; conditionnel quand les faits Perplexity sont faibles ; si Perplexity échoue → s'appuyer sur `score.liveRisks/recentEvents` et rester général ; jamais de promesse de sécurité absolue ; rappel diplomatie.gouv + Ariane.

**Invariants de non-régression (vérifiés en fin de plan):** `data-itinerary-build="guide-v1-no-cards"` inchangé ; aucun retour de DayCard / « Jour 1/2/3 » / « Matin/Après-midi/Soir » / accordéon / « À planifier selon vos préférences » ; PDF inchangé ; 579/579 tests existants verts.

---

## Task 1: Types `CountryFacts` et `PremiumCountryGuide`

**Files:**
- Modify: `types/api.types.ts` (ajouter `PerplexityCountryFacts`)
- Modify: `types/crisis.types.ts` (ajouter `PremiumCountryGuide`, `CountryGuideRequest`, `CountryGuideApiResponse`)
- Test: `__tests__/components/CountryGuideBlock.test.ts` (créé plus tard, Task 5) — pas de test dédié aux types (TS les vérifie via `tsc`).

**Step 1: Ajouter `PerplexityCountryFacts` dans `types/api.types.ts`**

Après `PerplexityGeoAnalysis` (ligne 27), ajouter :

```typescript
/**
 * PREMIUM-GUIDE-001C — Faits terrain frais ramenés par Perplexity (sonar-pro) pour
 * alimenter le guide pays premium. Distinct de PerplexityGeoAnalysis (qui sert le
 * scoring) : ici on veut des faits exploitables par un guide (où se baser, quoi éviter,
 * arnaques, habitudes locales), pas un score. Tous les tableaux peuvent être vides
 * (fallback propre) — le guide Claude dégrade alors vers du conditionnel.
 */
export interface PerplexityCountryFacts {
  /** Villes/quartiers/régions où un voyageur a intérêt à se baser. */
  whereToStay: string[];
  /** Zones ou situations à éviter (sécurité spatiale, contextes). */
  zonesToAvoid: string[];
  /** Arnaques fréquentes connues pour cette destination. */
  commonScams: string[];
  /** Erreurs classiques que font les voyageurs ici. */
  classicMistakes: string[];
  /** Habitudes / codes de comportement locaux utiles à connaître. */
  localCustoms: string[];
  /** Conseils terrain divers, concrets. */
  fieldTips: string[];
}
```

**Step 2: Ajouter les types guide dans `types/crisis.types.ts`**

À la fin du fichier (après les helpers, ou regroupé avec les types Itinerary), ajouter :

```typescript
// ── Premium Country Guide types (PREMIUM-GUIDE-001C) ─────────────────────────

export interface CountryGuideRequest {
  countryCode: string;
  countryName: string;
  travelType?: 'solo' | 'couple' | 'family' | 'nomad';
  budget?: number;
  duration?: number;
}

export interface PremiumCountryGuide {
  countryCode: string;
  countryName: string;
  /**
   * Texte de guide terrain en markdown léger (8 sections, titres **gras** +
   * paragraphes/listes), rendu via NarrativeRenderer. UNIQUE livrable de contenu.
   */
  guideText: string;
  generatedAt: string;
  /**
   * true UNIQUEMENT pour le repli honnête (génération échouée/timeout). Permet à
   * CountryGuideBlock d'afficher un état « génération trop longue + Réessayer » au
   * lieu d'un faux guide. Absent/false = vrai guide généré.
   */
  isFallback?: boolean;
}

export interface CountryGuideApiResponse {
  guide: PremiumCountryGuide;
  meta: {
    premiumOnly: true;
    source: 'ai';
    /** 'live' si les faits Perplexity ont été utilisés ; 'derived' si fallback score. */
    factsSource: 'live' | 'derived';
  };
}
```

**Step 3: Vérifier que `tsc` compile**

Run: `npx tsc --noEmit`
Expected: PASS (aucune erreur — types additifs uniquement).

**Step 4: Commit**

```bash
git add types/api.types.ts types/crisis.types.ts
git commit -m "feat(guide): add CountryFacts and PremiumCountryGuide types (PREMIUM-GUIDE-001C)"
```

---

## Task 2: `getPerplexityCountryFacts` (service Perplexity facts)

**Files:**
- Modify: `lib/services/geopolitical/perplexity.service.ts` (AJOUT d'une fonction + schéma ; ne PAS toucher `getPerplexityGeoScore`)
- Test: `lib/services/geopolitical/perplexityCountryFacts.test.ts` (créer)

**Step 1: Écrire les tests qui échouent**

Créer `lib/services/geopolitical/perplexityCountryFacts.test.ts` :

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock axios pour piloter la réponse OpenRouter.
let postImpl: () => Promise<unknown>;
vi.mock('axios', () => ({
  default: { post: (...args: unknown[]) => postImpl() },
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
  fieldTips: ['SIM locale à l\'aéroport'],
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
});
```

**Step 2: Lancer les tests pour vérifier l'échec**

Run: `npx vitest run lib/services/geopolitical/perplexityCountryFacts.test.ts`
Expected: FAIL (`getPerplexityCountryFacts` n'existe pas).

**Step 3: Implémenter `getPerplexityCountryFacts`**

Dans `lib/services/geopolitical/perplexity.service.ts`, importer le nouveau type et ajouter (SANS toucher `getPerplexityGeoScore`) :

```typescript
import type { PerplexityCountryFacts } from '@/types/api.types';

const CountryFactsSchema = z.object({
  whereToStay: z.array(z.string()).max(8).default([]),
  zonesToAvoid: z.array(z.string()).max(8).default([]),
  commonScams: z.array(z.string()).max(8).default([]),
  classicMistakes: z.array(z.string()).max(8).default([]),
  localCustoms: z.array(z.string()).max(8).default([]),
  fieldTips: z.array(z.string()).max(8).default([]),
});

const FACTS_FALLBACK: PerplexityCountryFacts = {
  whereToStay: [], zonesToAvoid: [], commonScams: [],
  classicMistakes: [], localCustoms: [], fieldTips: [],
};

function buildFactsPrompt(country: string): string {
  return `Tu es un conseiller de voyage. Donne des FAITS TERRAIN concrets et actuels sur ${country} pour un voyageur français, utiles pour préparer un séjour.

Retourne UNIQUEMENT ce JSON valide, sans markdown ni texte avant/après. Chaque tableau : 2 à 5 entrées courtes (une phrase max). Si tu n'es pas sûr, laisse le tableau vide plutôt que d'inventer :
{"whereToStay":["<ville/quartier où se baser>"],"zonesToAvoid":["<zone/situation à éviter>"],"commonScams":["<arnaque fréquente>"],"classicMistakes":["<erreur classique de voyageur>"],"localCustoms":["<habitude/code local>"],"fieldTips":["<conseil terrain concret>"]}`;
}

/**
 * PREMIUM-GUIDE-001C — Faits terrain frais (où se baser, quoi éviter, arnaques,
 * erreurs, habitudes, conseils) pour alimenter le guide pays premium. Distinct de
 * getPerplexityGeoScore (chemin critique /api/analyze) : fonction séparée, prompt et
 * schéma propres, cache LONG (6h). Ne jette jamais : fallback listes vides → le guide
 * Claude dégrade vers du conditionnel.
 */
export async function getPerplexityCountryFacts(
  countryCode: string,
  countryName: string,
): Promise<ServiceResult<PerplexityCountryFacts>> {
  const apiKey = process.env.OPENROUTER_API_KEY ?? '';
  if (!apiKey || apiKey.length < 20) {
    return { data: FACTS_FALLBACK, source: 'fallback' };
  }

  const cacheKey = buildCacheKey('country-facts', countryCode, 'guide-v1');
  try {
    const { data } = await withCache(
      cacheKey,
      async () => {
        const t0 = Date.now();
        const res = await axios.post(
          'https://openrouter.ai/api/v1/chat/completions',
          {
            model: 'perplexity/sonar-pro',
            messages: [{ role: 'user', content: buildFactsPrompt(countryName) }],
            max_tokens: 700,
          },
          {
            headers: {
              Authorization: `Bearer ${apiKey}`,
              'HTTP-Referer': 'https://crisis-travel.app',
              'X-Title': 'Crisis Travel',
            },
            timeout: 7000,
          },
        );
        logger.api('Perplexity-Facts', countryCode, Date.now() - t0, false);
        const text = res.data.choices[0].message.content as string;
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error('No JSON in facts response');
        const parsed = JSON.parse(jsonMatch[0]);
        return CountryFactsSchema.parse(parsed) as PerplexityCountryFacts;
      },
      21600, // 6h — faits semi-stables
    );
    return { data, source: 'live' };
  } catch (error) {
    logger.error('Perplexity-Facts', error);
    return { data: FACTS_FALLBACK, source: 'fallback', error: String(error) };
  }
}
```

> Note: le regex d'extraction est `\{[\s\S]*\}` (greedy, capture l'objet complet), pas `\{[\s\S]*?\}` (lazy, qui couperait au premier `}`). Le service de score utilise le lazy car son JSON est plat ; ici les tableaux ne contiennent pas d'accolades imbriquées donc greedy est sûr et capture tout l'objet.

**Step 4: Lancer les tests pour vérifier le succès**

Run: `npx vitest run lib/services/geopolitical/perplexityCountryFacts.test.ts`
Expected: PASS (6 tests).

**Step 5: Vérifier que `getPerplexityGeoScore` n'a pas régressé**

Run: `npx vitest run lib/services/scoring/crisisScore.test.ts lib/services/scoring/crisisScore.liveRisks.test.ts`
Expected: PASS (inchangés).

**Step 6: Commit**

```bash
git add lib/services/geopolitical/perplexity.service.ts lib/services/geopolitical/perplexityCountryFacts.test.ts
git commit -m "feat(guide): add getPerplexityCountryFacts (fresh field facts, 6h cache) (PREMIUM-GUIDE-001C)"
```

---

## Task 3: `generatePremiumCountryGuide` (service Claude guide)

**Files:**
- Modify: `lib/claude/claude.service.ts` (AJOUT d'une fonction ; ne PAS toucher `generateItinerary`, `generateDestinationNarrative`)
- Test: `lib/claude/countryGuide.test.ts` (créer — fichier séparé pour ne pas alourdir claude.test.ts)

**Step 1: Écrire les tests qui échouent**

Créer `lib/claude/countryGuide.test.ts`. Réutilise EXACTEMENT le pattern de mock de `claude.test.ts` (mêmes mocks SDK/redis/logger) :

```typescript
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

// Un faux guide assez long pour passer le plancher de mots.
const LONG_GUIDE = '**Vue d\'ensemble**\n\n' + Array(60).fill('mot').join(' ') + '\n\n**Conseil final**\n\n' + Array(60).fill('mot').join(' ');

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

  it('sans clé API → fallback (pas d\'appel)', async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const { generatePremiumCountryGuide } = await load();
    const guide = await generatePremiumCountryGuide(makeScore(), facts, profile);
    expect(guide.isFallback).toBe(true);
  });
});
```

**Step 2: Lancer les tests pour vérifier l'échec**

Run: `npx vitest run lib/claude/countryGuide.test.ts`
Expected: FAIL (`generatePremiumCountryGuide` n'existe pas).

**Step 3: Implémenter `generatePremiumCountryGuide`**

Dans `lib/claude/claude.service.ts`, ajouter les imports et la fonction (réutilise `client`, `withCache`, `buildCacheKey`, `logger` déjà importés ; ne touche RIEN d'existant) :

```typescript
import type { PerplexityCountryFacts } from '@/types/api.types';
import type { PremiumCountryGuide } from '@/types/crisis.types';

// PREMIUM-GUIDE-001C — guide pays premium.
const GUIDE_HARD_TIMEOUT_MS = 45000;
const GUIDE_MIN_WORDS = 250;

type GuideProfile = { travelType?: 'solo' | 'couple' | 'family' | 'nomad'; budget?: number; duration?: number };

function buildGuideFallback(score: CrisisScore): PremiumCountryGuide {
  return {
    countryCode: score.countryCode,
    countryName: score.country,
    guideText: '',
    generatedAt: new Date().toISOString(),
    isFallback: true,
  };
}

/** Bloc « faits frais » injecté dans le prompt ; vide si Perplexity en fallback. */
function buildFactsBlock(facts: PerplexityCountryFacts): string {
  const sections: Array<[string, string[]]> = [
    ['Où se baser', facts.whereToStay],
    ['Zones/situations à éviter', facts.zonesToAvoid],
    ['Arnaques fréquentes', facts.commonScams],
    ['Erreurs classiques', facts.classicMistakes],
    ['Habitudes locales', facts.localCustoms],
    ['Conseils terrain', facts.fieldTips],
  ];
  const lines = sections
    .filter(([, items]) => items.length > 0)
    .map(([label, items]) => `- ${label} : ${items.join(' ; ')}`);
  return lines.length > 0
    ? `FAITS TERRAIN VÉRIFIÉS (utilise-les en priorité, reformule, ne recopie pas) :\n${lines.join('\n')}`
    : `AUCUN FAIT TERRAIN FRAIS DISPONIBLE : reste plus général et emploie le conditionnel ; ne donne aucun nom de quartier/arnaque dont tu n'es pas sûr.`;
}

export async function generatePremiumCountryGuide(
  score: CrisisScore,
  facts: PerplexityCountryFacts,
  profile: GuideProfile,
): Promise<PremiumCountryGuide> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return buildGuideFallback(score);
  }

  const travelType = profile.travelType ?? 'solo';
  const liveRisksLine = (score.liveRisks ?? []).length > 0
    ? `Risques terrain remontés par nos sources : ${(score.liveRisks ?? []).join(' ; ')}.`
    : '';
  const meaeRaw = score.security.details.meaeLevel;
  const meaeLevel = typeof meaeRaw === 'number' ? meaeRaw : parseInt(String(meaeRaw ?? '2'), 10) || 2;

  const cacheKey = buildCacheKey(
    'country-guide',
    score.countryCode,
    travelType,
    String(Math.floor(score.total / 5)),
    'guide-v1',
  );

  const prompt = `Tu es un guide de voyage humain et expérimenté qui connaît ${score.country}. Rédige, EN TEXTE (pas de JSON), un GUIDE PAYS premium pour un voyageur ${travelType}${profile.budget ? `, budget ~${profile.budget}€` : ''}${profile.duration ? `, ${profile.duration} jours` : ''}.

Ce n'est PAS un rapport de score : c'est un guide terrain, comme si tu briefais un ami avant son départ. Tutoiement, ton chaleureux mais sobre, prends position.

Contexte objectif (à intégrer, pas à réciter) :
- CrisisScore ${score.total}/100 (${score.status}) — sécurité ${score.security.value}, géopolitique ${score.geopolitical.value}, budget ${score.budget.value}, praticité ${score.practicality.value}.
- Niveau de vigilance MEAE ${meaeLevel}/4.
- Repas bon marché ~${score.budget.details.mealCheap ?? 'N/A'}€, hôtel moyen ~${score.budget.details.hotelAvg ?? 'N/A'}€/nuit.
${liveRisksLine}

${buildFactsBlock(facts)}

STRUCTURE — 8 sections, chacune un titre court en gras puis 1-2 paragraphes (ou une courte liste) :
**1. Vue d'ensemble & avant de partir**
**2. Culture & comportements locaux**
**3. Où se baser / zones à privilégier**
**4. Zones ou situations à éviter**
**5. Sécurité terrain & vigilance concrète** (cohérente avec MEAE ${meaeLevel}/4, sans dramatiser ni promettre une sécurité absolue)
**6. Arnaques fréquentes & erreurs classiques**
**7. Budget, confort & logistique**
**8. Conseils selon profil ${travelType} + mon conseil final de guide**

RÈGLES ABSOLUES :
1. N'invente JAMAIS une adresse, un prix précis, une source officielle ou une règle locale.
2. Quand tu n'as pas de fait sûr, emploie le conditionnel (« tu trouveras généralement », « il vaut mieux »).
3. Ne promets pas de sécurité absolue ; rappelle de vérifier diplomatie.gouv.fr et de s'inscrire sur Ariane.
4. Aucun numéro de téléphone ni prix garanti.
5. Reste CONCIS : ~350-500 mots au total, dense et utile, pas de remplissage.

Réponds UNIQUEMENT avec le texte du guide en markdown (titres en gras + paragraphes). Commence directement par "**1. Vue d'ensemble".`;

  try {
    const { data } = await withCache(
      cacheKey,
      async () => {
        const t0 = Date.now();
        let timer: ReturnType<typeof setTimeout> | undefined;
        const stream = client.messages.stream({
          model: 'claude-sonnet-4-6',
          max_tokens: 2200,
          messages: [{ role: 'user', content: prompt }],
        });
        const hardTimeout = new Promise<never>((_, reject) => {
          timer = setTimeout(() => {
            stream.abort();
            reject(new Error(`country-guide hard timeout ${GUIDE_HARD_TIMEOUT_MS}ms`));
          }, GUIDE_HARD_TIMEOUT_MS);
        });
        try {
          const msg = await Promise.race([stream.finalMessage(), hardTimeout]);
          if ((msg as { stop_reason?: string }).stop_reason === 'max_tokens') {
            throw new Error('country-guide: réponse tronquée (stop_reason=max_tokens)');
          }
          const text = (msg.content[0] as { text: string }).text.trim();
          const wordCount = text ? text.split(/\s+/).filter(Boolean).length : 0;
          if (wordCount < GUIDE_MIN_WORDS) {
            throw new Error(`country-guide: trop court (${wordCount} mots < ${GUIDE_MIN_WORDS})`);
          }
          logger.api('Claude-CountryGuide', score.countryCode, Date.now() - t0, false);
          return text;
        } finally {
          if (timer) clearTimeout(timer);
        }
      },
      21600, // 6h
    );

    return {
      countryCode: score.countryCode,
      countryName: score.country,
      guideText: data,
      generatedAt: new Date().toISOString(),
    };
  } catch (error) {
    logger.error('Claude-CountryGuide', error);
    logger.warn(
      'Claude-CountryGuide',
      `guide fallback honnête retourné (NON caché) pour ${score.countryCode} — cause: ${error instanceof Error ? error.message : 'inconnue'}`,
    );
    return buildGuideFallback(score);
  }
}
```

**Step 4: Lancer les tests pour vérifier le succès**

Run: `npx vitest run lib/claude/countryGuide.test.ts`
Expected: PASS (8 tests).

**Step 5: Vérifier que claude.test.ts (itinéraire/narrative) n'a pas régressé**

Run: `npx vitest run lib/claude/claude.test.ts`
Expected: PASS (63 tests inchangés).

**Step 6: Commit**

```bash
git add lib/claude/claude.service.ts lib/claude/countryGuide.test.ts
git commit -m "feat(guide): add generatePremiumCountryGuide (hybrid facts+score, streaming, honest fallback) (PREMIUM-GUIDE-001C)"
```

---

## Task 4: Route `/api/country-guide`

**Files:**
- Create: `app/api/country-guide/route.ts`
- Test: `__tests__/api/country-guide/country-guide.test.ts` (créer)

**Step 1: Écrire les tests qui échouent**

Créer `__tests__/api/country-guide/country-guide.test.ts`. Suivre le pattern `itinerary.test.ts` : répliquer le schéma Zod en standalone + source-assertions sur le gating.

```typescript
import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const ROUTE_PATH = 'app/api/country-guide/route.ts';
function readRoute(): string { return readFileSync(resolve(process.cwd(), ROUTE_PATH), 'utf-8'); }

// Réplique du schéma de la route (sans importer next/server).
const schema = z.object({
  countryCode: z.string().min(2).max(3).toUpperCase(),
  countryName: z.string().min(1).max(100),
  travelType: z.enum(['solo', 'couple', 'family', 'nomad']).optional(),
  budget: z.number().positive().max(1_000_000).optional(),
  duration: z.number().int().min(1).max(365).optional(),
});

describe('country-guide route — validation Zod', () => {
  it('accepte un payload valide', () => {
    expect(schema.safeParse({ countryCode: 'PT', countryName: 'Portugal', travelType: 'solo' }).success).toBe(true);
  });
  it('rejette countryCode absent', () => {
    expect(schema.safeParse({ countryName: 'Portugal' }).success).toBe(false);
  });
  it('rejette travelType invalide', () => {
    expect(schema.safeParse({ countryCode: 'PT', countryName: 'Portugal', travelType: 'business' }).success).toBe(false);
  });
});

describe('country-guide route — structure & gating', () => {
  it('le fichier route existe', () => {
    expect(existsSync(resolve(process.cwd(), ROUTE_PATH))).toBe(true);
  });
  it('vérifie l\'authentification (401)', () => {
    const src = readRoute();
    expect(src).toContain('getUserWithSubscription');
    expect(src).toContain('401');
  });
  it('gate premium (402)', () => {
    const src = readRoute();
    expect(src).toContain('402');
    expect(src).toContain('isPremium');
  });
  it('appelle les deux services hybrides', () => {
    const src = readRoute();
    expect(src).toContain('getPerplexityCountryFacts');
    expect(src).toContain('generatePremiumCountryGuide');
  });
  it('déclare maxDuration', () => {
    expect(readRoute()).toContain('maxDuration');
  });
  it('ne génère pas en SSR (POST handler uniquement)', () => {
    const src = readRoute();
    expect(src).toContain('export async function POST');
    expect(src).not.toContain('export async function GET');
  });
});
```

**Step 2: Lancer pour vérifier l'échec**

Run: `npx vitest run __tests__/api/country-guide/country-guide.test.ts`
Expected: FAIL (route inexistante).

**Step 3: Implémenter la route**

Créer `app/api/country-guide/route.ts` :

```typescript
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getUserWithSubscription } from '@/lib/auth/supabase-server';
import { getPerplexityCountryFacts } from '@/lib/services/geopolitical/perplexity.service';
import { generatePremiumCountryGuide } from '@/lib/claude/claude.service';
import { calculateCrisisScore } from '@/lib/services/scoring/crisisScore.service';
import { findCountry } from '@/lib/utils/countries';
import type { CountryGuideApiResponse } from '@/types/crisis.types';

// PREMIUM-GUIDE-001C — génération on-demand (jamais SSR). Perplexity + Claude en chaîne
// peuvent dépasser le défaut Vercel ; 60s = plafond du plan (pas une garantie).
export const maxDuration = 60;

const schema = z.object({
  countryCode: z.string().min(2).max(3).toUpperCase(),
  countryName: z.string().min(1).max(100),
  travelType: z.enum(['solo', 'couple', 'family', 'nomad']).optional(),
  budget: z.number().positive().max(1_000_000).optional(),
  duration: z.number().int().min(1).max(365).optional(),
});

export async function POST(request: Request): Promise<NextResponse> {
  const { user, isPremium } = await getUserWithSubscription();
  if (!user) {
    return NextResponse.json({ error: 'Authentification requise' }, { status: 401 });
  }
  if (!isPremium) {
    return NextResponse.json(
      { error: 'Guide pays disponible avec le plan Premium', upgradeUrl: '/pricing' },
      { status: 402 },
    );
  }

  const contentLength = Number(request.headers.get('content-length') ?? 0);
  if (contentLength > 10_240) {
    return NextResponse.json({ error: 'Payload trop volumineux' }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON invalide' }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Paramètres invalides', details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  try {
    const country = findCountry(parsed.data.countryCode);
    if (!country) {
      return NextResponse.json({ error: 'Destination inconnue' }, { status: 400 });
    }

    // Score recalculé côté serveur (jamais fait confiance au client pour le snapshot).
    const profile = {
      departureCountry: 'FR',
      budget: parsed.data.budget ?? 1500,
      duration: parsed.data.duration ?? 7,
      period: 'flexible',
      travelType: parsed.data.travelType ?? ('solo' as const),
      mode: 'standard' as const,
    };
    const score = await calculateCrisisScore(country, profile);

    const factsResult = await getPerplexityCountryFacts(parsed.data.countryCode, parsed.data.countryName);
    const guide = await generatePremiumCountryGuide(score, factsResult.data, {
      travelType: profile.travelType,
      budget: profile.budget,
      duration: profile.duration,
    });

    const response: CountryGuideApiResponse = {
      guide,
      meta: { premiumOnly: true, source: 'ai', factsSource: factsResult.source === 'live' ? 'live' : 'derived' },
    };
    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error('[API/country-guide]', error);
    return NextResponse.json({ error: 'Erreur lors de la génération du guide' }, { status: 500 });
  }
}
```

> Note: `calculateCrisisScore` est appelé ici comme dans `page.tsx` (`getData`). Cela recalcule le score côté serveur — légèrement coûteux mais déjà caché (sous-scores en Redis) et garantit un snapshot fiable. **Ce n'est PAS `/api/analyze`** (on ne touche pas ce chemin) : on réutilise la fonction de scoring partagée, comme le fait déjà la page destination. Vérifier que `findCountry` est bien le helper utilisé par `page.tsx` (`@/lib/utils/countries`).

**Step 4: Lancer pour vérifier le succès**

Run: `npx vitest run __tests__/api/country-guide/country-guide.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add app/api/country-guide/route.ts __tests__/api/country-guide/country-guide.test.ts
git commit -m "feat(guide): add premium-gated /api/country-guide route (on-demand, no SSR) (PREMIUM-GUIDE-001C)"
```

---

## Task 5: Composant `CountryGuideBlock`

**Files:**
- Create: `components/crisis/CountryGuideBlock.tsx`
- Test: `__tests__/components/CountryGuideBlock.test.ts` (créer — source-assertion, pas de jsdom)

**Step 1: Écrire les tests qui échouent**

Créer `__tests__/components/CountryGuideBlock.test.ts` :

```typescript
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const PATH = 'components/crisis/CountryGuideBlock.tsx';
function src(): string { return readFileSync(resolve(process.cwd(), PATH), 'utf-8'); }

describe('CountryGuideBlock — présence & structure', () => {
  it('le fichier existe', () => {
    expect(existsSync(resolve(process.cwd(), PATH))).toBe(true);
  });
  it('est un client component', () => {
    expect(src().trimStart()).toMatch(/^['"]use client['"]/);
  });
  it('exporte CountryGuideBlock', () => {
    expect(src()).toContain('export function CountryGuideBlock');
  });
  it('appelle /api/country-guide', () => {
    expect(src()).toContain('/api/country-guide');
  });
  it('a un bouton de génération (idle)', () => {
    expect(src()).toContain('data-testid="country-guide-generate-btn"');
  });
  it('gère l\'état loading', () => {
    expect(src()).toMatch(/loading/);
  });
  it('rend le succès via NarrativeRenderer', () => {
    expect(src()).toContain('NarrativeRenderer');
    expect(src()).toContain('data-testid="country-guide-result"');
  });
  it('gère l\'état fallback/échec avec Réessayer', () => {
    const s = src();
    expect(s).toContain('data-testid="country-guide-fallback"');
    expect(s.toLowerCase()).toContain('réessayer');
  });
  it('ne crashe pas si guideText absent (garde isFallback)', () => {
    expect(src()).toContain('isFallback');
  });
});

describe('CountryGuideBlock — invariants no-cards (non-régression)', () => {
  it('ne réintroduit AUCUNE carte jour/jour ni slot horaire', () => {
    const s = src();
    expect(s).not.toContain('À planifier selon vos préférences');
    expect(s).not.toMatch(/Jour\s*\{?\s*\d/);
    expect(s).not.toContain('morning');
    expect(s).not.toContain('afternoon');
    expect(s).not.toContain('evening');
    expect(s).not.toContain('DayCard');
  });
});
```

**Step 2: Lancer pour vérifier l'échec**

Run: `npx vitest run __tests__/components/CountryGuideBlock.test.ts`
Expected: FAIL (composant inexistant).

**Step 3: Implémenter le composant**

Créer `components/crisis/CountryGuideBlock.tsx` (calqué sur `ItineraryBlock` : états idle/loading/success/erreur, fetch on-demand). Réutilise `NarrativeRenderer` pour le rendu succès.

```tsx
'use client';
// ─────────────────────────────────────────────────────────────────────────────
// CountryGuideBlock (PREMIUM-GUIDE-001C)
//
// Bloc premium ADDITIF « Guide pays » sous la narrative. Génération ON-DEMAND
// (clic → POST /api/country-guide), jamais en SSR. Quatre états : idle / loading /
// success (texte de guide via NarrativeRenderer) / échec honnête + Réessayer.
//
// NE réintroduit aucune carte jour/jour ni slot matin/après-midi/soir : le guide est
// un texte continu, comme GuideItinerarySection — mais pour le PAYS, pas l'itinéraire.
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from 'react';
import type { CountryGuideApiResponse, CountryGuideRequest } from '@/types/crisis.types';
import { NarrativeRenderer } from './NarrativeRenderer';

type Status = 'idle' | 'loading' | 'success' | 'error';

export interface CountryGuideBlockProps {
  countryCode: string;
  countryName: string;
  travelType?: 'solo' | 'couple' | 'family' | 'nomad';
  budget?: number;
  duration?: number;
}

export function CountryGuideBlock(props: CountryGuideBlockProps) {
  const [status, setStatus] = useState<Status>('idle');
  const [guide, setGuide] = useState<CountryGuideApiResponse['guide'] | null>(null);

  async function generate() {
    if (status === 'loading') return;
    setStatus('loading');
    setGuide(null);
    try {
      const body: CountryGuideRequest = {
        countryCode: props.countryCode,
        countryName: props.countryName,
        travelType: props.travelType,
        budget: props.budget,
        duration: props.duration,
      };
      const res = await fetch('/api/country-guide', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      let json: CountryGuideApiResponse | null = null;
      try { json = (await res.json()) as CountryGuideApiResponse; } catch { json = null; }

      if (res.ok && json?.guide && !json.guide.isFallback && json.guide.guideText) {
        setGuide(json.guide);
        setStatus('success');
        return;
      }
      // Tout le reste (fallback, 4xx/5xx, JSON nul) → état échec honnête.
      setStatus('error');
    } catch {
      setStatus('error');
    }
  }

  return (
    <div
      data-testid="country-guide-block"
      data-country-guide-build="guide-v1"
      style={{
        border: '1px solid var(--ctv3-line)',
        borderTop: '2px solid var(--ctv3-blue)',
        background: 'var(--ctv3-ink-850)',
        padding: '20px 20px 18px',
        marginTop: 18,
      }}
    >
      <div style={{ marginBottom: 14 }}>
        <span className="ctv3-mono" style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          fontSize: 10, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'var(--ctv3-blue)',
        }}>
          <span style={{ width: 14, height: 1, background: 'currentColor', opacity: 0.6 }} />
          Premium · Guide pays
        </span>
        <h2 style={{
          fontFamily: 'var(--ctv3-display)', fontWeight: 800, fontSize: 19,
          letterSpacing: '-0.02em', color: 'var(--ctv3-paper)', margin: '8px 0 4px',
        }}>
          Guide terrain · {props.countryName}
        </h2>
        <p className="ctv3-serif" style={{ fontSize: 13.5, color: 'var(--ctv3-muted)', lineHeight: 1.45, margin: 0 }}>
          Un brief de guide avant le départ : où se baser, quoi éviter, arnaques et erreurs classiques. Généré par IA, à vérifier avec les sources officielles.
        </p>
      </div>

      {status === 'idle' && (
        <button
          data-testid="country-guide-generate-btn"
          onClick={generate}
          className="ctv3-mono"
          style={{
            padding: '11px 22px', cursor: 'pointer', background: 'var(--ctv3-blue)',
            border: 'none', color: '#fff', fontSize: 11, letterSpacing: '0.12em',
            fontWeight: 700, textTransform: 'uppercase', width: '100%', maxWidth: 320,
          }}
        >
          Générer le guide pays →
        </button>
      )}

      {status === 'loading' && (
        <div data-testid="country-guide-loading" aria-busy="true" className="ctv3-mono"
          style={{ fontSize: 11, letterSpacing: '0.1em', color: 'var(--ctv3-muted)', textTransform: 'uppercase', padding: '8px 0' }}>
          Génération du guide en cours… cela peut prendre quelques secondes.
        </div>
      )}

      {status === 'error' && (
        <div data-testid="country-guide-fallback" style={{
          background: 'var(--ctv3-ink-900)', border: '1px solid var(--ctv3-line-bright)',
          borderLeft: '2px solid var(--ctv3-reco)', padding: '16px 18px',
        }}>
          <div className="ctv3-mono" style={{ fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--ctv3-reco)', marginBottom: 8 }}>
            Génération incomplète
          </div>
          <p className="ctv3-serif" style={{ fontSize: 14, color: 'var(--ctv3-paper)', lineHeight: 1.55, margin: '0 0 14px' }}>
            La génération du guide a pris trop de temps ou n&apos;a pas pu aboutir. Relance — elle aboutit généralement à la seconde tentative.
          </p>
          <button
            data-testid="country-guide-retry-btn"
            onClick={generate}
            className="ctv3-mono"
            style={{
              padding: '10px 18px', cursor: 'pointer', background: 'var(--ctv3-blue)',
              border: 'none', color: '#fff', fontSize: 11, letterSpacing: '0.12em', fontWeight: 700, textTransform: 'uppercase',
            }}
          >
            Réessayer →
          </button>
        </div>
      )}

      {status === 'success' && guide && !guide.isFallback && (
        <div data-testid="country-guide-result">
          <NarrativeRenderer narrative={guide.guideText} />
          <button
            onClick={generate}
            className="ctv3-mono"
            style={{
              marginTop: 12, padding: '9px 16px', cursor: 'pointer', background: 'none',
              border: '1px solid var(--ctv3-line)', color: 'var(--ctv3-muted)',
              fontSize: 10, letterSpacing: '0.1em', fontWeight: 700, textTransform: 'uppercase',
            }}
          >
            Regénérer le guide
          </button>
        </div>
      )}
    </div>
  );
}
```

**Step 4: Lancer pour vérifier le succès**

Run: `npx vitest run __tests__/components/CountryGuideBlock.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add components/crisis/CountryGuideBlock.tsx __tests__/components/CountryGuideBlock.test.ts
git commit -m "feat(guide): add CountryGuideBlock UI (idle/loading/success/fallback, no cards) (PREMIUM-GUIDE-001C)"
```

---

## Task 6: Intégration additive dans la page destination

**Files:**
- Modify: `app/destination/[country]/page.tsx` (AJOUT minimal : import + montage dans le gate premium 07, sous `PremiumActions`)
- Test: `__tests__/components/DestinationPremiumFlow.test.ts` (étendre : asserter que la page monte `CountryGuideBlock` sous la narrative et n'a pas retiré l'existant)

**Step 1: Écrire/étendre le test (source-assertion sur page.tsx)**

Ajouter au fichier `__tests__/components/DestinationPremiumFlow.test.ts` un bloc :

```typescript
import { readFileSync } from 'fs';
import { resolve } from 'path';
const PAGE = 'app/destination/[country]/page.tsx';
const pageSrc = () => readFileSync(resolve(process.cwd(), PAGE), 'utf-8');

describe('Destination page — guide pays additif (PREMIUM-GUIDE-001C)', () => {
  it('importe et monte CountryGuideBlock', () => {
    const s = pageSrc();
    expect(s).toContain('CountryGuideBlock');
  });
  it('conserve la narrative premium existante (NarrativeRenderer)', () => {
    expect(pageSrc()).toContain('NarrativeRenderer');
  });
  it('conserve PremiumActions (itinéraire + PDF)', () => {
    expect(pageSrc()).toContain('PremiumActions');
  });
  it('CountryGuideBlock est dans le gate premium (rendu après PremiumActions)', () => {
    const s = pageSrc();
    expect(s.indexOf('PremiumActions')).toBeLessThan(s.indexOf('CountryGuideBlock'));
  });
});
```

> Vérifier d'abord le nom exact du `describe`/imports existants dans ce fichier et adapter (ne pas dupliquer les imports `describe/it/expect`).

**Step 2: Lancer pour vérifier l'échec**

Run: `npx vitest run __tests__/components/DestinationPremiumFlow.test.ts`
Expected: FAIL (CountryGuideBlock pas encore monté).

**Step 3: Modifier `page.tsx` (montage additif)**

1. Ajouter l'import (près des autres imports composants, ~ligne 23) :
```typescript
import { CountryGuideBlock } from '@/components/crisis/CountryGuideBlock';
```

2. Dans le `children` du `PremiumGate` (section 07), **après** `<PremiumActions ... />` (ligne ~647), ajouter :
```tsx
{/* PREMIUM-GUIDE-001C — Guide pays premium ADDITIF, sous la narrative + actions.
    Génération on-demand (client) via /api/country-guide ; ne remplace rien. */}
<CountryGuideBlock
  countryCode={score.countryCode}
  countryName={score.country}
  travelType="solo"
/>
```

> `travelType="solo"` est figé comme partout ailleurs dans cette page (cohérent avec `getData`/`PremiumActions`). budget/duration omis → la route utilise ses défauts (1500/7).

**Step 4: Lancer pour vérifier le succès**

Run: `npx vitest run __tests__/components/DestinationPremiumFlow.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add app/destination/[country]/page.tsx __tests__/components/DestinationPremiumFlow.test.ts
git commit -m "feat(guide): mount CountryGuideBlock additively under premium narrative (PREMIUM-GUIDE-001C)"
```

---

## Task 7: Vérification globale + non-régression + build

**Step 1: `tsc` complet**

Run: `npx tsc --noEmit`
Expected: PASS (0 erreur).

**Step 2: Suite de tests complète**

Run: `npx vitest run`
Expected: PASS — **579 (existants) + ~30 nouveaux**, 0 échec. Noter le total exact.

**Step 3: Non-régression itinéraire no-cards (assertions explicites)**

Run: `npx vitest run __tests__/components/ItineraryBlock.test.ts`
Expected: PASS — `data-itinerary-build="guide-v1-no-cards"` toujours présent, aucune carte réintroduite.

**Step 4: Build production**

Run: `npm run build`
Expected: PASS — la route `/api/country-guide` apparaît dans la sortie, build sans erreur.

**Step 5: Audit du diff (hors-scope = échec)**

Run: `git diff main --stat`
Vérifier que SEULS ces fichiers apparaissent :
- `types/api.types.ts`, `types/crisis.types.ts`
- `lib/services/geopolitical/perplexity.service.ts` (+ `.test`)
- `lib/claude/claude.service.ts` (+ `lib/claude/countryGuide.test.ts`)
- `app/api/country-guide/route.ts` (+ `.test`)
- `components/crisis/CountryGuideBlock.tsx` (+ `.test`)
- `app/destination/[country]/page.tsx` (+ `DestinationPremiumFlow.test`)
- `docs/plans/2026-06-15-premium-guide-001c-country-guide.md`

**Interdits — vérifier ABSENCE de modif :** PDF (`report.service.tsx`, `export-pdf`), Stripe, Supabase (sauf lecture via `getUserWithSubscription` non modifié), quotas, pricing, `safeNext`, `TARGET_COUNTRIES`, `CANDIDATE_CAP`, `/api/analyze`, `GuideItinerarySection.tsx`, `/api/itinerary`, `ItineraryBlock.tsx` (sauf si un test l'a touché — ne pas modifier le composant lui-même).

**Step 6: Vérification UI réelle (webapp-testing)**

Démarrer le serveur, se connecter en premium (ou inspecter le rendu), aller sur une fiche destination, déclencher le guide. Capturer desktop + mobile. Vérifier : le bloc « Guide pays » apparaît sous la narrative ; états loading → success ; **le bloc itinéraire conserve `data-itinerary-build="guide-v1-no-cards"`** ; aucune carte. (Warmup `curl -m 180` puis Playwright sur serveur chaud — cf. mémoire PREMIUM-UX-001.)

**Step 7: Rapport Gate 2 + handoff (NE PAS MERGER)**

Produire le rapport Gate 2 (branche, commits, fichiers, tests ajoutés, résultats tsc/vitest/build, diff hors-scope vérifié, confirmation itinéraire no-cards intact, screenshots, GO/NO-GO). Attendre validation user. Ne pas lancer Gate 3.

---

## Risques résiduels connus

1. **Timeout Vercel Hobby** : la route enchaîne `calculateCrisisScore` + Perplexity (7s) + Claude (≤45s). Le scoring est caché (rapide en chaud) mais en cold-cache total le cumul peut s'approcher du plafond 60s. Mitigation actuelle : caches + hard timeout + fallback honnête. Leviers de secours si re-timeout en prod : `haiku-4-5` pour le guide, ou réduire la cible mots, ou ne PAS recalculer le score (passer un snapshot minimal). **À surveiller en Preview.**
2. **Double appel scoring** : la page fait déjà `calculateCrisisScore` en SSR ; la route le refait. Acceptable (caché, on-demand, premium only) mais non optimal — option future : passer le score client→serveur signé. Hors scope Gate 2.
3. **Hallucination sections 3/4/6** : mitigée par `buildFactsBlock` (conditionnel si pas de faits) mais dépend de la qualité sonar-pro. À inspecter sur 2-3 pays en vérif UI.
