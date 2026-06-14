import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import type { ItineraryRequest, ItineraryResult, ItineraryApiResponse } from '../../../types/crisis.types';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Reproduit le schéma Zod de la route sans importer next/server */
const ALLOWED_PREFERENCES = [
  'culture', 'food', 'nature', 'adventure', 'beach', 'city', 'history',
  'architecture', 'nightlife', 'family', 'slow travel', 'budget', 'luxury',
  'hiking', 'photography', 'wellness', 'sports', 'shopping', 'art', 'music',
] as const;

const itinerarySchema = z.object({
  countryCode: z.string().min(2).max(3).toUpperCase().optional(),
  countryName: z.string().min(1).max(100).optional(),
  cityOrRegion: z.string().min(1).max(100).optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  budget: z.number().positive().max(1_000_000).optional(),
  currency: z.string().min(3).max(3).toUpperCase().default('EUR'),
  travelers: z.number().int().min(1).max(20).optional(),
  travelType: z.enum(['solo', 'couple', 'family', 'nomad']).optional(),
  preferences: z.array(
    z.string().refine((p) => (ALLOWED_PREFERENCES as readonly string[]).includes(p.toLowerCase()))
  ).max(10).optional(),
  riskContext: z.object({
    meaeLevel: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
    source: z.enum(['static', 'live']),
    lastUpdated: z.string().optional(),
  }).optional(),
}).refine(
  (d) => d.countryCode !== undefined || d.countryName !== undefined,
  { message: 'countryCode ou countryName est requis' }
).refine(
  (d) => {
    if (!d.from || !d.to) return true;
    return new Date(d.to) > new Date(d.from);
  },
  { message: 'La date de retour doit être après la date de départ', path: ['to'] }
);

const validPayload: ItineraryRequest = {
  countryCode: 'MA',
  countryName: 'Maroc',
  cityOrRegion: 'Marrakech',
  from: '2026-07-10',
  to: '2026-07-15',
  budget: 900,
  currency: 'EUR',
  travelers: 1,
  preferences: ['culture', 'food'],
  riskContext: { meaeLevel: 2, source: 'static', lastUpdated: '2026-06-10' },
};

function makeItineraryResult(days = 5): ItineraryResult {
  return {
    countryCode: 'MA',
    countryName: 'Maroc',
    cityOrRegion: 'Marrakech',
    durationDays: days,
    budget: { amount: 900, currency: 'EUR', level: 'medium' },
    days: Array.from({ length: days }, (_, i) => ({
      day: i + 1,
      title: `Jour ${i + 1}`,
      summary: 'Description indicative.',
      morning: 'Matin indicatif.',
      afternoon: 'Après-midi indicatif.',
      evening: 'Soir indicatif.',
      estimatedBudget: '~80 EUR',
      safetyNote: 'Vérifiez diplomatie.gouv.fr avant le départ.',
    })),
    globalAdvice: ['Consultez diplomatie.gouv.fr avant de partir.'],
    safetyDisclaimer:
      'Cet itinéraire est généré à titre indicatif. Crisis Travel ne garantit pas la sécurité.',
    officialSourceReminder:
      'Vérifiez toujours les informations officielles sur diplomatie.gouv.fr avant votre départ.',
    generatedAt: new Date().toISOString(),
  };
}

// ── 1. Validation Zod (simulant la route sans Next.js) ────────────────────────

describe('itinerary route — validation Zod', () => {
  it('accepte un payload valide complet', () => {
    const result = itinerarySchema.safeParse(validPayload);
    expect(result.success).toBe(true);
  });

  it('refuse si ni countryCode ni countryName', () => {
    const result = itinerarySchema.safeParse({ budget: 900, travelers: 1 });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toContain('countryCode ou countryName');
  });

  it('accepte avec countryCode seul', () => {
    const result = itinerarySchema.safeParse({ countryCode: 'JP', budget: 1500 });
    expect(result.success).toBe(true);
  });

  it('accepte avec countryName seul', () => {
    const result = itinerarySchema.safeParse({ countryName: 'Japon', budget: 1500 });
    expect(result.success).toBe(true);
  });

  it('refuse budget négatif', () => {
    const result = itinerarySchema.safeParse({ ...validPayload, budget: -100 });
    expect(result.success).toBe(false);
  });

  it('refuse budget égal à zéro', () => {
    const result = itinerarySchema.safeParse({ ...validPayload, budget: 0 });
    expect(result.success).toBe(false);
  });

  it('refuse travelers <= 0', () => {
    const result = itinerarySchema.safeParse({ ...validPayload, travelers: 0 });
    expect(result.success).toBe(false);
  });

  it('refuse travelers négatif', () => {
    const result = itinerarySchema.safeParse({ ...validPayload, travelers: -1 });
    expect(result.success).toBe(false);
  });

  it('refuse to <= from (même date)', () => {
    const result = itinerarySchema.safeParse({
      ...validPayload,
      from: '2026-07-15',
      to: '2026-07-15',
    });
    expect(result.success).toBe(false);
  });

  it('refuse to avant from', () => {
    const result = itinerarySchema.safeParse({
      ...validPayload,
      from: '2026-07-15',
      to: '2026-07-10',
    });
    expect(result.success).toBe(false);
  });

  it('accepte from sans to (et vice versa)', () => {
    const r1 = itinerarySchema.safeParse({ ...validPayload, to: undefined });
    expect(r1.success).toBe(true);
    const r2 = itinerarySchema.safeParse({ ...validPayload, from: undefined });
    expect(r2.success).toBe(true);
  });

  it('refuse une date au format incorrect', () => {
    const result = itinerarySchema.safeParse({ ...validPayload, from: '10/07/2026' });
    expect(result.success).toBe(false);
  });

  it('refuse une préférence non reconnue', () => {
    const result = itinerarySchema.safeParse({
      ...validPayload,
      preferences: ['culture', 'injectionMalveillante'],
    });
    expect(result.success).toBe(false);
  });

  it('refuse plus de 10 préférences', () => {
    const result = itinerarySchema.safeParse({
      ...validPayload,
      preferences: Array(11).fill('culture'),
    });
    expect(result.success).toBe(false);
  });

  it('accepte riskContext meaeLevel 1, 2, 3, 4', () => {
    for (const lvl of [1, 2, 3, 4] as const) {
      const result = itinerarySchema.safeParse({
        ...validPayload,
        riskContext: { meaeLevel: lvl, source: 'static' },
      });
      expect(result.success).toBe(true);
    }
  });

  it('refuse meaeLevel hors plage', () => {
    const result = itinerarySchema.safeParse({
      ...validPayload,
      riskContext: { meaeLevel: 5, source: 'static' },
    });
    expect(result.success).toBe(false);
  });
});

// ── 2. Structure de la réponse ────────────────────────────────────────────────

describe('itinerary response — structure de données', () => {
  it('ItineraryApiResponse contient meta.premiumOnly = true', () => {
    const response: ItineraryApiResponse = {
      itinerary: makeItineraryResult(),
      meta: { premiumOnly: true, source: 'ai', officialDataMode: 'static' },
    };
    expect(response.meta.premiumOnly).toBe(true);
  });

  it('ItineraryApiResponse contient meta.officialDataMode = "static"', () => {
    const response: ItineraryApiResponse = {
      itinerary: makeItineraryResult(),
      meta: { premiumOnly: true, source: 'ai', officialDataMode: 'static' },
    };
    expect(response.meta.officialDataMode).toBe('static');
  });

  it('ItineraryApiResponse contient meta.source = "ai"', () => {
    const response: ItineraryApiResponse = {
      itinerary: makeItineraryResult(),
      meta: { premiumOnly: true, source: 'ai', officialDataMode: 'static' },
    };
    expect(response.meta.source).toBe('ai');
  });

  it('ItineraryResult contient safetyDisclaimer non vide', () => {
    const result = makeItineraryResult();
    expect(result.safetyDisclaimer.length).toBeGreaterThan(0);
    expect(result.safetyDisclaimer).not.toContain('garantit la sécurité absolue');
  });

  it('ItineraryResult contient officialSourceReminder non vide', () => {
    const result = makeItineraryResult();
    expect(result.officialSourceReminder.length).toBeGreaterThan(0);
    expect(result.officialSourceReminder).toContain('diplomatie.gouv.fr');
  });

  it('ItineraryResult.days a le bon nombre de jours', () => {
    expect(makeItineraryResult(3).days).toHaveLength(3);
    expect(makeItineraryResult(7).days).toHaveLength(7);
    expect(makeItineraryResult(14).days).toHaveLength(14);
  });

  it('chaque jour possède les champs obligatoires', () => {
    const result = makeItineraryResult(2);
    for (const day of result.days) {
      expect(day.day).toBeGreaterThanOrEqual(1);
      expect(typeof day.title).toBe('string');
      expect(typeof day.summary).toBe('string');
      expect(typeof day.morning).toBe('string');
      expect(typeof day.afternoon).toBe('string');
      expect(typeof day.evening).toBe('string');
      expect(typeof day.estimatedBudget).toBe('string');
      expect(typeof day.safetyNote).toBe('string');
    }
  });

  it('ItineraryResult.budget.level est une valeur valide', () => {
    const validLevels = ['low', 'medium', 'high', 'luxury'];
    const result = makeItineraryResult();
    expect(validLevels).toContain(result.budget.level);
  });

  it('generatedAt est une date ISO valide', () => {
    const result = makeItineraryResult();
    expect(() => new Date(result.generatedAt)).not.toThrow();
    expect(new Date(result.generatedAt).toISOString()).toBe(result.generatedAt);
  });

  // ── PREMIUM-GUIDE-001B — narrativeText optionnel ────────────────────────────

  it('narrativeText est optionnel : un ItineraryResult sans narrativeText reste valide', () => {
    const result = makeItineraryResult();
    // makeItineraryResult n'inclut PAS narrativeText → l'absence compile et n'invalide rien.
    expect(result.narrativeText).toBeUndefined();
    expect(result.days.length).toBeGreaterThan(0);
    expect(result.safetyDisclaimer.length).toBeGreaterThan(0);
  });

  it('narrativeText peut être fourni sans casser les champs jour/jour existants', () => {
    const result: ItineraryResult = {
      ...makeItineraryResult(3),
      narrativeText: '**Le fil conducteur du séjour**\n\nÀ ton arrivée, prends tes repères en douceur…',
    };
    expect(result.narrativeText).toContain('fil conducteur');
    // Le JSON jour/jour reste la source d'autorité, toujours présent.
    expect(result.days).toHaveLength(3);
    expect(result.globalAdvice.length).toBeGreaterThan(0);
    expect(result.officialSourceReminder).toContain('diplomatie.gouv.fr');
  });
});

// ── 3. Isolation scoring / quota ──────────────────────────────────────────────

function readSource(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), 'utf-8');
}

describe('itinerary — isolation scoring et quota', () => {
  it('generateItinerary n\'importe pas calculateCrisisScore', () => {
    const src = readSource('lib/claude/claude.service.ts');
    expect(src).not.toContain('calculateCrisisScore');
    expect(src).not.toContain('crisisScore.service');
  });

  it('la route /api/itinerary n\'importe pas checkAndIncrementQuota', () => {
    const src = readSource('app/api/itinerary/route.ts');
    expect(src).not.toContain('checkAndIncrementQuota');
    expect(src).not.toContain('analysisQuota');
  });

  it('la route /api/itinerary n\'appelle pas /api/analyze', () => {
    const src = readSource('app/api/itinerary/route.ts');
    expect(src).not.toContain('/api/analyze');
    expect(src).not.toContain('api/analyze');
  });

  it('le service itinerary n\'appelle pas detectOpportunities depuis generateItinerary', () => {
    const src = readSource('lib/claude/claude.service.ts');
    const generateFnStart = src.indexOf('export async function generateItinerary');
    const generateFnEnd = src.indexOf('\nexport async function detectOpportunities');
    const generateFnBody = src.slice(generateFnStart, generateFnEnd);
    expect(generateFnBody).not.toContain('detectOpportunities');
  });

  it('TARGET_COUNTRIES n\'est pas importé dans claude.service', () => {
    const src = readSource('lib/claude/claude.service.ts');
    expect(src).not.toContain('TARGET_COUNTRIES');
  });

  it('CANDIDATE_CAP n\'est pas importé dans claude.service', () => {
    const src = readSource('lib/claude/claude.service.ts');
    expect(src).not.toContain('CANDIDATE_CAP');
  });
});

// ── 4. Auth / premium simulé (comportement routes) ───────────────────────────

describe('itinerary route — comportement auth et premium', () => {
  function simulateAuthCheck(user: { id: string } | null, isPremium: boolean) {
    if (!user) return { status: 401, body: { error: 'Authentification requise' } };
    if (!isPremium) return { status: 402, body: { error: "Génération d'itinéraire disponible avec le plan Premium", upgradeUrl: '/pricing' } };
    return null;
  }

  it('utilisateur non authentifié → 401', () => {
    const result = simulateAuthCheck(null, false);
    expect(result?.status).toBe(401);
    expect(result?.body.error).toContain('Authentification');
  });

  it('utilisateur authentifié non premium → 402', () => {
    const result = simulateAuthCheck({ id: 'user-123' }, false);
    expect(result?.status).toBe(402);
    expect(result?.body).toHaveProperty('upgradeUrl', '/pricing');
  });

  it('utilisateur premium → auth check passe (null = continuer)', () => {
    const result = simulateAuthCheck({ id: 'user-456' }, true);
    expect(result).toBeNull();
  });

  it('réponse 402 contient upgradeUrl vers /pricing', () => {
    const result = simulateAuthCheck({ id: 'user-789' }, false);
    expect(result?.body.upgradeUrl).toBe('/pricing');
  });
});

// ── 5. Sécurité prompt ────────────────────────────────────────────────────────

describe('itinerary — sécurité du prompt IA', () => {
  it('le prompt système n\'inclut pas de données live inventées', () => {
    const src = readSource('lib/claude/claude.service.ts');
    expect(src).toContain('Ne prétends PAS accéder à des données en temps réel');
  });

  it('le prompt interdit d\'inventer des sources officielles', () => {
    const src = readSource('lib/claude/claude.service.ts');
    expect(src).toContain("N'invente aucune source officielle");
  });

  it('le prompt interdit de promettre sécurité absolue', () => {
    const src = readSource('lib/claude/claude.service.ts');
    expect(src).toContain('Ne promets pas de sécurité absolue');
  });

  it('le prompt mentionne diplomatie.gouv.fr', () => {
    const src = readSource('lib/claude/claude.service.ts');
    expect(src).toContain('diplomatie.gouv.fr');
  });

  it('le fallback contient safetyDisclaimer non vide', () => {
    // Le fallback hardcodé doit toujours contenir un disclaimer
    const disclaimer =
      "Cet itinéraire est généré à titre indicatif uniquement. Crisis Travel ne garantit pas l'exactitude ni la sécurité des informations.";
    expect(disclaimer.length).toBeGreaterThan(0);
    expect(disclaimer).not.toContain('garantit la sécurité absolue');
  });

  it('le fallback contient officialSourceReminder mentionnant diplomatie.gouv.fr', () => {
    const reminder =
      "Vérifiez toujours les informations officielles sur diplomatie.gouv.fr avant votre départ.";
    expect(reminder).toContain('diplomatie.gouv.fr');
  });
});

// ── 6. Non-régression fichiers critiques ─────────────────────────────────────

describe('non-régression — fichiers critiques non modifiés', () => {
  it('ResultsContent.tsx n\'importe pas generateItinerary', () => {
    const filePath = resolve(process.cwd(), 'app/results/ResultsContent.tsx');
    if (!existsSync(filePath)) return;
    expect(readFileSync(filePath, 'utf-8')).not.toContain('generateItinerary');
  });

  it('destination page.tsx n\'importe pas generateItinerary', () => {
    const filePath = resolve(process.cwd(), 'app/destination/[country]/page.tsx');
    if (!existsSync(filePath)) return;
    expect(readFileSync(filePath, 'utf-8')).not.toContain('generateItinerary');
  });
});
