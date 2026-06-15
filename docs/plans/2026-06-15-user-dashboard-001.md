# User Dashboard 001 — Historique analyses premium

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Créer un dashboard utilisateur premium minimal qui persiste et affiche les analyses récentes (6 mois), rendant réelle la promesse "Historique des scores 6 mois" du pricing.

**Architecture:** Nouvelle table Supabase `user_analyses` isolée (pas `crisis_score_history` qui est globale). Persistance best-effort dans `/api/analyze` via un helper jamais throwant. Dashboard Server Component + composant client de liste, premium-gated.

**Tech Stack:** Next.js 14 App Router · TypeScript strict · Supabase SSR + service role · Zod · Vitest · shadcn/ui tokens ctv3

---

## Règles absolues

- L'insert `user_analyses` ne doit JAMAIS faire échouer `/api/analyze`
- Pas de fire-and-forget nu : Promise.race + timeout 3s, toujours catché
- Pas de `user_id` exposé au client dans les réponses API
- RLS activée : SELECT = `auth.uid() = user_id` ; INSERT = service_role uniquement
- Zones interdites : Stripe, webhooks, pricing, scoring, cache global, /api/itinerary, /api/country-guide, PDF, GuideItinerarySection, ItineraryBlock, TARGET_COUNTRIES, CANDIDATE_CAP

---

## Task 1 : Migration SQL

**Files:**
- Create: `supabase/migrations/006_user_analyses.sql`

### Step 1 : Écrire la migration

```sql
-- Migration 006 : user_analyses
-- Historique personnel des analyses par utilisateur connecté.
-- Distinct de crisis_score_history (time-series globale par pays sans user_id).

CREATE TABLE IF NOT EXISTS public.user_analyses (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  country_code       CHAR(2)     NOT NULL,
  country_name       TEXT        NOT NULL,
  crisis_score       INT         NOT NULL CHECK (crisis_score BETWEEN 0 AND 100),
  security_score     INT         CHECK (security_score BETWEEN 0 AND 100),
  geopolitical_score INT         CHECK (geopolitical_score BETWEEN 0 AND 100),
  budget_score       INT         CHECK (budget_score BETWEEN 0 AND 100),
  travel_type        TEXT        CHECK (travel_type IN ('solo', 'couple', 'family', 'nomad')),
  duration           INT,
  budget             INT,
  mode               TEXT        CHECK (mode IN ('standard', 'bunker', 'budget_crisis')),
  status             TEXT        CHECK (status IN ('ideal', 'recommended', 'possible', 'discouraged')),
  confidence         TEXT        CHECK (confidence IN ('high', 'medium', 'low')),
  analyzed_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_analyses_user_date
  ON public.user_analyses(user_id, analyzed_at DESC);

ALTER TABLE public.user_analyses ENABLE ROW LEVEL SECURITY;

-- L'utilisateur ne voit que ses propres analyses
CREATE POLICY "Users can view own analyses"
  ON public.user_analyses FOR SELECT
  USING (auth.uid() = user_id);

-- Seul le service role peut insérer (depuis /api/analyze server-side)
CREATE POLICY "Service role can insert analyses"
  ON public.user_analyses FOR INSERT
  WITH CHECK (auth.role() = 'service_role');
```

### Step 2 : Appliquer manuellement dans Supabase Dashboard

(SQL Editor → coller le contenu → Run. Pas de CLI supabase local dans ce projet.)

### Step 3 : Commit

```bash
git add supabase/migrations/006_user_analyses.sql
git commit -m "feat(db): add user_analyses table for premium history"
```

---

## Task 2 : Helper persistUserAnalysisBestEffort

**Files:**
- Create: `lib/auth/userAnalyses.ts`
- Test: `lib/auth/userAnalyses.test.ts`

### Step 1 : Écrire le test d'abord

```typescript
// lib/auth/userAnalyses.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock @supabase/supabase-js
let insertImpl: () => Promise<{ error: unknown }>;

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: () => ({
      insert: () => insertImpl(),
    }),
  }),
}));

beforeEach(() => {
  vi.resetModules();
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://fake.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'fake-service-key';
});

async function load() {
  return import('./userAnalyses');
}

describe('persistUserAnalysisBestEffort', () => {
  it('retourne sans throw quand Supabase est indisponible', async () => {
    insertImpl = () => Promise.reject(new Error('Supabase down'));
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { persistUserAnalysisBestEffort } = await load();

    // Ne doit JAMAIS throw
    await expect(
      persistUserAnalysisBestEffort('user-123', {
        countryCode: 'PT',
        countryName: 'Portugal',
        crisisScore: 82,
        travelType: 'solo',
        duration: 7,
        budget: 1500,
        mode: 'standard',
      })
    ).resolves.toBeUndefined();

    expect(warnSpy).toHaveBeenCalledWith(
      '[userAnalyses] persist failed',
      expect.any(Error)
    );
    warnSpy.mockRestore();
  });

  it('retourne sans throw quand Supabase retourne une erreur', async () => {
    insertImpl = () => Promise.resolve({ error: { message: 'RLS violation' } });
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { persistUserAnalysisBestEffort } = await load();

    await expect(
      persistUserAnalysisBestEffort('user-123', {
        countryCode: 'PT',
        countryName: 'Portugal',
        crisisScore: 82,
      })
    ).resolves.toBeUndefined();

    expect(warnSpy).toHaveBeenCalledWith(
      '[userAnalyses] persist error',
      { message: 'RLS violation' }
    );
    warnSpy.mockRestore();
  });

  it('ne fait rien si les env vars Supabase sont absentes', async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    insertImpl = vi.fn().mockRejectedValue(new Error('should not call'));
    const { persistUserAnalysisBestEffort } = await load();

    await expect(
      persistUserAnalysisBestEffort('user-123', { countryCode: 'PT', countryName: 'Portugal', crisisScore: 82 })
    ).resolves.toBeUndefined();
  });

  it('ne fait rien si userId est null ou undefined', async () => {
    insertImpl = vi.fn().mockRejectedValue(new Error('should not call'));
    const { persistUserAnalysisBestEffort } = await load();

    await expect(
      persistUserAnalysisBestEffort(null, { countryCode: 'PT', countryName: 'Portugal', crisisScore: 82 })
    ).resolves.toBeUndefined();
  });
});
```

### Step 2 : Vérifier que les tests échouent

```bash
npx vitest run lib/auth/userAnalyses.test.ts
```
Attendu : FAIL (module introuvable)

### Step 3 : Implémenter le helper

```typescript
// lib/auth/userAnalyses.ts
import { createClient } from '@supabase/supabase-js';

export interface UserAnalysisPayload {
  countryCode: string;
  countryName: string;
  crisisScore: number;
  securityScore?: number;
  geopoliticalScore?: number;
  budgetScore?: number;
  travelType?: string;
  duration?: number;
  budget?: number;
  mode?: string;
  status?: string;
  confidence?: string;
}

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

/**
 * Persiste une analyse utilisateur dans user_analyses.
 * Best-effort : ne throw jamais, ne bloque jamais /api/analyze.
 * Timeout 3s via Promise.race pour éviter de bloquer serverless.
 */
export async function persistUserAnalysisBestEffort(
  userId: string | null | undefined,
  payload: UserAnalysisPayload
): Promise<void> {
  if (!userId) return;

  const supabase = getAdminClient();
  if (!supabase) return;

  const insert = supabase.from('user_analyses').insert({
    user_id:            userId,
    country_code:       payload.countryCode,
    country_name:       payload.countryName,
    crisis_score:       payload.crisisScore,
    security_score:     payload.securityScore ?? null,
    geopolitical_score: payload.geopoliticalScore ?? null,
    budget_score:       payload.budgetScore ?? null,
    travel_type:        payload.travelType ?? null,
    duration:           payload.duration ?? null,
    budget:             payload.budget ?? null,
    mode:               payload.mode ?? null,
    status:             payload.status ?? null,
    confidence:         payload.confidence ?? null,
  });

  const timeout = new Promise<{ error: unknown }>(
    (resolve) => setTimeout(() => resolve({ error: new Error('timeout') }), 3000)
  );

  try {
    const { error } = await Promise.race([insert, timeout]);
    if (error) {
      console.warn('[userAnalyses] persist error', error);
    }
  } catch (err) {
    console.warn('[userAnalyses] persist failed', err);
  }
}
```

### Step 4 : Vérifier que les tests passent

```bash
npx vitest run lib/auth/userAnalyses.test.ts
```
Attendu : 4 PASS

### Step 5 : Commit

```bash
git add lib/auth/userAnalyses.ts lib/auth/userAnalyses.test.ts
git commit -m "feat(auth): add persistUserAnalysisBestEffort helper"
```

---

## Task 3 : Intégration dans /api/analyze

**Files:**
- Modify: `app/api/analyze/route.ts`
- Test: `app/api/analyze/persistIntegration.test.ts`

### Step 1 : Écrire le test d'intégration

```typescript
// app/api/analyze/persistIntegration.test.ts
import { describe, it, expect, vi } from 'vitest';

// Mock du helper : on veut vérifier qu'il est appelé avec les bons args
// sans jamais impacter l'analyse elle-même
vi.mock('@/lib/auth/userAnalyses', () => ({
  persistUserAnalysisBestEffort: vi.fn().mockResolvedValue(undefined),
}));

// Mock Supabase (pour getUser / checkAndIncrementQuota)
vi.mock('@/lib/auth/supabase-server', () => ({
  getUser: vi.fn().mockResolvedValue({ id: 'user-abc', email: 'test@test.com' }),
}));

vi.mock('@/lib/auth/analysisQuota', () => ({
  checkAndIncrementQuota: vi.fn().mockResolvedValue({
    allowed: true,
    isPremium: true,
    remaining: 999,
    used: 1,
    limit: 999,
  }),
}));

vi.mock('@/lib/middleware/rateLimit', () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ success: true, limit: 10, remaining: 9, reset: 9999 }),
  getClientIdentifier: vi.fn().mockReturnValue('1.2.3.4'),
}));

vi.mock('@/lib/cache/redis', () => ({
  resetCacheStats: vi.fn(),
  getCacheStats: vi.fn().mockReturnValue({ hitRate: 0.5 }),
}));

vi.mock('@/lib/services/scoring/crisisScore.service', () => ({
  calculateCrisisScore: vi.fn().mockResolvedValue({
    country: 'Portugal',
    countryCode: 'PT',
    total: 82,
    security: { value: 85, source: 'live', confidence: 'high', details: {} },
    geopolitical: { value: 78, source: 'live', confidence: 'high', details: {} },
    budget: { value: 80, source: 'live', confidence: 'high', details: {} },
    practicality: { value: 90, source: 'live', confidence: 'high', details: {} },
    status: 'ideal',
    confidence: 'high',
    calculatedAt: new Date().toISOString(),
  }),
}));

vi.mock('@/lib/claude/claude.service', () => ({
  detectOpportunities: vi.fn().mockResolvedValue([]),
}));

vi.mock('@/lib/utils/countries', () => ({
  TARGET_COUNTRIES: [{ code: 'PT', name: 'Portugal', continent: 'Europe' }],
}));

vi.mock('@/lib/utils/selectCandidates', () => ({
  selectCandidates: vi.fn().mockImplementation((c) => c),
  CANDIDATE_CAP: 18,
}));

describe('/api/analyze — persistance best-effort', () => {
  it("appelle persistUserAnalysisBestEffort avec userId et top destination quand premium", async () => {
    const { persistUserAnalysisBestEffort } = await import('@/lib/auth/userAnalyses');
    const { POST } = await import('./route');

    const req = new Request('http://localhost/api/analyze', {
      method: 'POST',
      body: JSON.stringify({
        profile: {
          departureCountry: 'FR',
          budget: 1500,
          duration: 7,
          travelType: 'solo',
          mode: 'standard',
        },
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    // La persistance est appelée pour la top destination
    expect(persistUserAnalysisBestEffort).toHaveBeenCalledWith(
      'user-abc',
      expect.objectContaining({
        countryCode: 'PT',
        countryName: 'Portugal',
        crisisScore: 82,
        travelType: 'solo',
        duration: 7,
        budget: 1500,
        mode: 'standard',
      })
    );
  });

  it("retourne 200 même si persistUserAnalysisBestEffort throw", async () => {
    const { persistUserAnalysisBestEffort } = await import('@/lib/auth/userAnalyses');
    (persistUserAnalysisBestEffort as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('DB down')
    );

    const { POST } = await import('./route');

    const req = new Request('http://localhost/api/analyze', {
      method: 'POST',
      body: JSON.stringify({
        profile: {
          departureCountry: 'FR',
          budget: 1500,
          duration: 7,
          travelType: 'solo',
          mode: 'standard',
        },
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
  });
});
```

### Step 2 : Vérifier que le test échoue

```bash
npx vitest run app/api/analyze/persistIntegration.test.ts
```
Attendu : FAIL (persistUserAnalysisBestEffort jamais appelé)

### Step 3 : Modifier route.ts

Dans `app/api/analyze/route.ts`, ajouter l'import en tête de fichier :

```typescript
import { persistUserAnalysisBestEffort } from '@/lib/auth/userAnalyses';
```

Puis, juste avant `return NextResponse.json(response, {...})` (ligne ~212), ajouter le bloc de persistance. Le `user` est déjà en scope depuis la ligne 91 :

```typescript
    // Persistance best-effort de l'analyse pour le dashboard utilisateur.
    // Ne bloque jamais la réponse : le helper gère timeout + catch interne.
    // On ne persiste que la top destination (topDestinations[0]) pour éviter
    // le bruit d'un historique qui listerait les 5 pays en même temps.
    if (user?.id && topDestinations[0]) {
      const top = topDestinations[0];
      persistUserAnalysisBestEffort(user.id, {
        countryCode:       top.countryCode,
        countryName:       top.country,
        crisisScore:       top.total,
        securityScore:     top.security.value,
        geopoliticalScore: top.geopolitical.value,
        budgetScore:       top.budget.value,
        travelType:        profile.travelType,
        duration:          profile.duration,
        budget:            profile.budget,
        mode:              profile.mode,
        status:            top.status,
        confidence:        top.confidence,
      }).catch((err) => {
        // Double filet : le helper ne throw jamais, mais on attrape par sécurité.
        console.error('[API/analyze] persist unexpected', err);
      });
    }
```

Note : on appelle sans `await` car `persistUserAnalysisBestEffort` est déjà auto-boundée avec timeout. Le `.catch()` garantit qu'une exception inattendue ne crée pas un UnhandledPromiseRejection.

### Step 4 : Vérifier que les tests passent

```bash
npx vitest run app/api/analyze/persistIntegration.test.ts
```
Attendu : 2 PASS

### Step 5 : Commit

```bash
git add app/api/analyze/route.ts app/api/analyze/persistIntegration.test.ts
git commit -m "feat(analyze): persist top destination to user_analyses best-effort"
```

---

## Task 4 : Route GET /api/user-analyses

**Files:**
- Create: `app/api/user-analyses/route.ts`
- Test: `app/api/user-analyses/route.test.ts`

### Step 1 : Écrire les tests

```typescript
// app/api/user-analyses/route.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

let mockUser: { id: string } | null = null;
let mockIsPremium = false;
let mockData: unknown[] = [];
let mockError: unknown = null;

vi.mock('@/lib/auth/supabase-server', () => ({
  getUserWithSubscription: vi.fn().mockImplementation(async () => ({
    user: mockUser,
    isPremium: mockIsPremium,
  })),
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          gt: () => ({
            order: () => ({
              limit: () => Promise.resolve({ data: mockData, error: mockError }),
            }),
          }),
        }),
      }),
    }),
  }),
}));

beforeEach(() => {
  vi.resetModules();
  mockUser = null;
  mockIsPremium = false;
  mockData = [];
  mockError = null;
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://fake.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'fake-key';
});

async function load() {
  return import('./route');
}

describe('GET /api/user-analyses', () => {
  it('retourne 401 si non connecté', async () => {
    mockUser = null;
    const { GET } = await load();
    const res = await GET(new Request('http://localhost/api/user-analyses'));
    expect(res.status).toBe(401);
  });

  it('retourne 402 si connecté mais non-premium', async () => {
    mockUser = { id: 'user-abc' };
    mockIsPremium = false;
    const { GET } = await load();
    const res = await GET(new Request('http://localhost/api/user-analyses'));
    expect(res.status).toBe(402);
    const body = await res.json();
    expect(body.premiumRequired).toBe(true);
  });

  it('retourne la liste des analyses si premium', async () => {
    mockUser = { id: 'user-abc' };
    mockIsPremium = true;
    mockData = [
      {
        id: 'ana-1',
        country_code: 'PT',
        country_name: 'Portugal',
        crisis_score: 82,
        security_score: 85,
        geopolitical_score: 78,
        budget_score: 80,
        travel_type: 'solo',
        duration: 7,
        budget: 1500,
        mode: 'standard',
        status: 'ideal',
        confidence: 'high',
        analyzed_at: '2026-06-15T10:00:00Z',
      },
    ];
    const { GET } = await load();
    const res = await GET(new Request('http://localhost/api/user-analyses'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.analyses).toHaveLength(1);
    expect(body.analyses[0].countryCode).toBe('PT');
    expect(body.analyses[0].crisisScore).toBe(82);
    // user_id ne doit pas être exposé
    expect(body.analyses[0].userId).toBeUndefined();
    expect(body.analyses[0].user_id).toBeUndefined();
  });

  it('retourne analyses vide [] si pas encore d\'analyses', async () => {
    mockUser = { id: 'user-abc' };
    mockIsPremium = true;
    mockData = [];
    const { GET } = await load();
    const res = await GET(new Request('http://localhost/api/user-analyses'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.analyses).toEqual([]);
  });
});
```

### Step 2 : Vérifier que les tests échouent

```bash
npx vitest run app/api/user-analyses/route.test.ts
```
Attendu : FAIL (module introuvable)

### Step 3 : Implémenter la route

```typescript
// app/api/user-analyses/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getUserWithSubscription } from '@/lib/auth/supabase-server';

export async function GET(): Promise<NextResponse> {
  const { user, isPremium } = await getUserWithSubscription();

  if (!user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  if (!isPremium) {
    return NextResponse.json(
      { analyses: [], premiumRequired: true, upgradeUrl: '/pricing' },
      { status: 402 }
    );
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ analyses: [] });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const { data, error } = await supabase
    .from('user_analyses')
    .select(
      'id, country_code, country_name, crisis_score, security_score, ' +
      'geopolitical_score, budget_score, travel_type, duration, budget, ' +
      'mode, status, confidence, analyzed_at'
    )
    .eq('user_id', user.id)
    .gt('analyzed_at', sixMonthsAgo.toISOString())
    .order('analyzed_at', { ascending: false })
    .limit(50);

  if (error) {
    console.error('[API/user-analyses] fetch error', error);
    return NextResponse.json({ analyses: [] });
  }

  // Mapper snake_case → camelCase et exclure user_id
  const analyses = (data ?? []).map((row) => ({
    id:                row.id,
    countryCode:       row.country_code,
    countryName:       row.country_name,
    crisisScore:       row.crisis_score,
    securityScore:     row.security_score,
    geopoliticalScore: row.geopolitical_score,
    budgetScore:       row.budget_score,
    travelType:        row.travel_type,
    duration:          row.duration,
    budget:            row.budget,
    mode:              row.mode,
    status:            row.status,
    confidence:        row.confidence,
    analyzedAt:        row.analyzed_at,
  }));

  return NextResponse.json({ analyses });
}
```

### Step 4 : Vérifier que les tests passent

```bash
npx vitest run app/api/user-analyses/route.test.ts
```
Attendu : 4 PASS

### Step 5 : Commit

```bash
git add app/api/user-analyses/route.ts app/api/user-analyses/route.test.ts
git commit -m "feat(api): add GET /api/user-analyses premium-gated history endpoint"
```

---

## Task 5 : Composant UserAnalysisHistory

**Files:**
- Create: `components/crisis/UserAnalysisHistory.tsx`
- Test: `components/crisis/UserAnalysisHistory.test.ts`

### Step 1 : Définir le type partagé

Ajouter dans `types/crisis.types.ts` (à la fin, avant `clamp`) :

```typescript
// ── User Dashboard types (USER-DASHBOARD-001) ────────────────────────────────

export interface UserAnalysis {
  id: string;
  countryCode: string;
  countryName: string;
  crisisScore: number;
  securityScore?: number;
  geopoliticalScore?: number;
  budgetScore?: number;
  travelType?: 'solo' | 'couple' | 'family' | 'nomad';
  duration?: number;
  budget?: number;
  mode?: 'standard' | 'bunker' | 'budget_crisis';
  status?: 'ideal' | 'recommended' | 'possible' | 'discouraged';
  confidence?: 'high' | 'medium' | 'low';
  analyzedAt: string;
}
```

### Step 2 : Écrire les tests du composant

```typescript
// components/crisis/UserAnalysisHistory.test.ts
import { describe, it, expect } from 'vitest';
import { buildDestinationUrl } from './UserAnalysisHistory';

// On exporte une fonction pure pour tester la logique de URL sans monter le composant

describe('buildDestinationUrl', () => {
  it('construit l\'URL avec tous les paramètres', () => {
    const url = buildDestinationUrl({
      countryCode: 'PT',
      travelType: 'family',
      duration: 14,
      budget: 3000,
      mode: 'standard',
    });
    expect(url).toBe('/destination/pt?travelType=family&duration=14&budget=3000&mode=standard');
  });

  it('omet les paramètres undefined', () => {
    const url = buildDestinationUrl({ countryCode: 'JP' });
    expect(url).toBe('/destination/jp');
  });

  it('normalise le countryCode en lowercase pour l\'URL', () => {
    const url = buildDestinationUrl({ countryCode: 'US', travelType: 'solo' });
    expect(url).toContain('/destination/us');
  });
});

describe('formatAnalysisDate', () => {
  it('formate une date ISO en date lisible française', async () => {
    const { formatAnalysisDate } = await import('./UserAnalysisHistory');
    const result = formatAnalysisDate('2026-06-15T10:00:00Z');
    // Doit contenir le jour et le mois (format fr-FR)
    expect(result).toMatch(/\d{2}\/\d{2}\/\d{4}|\d+ \w+ \d{4}/);
  });
});
```

### Step 3 : Vérifier que les tests échouent

```bash
npx vitest run components/crisis/UserAnalysisHistory.test.ts
```
Attendu : FAIL (exports introuvables)

### Step 4 : Implémenter le composant

```typescript
// components/crisis/UserAnalysisHistory.tsx
'use client';
import { useEffect, useState } from 'react';
import type { UserAnalysis } from '@/types/crisis.types';
import { tierFromScore, TIER } from '@/components/design/atoms';

// Fonctions pures exportées pour les tests
export function buildDestinationUrl(opts: {
  countryCode: string;
  travelType?: string;
  duration?: number;
  budget?: number;
  mode?: string;
}): string {
  const params = new URLSearchParams();
  if (opts.travelType) params.set('travelType', opts.travelType);
  if (opts.duration)   params.set('duration',   String(opts.duration));
  if (opts.budget)     params.set('budget',      String(opts.budget));
  if (opts.mode)       params.set('mode',        opts.mode);
  const qs = params.toString();
  return `/destination/${opts.countryCode.toLowerCase()}${qs ? `?${qs}` : ''}`;
}

export function formatAnalysisDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
}

const TRAVEL_TYPE_LABEL: Record<string, string> = {
  solo:   'Solo',
  couple: 'Couple',
  family: 'Famille',
  nomad:  'Nomade',
};

const MODE_LABEL: Record<string, string> = {
  standard:     'Standard',
  bunker:       'Sécurité max',
  budget_crisis: 'Budget',
};

export function UserAnalysisHistory() {
  const [analyses, setAnalyses] = useState<UserAnalysis[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(false);

  useEffect(() => {
    fetch('/api/user-analyses')
      .then((r) => {
        if (!r.ok) throw new Error(`${r.status}`);
        return r.json();
      })
      .then((d) => {
        setAnalyses(d.analyses ?? []);
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 0' }}>
        <div className="ct-spinner" />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        padding: '24px 20px', border: '1px solid var(--ctv3-line)',
        background: 'var(--ctv3-ink-850)', textAlign: 'center',
      }}>
        <p className="ctv3-mono" style={{ fontSize: 11, color: 'var(--ctv3-reco)', letterSpacing: '0.1em' }}>
          IMPOSSIBLE DE CHARGER L'HISTORIQUE — RÉESSAYEZ PLUS TARD
        </p>
      </div>
    );
  }

  if (!analyses.length) {
    return (
      <div style={{
        padding: '40px 24px', border: '1px solid var(--ctv3-line)',
        background: 'var(--ctv3-ink-850)', textAlign: 'center',
      }}>
        <p className="ctv3-mono" style={{ fontSize: 10, color: 'var(--ctv3-faint)', letterSpacing: '0.14em' }}>
          AUCUNE ANALYSE ENREGISTRÉE
        </p>
        <p className="ctv3-serif" style={{ fontSize: 14, color: 'var(--ctv3-muted)', marginTop: 8, lineHeight: 1.5 }}>
          Lancez une analyse depuis la page d'accueil — elle apparaîtra ici automatiquement.
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {analyses.map((a) => {
        const tier = tierFromScore(a.crisisScore);
        const tierInfo = TIER[tier];
        const destUrl = buildDestinationUrl({
          countryCode: a.countryCode,
          travelType:  a.travelType,
          duration:    a.duration,
          budget:      a.budget,
          mode:        a.mode,
        });

        return (
          <div
            key={a.id}
            style={{
              border: '1px solid var(--ctv3-line)',
              background: 'var(--ctv3-ink-850)',
              padding: '16px 18px',
              display: 'grid',
              gridTemplateColumns: '1fr auto',
              gap: '12px 16px',
              alignItems: 'start',
            }}
          >
            {/* Colonne principale */}
            <div>
              {/* Ligne pays + score */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <span
                  className="ctv3-mono"
                  style={{ fontSize: 22, fontWeight: 700, color: tierInfo.color, letterSpacing: '-0.02em' }}
                >
                  {a.crisisScore}
                </span>
                <div>
                  <div style={{
                    fontFamily: 'var(--ctv3-display)', fontWeight: 800,
                    fontSize: 15, color: 'var(--ctv3-paper)', lineHeight: 1.1,
                  }}>
                    {a.countryName}
                  </div>
                  {a.status && (
                    <div className="ctv3-mono" style={{
                      fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase',
                      color: tierInfo.color, marginTop: 2,
                    }}>
                      {tierInfo.label}
                    </div>
                  )}
                </div>
              </div>

              {/* Profil voyage */}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
                {a.travelType && (
                  <Tag>{TRAVEL_TYPE_LABEL[a.travelType] ?? a.travelType}</Tag>
                )}
                {a.duration && <Tag>{a.duration} jours</Tag>}
                {a.budget && <Tag>{a.budget.toLocaleString('fr-FR')}€</Tag>}
                {a.mode && a.mode !== 'standard' && (
                  <Tag warn>{MODE_LABEL[a.mode] ?? a.mode}</Tag>
                )}
              </div>

              {/* Sous-scores si disponibles */}
              {(a.securityScore != null || a.geopoliticalScore != null || a.budgetScore != null) && (
                <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
                  {a.securityScore != null && <SubScore label="SÉC" value={a.securityScore} />}
                  {a.geopoliticalScore != null && <SubScore label="GÉO" value={a.geopoliticalScore} />}
                  {a.budgetScore != null && <SubScore label="BUD" value={a.budgetScore} />}
                </div>
              )}
            </div>

            {/* Colonne droite : date + lien */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 10 }}>
              <span className="ctv3-mono" style={{
                fontSize: 9.5, letterSpacing: '0.1em', color: 'var(--ctv3-faint)',
                whiteSpace: 'nowrap',
              }}>
                {formatAnalysisDate(a.analyzedAt)}
              </span>
              <a
                href={destUrl}
                className="ctv3-mono"
                style={{
                  padding: '6px 12px',
                  border: '1px solid var(--ctv3-line-bright)',
                  color: 'var(--ctv3-paper)',
                  fontSize: 9.5, letterSpacing: '0.12em', textTransform: 'uppercase',
                  textDecoration: 'none', fontWeight: 700,
                  whiteSpace: 'nowrap',
                  transition: 'border-color 0.15s',
                }}
              >
                Revoir →
              </a>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Tag({ children, warn }: { children: React.ReactNode; warn?: boolean }) {
  return (
    <span className="ctv3-mono" style={{
      fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase',
      padding: '3px 7px',
      border: `1px solid ${warn ? 'rgba(255,178,36,0.3)' : 'var(--ctv3-line)'}`,
      color: warn ? 'var(--ctv3-reco)' : 'var(--ctv3-faint)',
      background: warn ? 'rgba(255,178,36,0.06)' : 'transparent',
    }}>
      {children}
    </span>
  );
}

function SubScore({ label, value }: { label: string; value: number }) {
  const color = value >= 80 ? '#3ddc97' : value >= 60 ? '#ffb224' : value >= 40 ? '#ff8c42' : '#ff3b2f';
  return (
    <span className="ctv3-mono" style={{ fontSize: 9.5, color: 'var(--ctv3-faint)' }}>
      {label}{' '}
      <span style={{ color, fontWeight: 700 }}>{value}</span>
    </span>
  );
}
```

### Step 5 : Vérifier que les tests passent

```bash
npx vitest run components/crisis/UserAnalysisHistory.test.ts
```
Attendu : 3 PASS

### Step 6 : Commit

```bash
git add types/crisis.types.ts components/crisis/UserAnalysisHistory.tsx components/crisis/UserAnalysisHistory.test.ts
git commit -m "feat(ui): add UserAnalysisHistory component with pure URL builder"
```

---

## Task 6 : Page dashboard

**Files:**
- Create: `app/dashboard/page.tsx`

### Step 1 : Implémenter la page

```typescript
// app/dashboard/page.tsx
import type { Metadata } from 'next';
import { Header } from '@/components/layout/Header';
import { PremiumGate } from '@/components/auth/PremiumGate';
import { UserAnalysisHistory } from '@/components/crisis/UserAnalysisHistory';
import { getUserWithSubscription } from '@/lib/auth/supabase-server';
import { SectionLabel } from '@/components/design/atoms';

export const metadata: Metadata = {
  title: 'Mon tableau de bord | Crisis Travel',
  description: 'Retrouvez vos dernières analyses Crisis Travel et reprenez une destination avec le même contexte de voyage.',
  robots: { index: false, follow: false },
};

export default async function DashboardPage() {
  const { user, isPremium } = await getUserWithSubscription();

  return (
    <div className="ctv3" style={{ minHeight: '100vh', background: 'var(--ctv3-ink-900)' }}>
      <Header />
      <main style={{ maxWidth: 820, margin: '0 auto', padding: '40px 20px 72px' }}>

        {/* Titre éditorial */}
        <div style={{ marginBottom: 36 }}>
          <p className="ctv3-mono" style={{
            fontSize: 9, letterSpacing: '0.2em', textTransform: 'uppercase',
            color: 'var(--ctv3-faint)', marginBottom: 10,
          }}>
            Crisis Travel · Tableau de bord
          </p>
          <h1 style={{
            fontFamily: 'var(--ctv3-display)', fontWeight: 900,
            fontSize: 'clamp(28px, 6vw, 40px)', letterSpacing: '-0.03em',
            color: 'var(--ctv3-paper)', lineHeight: 1.05, marginBottom: 10,
          }}>
            Mon tableau de bord
          </h1>
          <p className="ctv3-serif" style={{
            fontSize: 15, color: 'var(--ctv3-muted)', lineHeight: 1.55, maxWidth: 560,
          }}>
            Retrouvez vos dernières analyses Crisis Travel et reprenez une destination
            avec le même contexte de voyage.
          </p>
        </div>

        {/* Historique analyses */}
        <SectionLabel num="01" label="Historique des analyses" meta="6 mois · Premium" />

        {!user ? (
          /* Non connecté */
          <div style={{
            padding: '32px 24px', border: '1px solid var(--ctv3-line)',
            background: 'var(--ctv3-ink-850)', textAlign: 'center',
          }}>
            <p className="ctv3-mono" style={{
              fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase',
              color: 'var(--ctv3-faint)', marginBottom: 12,
            }}>
              CONNEXION REQUISE
            </p>
            <p className="ctv3-serif" style={{ fontSize: 14, color: 'var(--ctv3-muted)', marginBottom: 20, lineHeight: 1.5 }}>
              Connectez-vous pour accéder à votre historique d'analyses.
            </p>
            <a href="/" className="ctv3-mono" style={{
              display: 'inline-flex', padding: '10px 20px',
              border: '1px solid var(--ctv3-line-bright)', color: 'var(--ctv3-paper)',
              fontSize: 10.5, letterSpacing: '0.12em', textTransform: 'uppercase',
              textDecoration: 'none', fontWeight: 700,
            }}>
              ← Retour à l'accueil
            </a>
          </div>
        ) : (
          /* Connecté : gating premium */
          <PremiumGate
            feature="Historique des analyses"
            description="Retrouvez toutes vos analyses des 6 derniers mois, avec le profil voyage associé et un lien direct vers la fiche destination."
            isPremium={isPremium}
            isLoggedIn={!!user}
            variant="card"
          >
            <UserAnalysisHistory />
          </PremiumGate>
        )}

      </main>
    </div>
  );
}
```

### Step 2 : Commit

```bash
git add app/dashboard/page.tsx
git commit -m "feat(ui): add /dashboard page premium-gated with UserAnalysisHistory"
```

---

## Task 7 : Lien dashboard dans UserMenu

**Files:**
- Modify: `components/auth/UserMenu.tsx`

### Step 1 : Ajouter le lien dans le menu déroulant

Dans `components/auth/UserMenu.tsx`, après le bouton "Gérer l'abonnement" (ligne ~126), ajouter :

```typescript
          <a
            href="/dashboard"
            onClick={() => setShowMenu(false)}
            style={{
              width: '100%', padding: '7px 10px', borderRadius: 6,
              background: 'transparent', border: 'none', textAlign: 'left',
              color: 'var(--ctv3-muted)', fontSize: 13,
              display: 'flex', alignItems: 'center', gap: 8,
              textDecoration: 'none',
              transition: 'background 0.1s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--ctv3-ink-800)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
          >
            <span style={{ fontSize: 11 }}>◈</span>
            Mon tableau de bord
          </a>
```

### Step 2 : Commit

```bash
git add components/auth/UserMenu.tsx
git commit -m "feat(ui): add dashboard link to UserMenu"
```

---

## Task 8 : Validations finales

### Step 1 : Type-check

```bash
npx tsc --noEmit
```
Attendu : 0 erreur

### Step 2 : Tests complets

```bash
npx vitest run
```
Attendu : tous PASS, aucune régression

### Step 3 : Build

```bash
npm run build
```
Attendu : Build succeeded, 0 erreur

### Step 4 : Vérification zones interdites (diff)

```bash
git diff --stat main...HEAD
```
Vérifier que ces fichiers N'APPARAISSENT PAS dans le diff :
- `lib/services/scoring/` — scoring intact
- `lib/cache/redis.ts` — cache intact
- `app/api/stripe/` — Stripe intact
- `app/api/itinerary/` — itinéraire intact
- `app/api/country-guide/` — guide intact
- `app/api/export-pdf/` — PDF intact
- `components/crisis/GuideItinerarySection.tsx` — no-cards intact
- `components/crisis/ItineraryBlock.tsx` — no-cards intact
- `app/pricing/page.tsx` — pricing intact
- `lib/utils/countries.ts` — TARGET_COUNTRIES intact

### Step 5 : Vérification no-cards invariant

```bash
grep -r "Jour [0-9]" crisis-travel/components/crisis/UserAnalysisHistory.tsx
grep -r "Matin\|Après-midi\|Soir" crisis-travel/components/crisis/UserAnalysisHistory.tsx
grep -r "À planifier" crisis-travel/components/crisis/UserAnalysisHistory.tsx
```
Attendu : 0 résultat (le composant ne touche pas à l'itinéraire)

### Step 6 : Rapport Gate 2 + décision Preview GO/NO-GO

Produire le rapport final listant :
1. Branche créée
2. Commits réalisés
3. Fichiers modifiés avec tailles
4. Résultats tsc/vitest/build
5. Zones interdites confirmées intactes
6. No-cards itinerary intact
7. Risques restants
8. Décision proposée

---

## Résumé des fichiers créés/modifiés

| Fichier | Action |
|---|---|
| `supabase/migrations/006_user_analyses.sql` | Créer |
| `lib/auth/userAnalyses.ts` | Créer |
| `lib/auth/userAnalyses.test.ts` | Créer |
| `app/api/analyze/route.ts` | Modifier (import + bloc persist) |
| `app/api/analyze/persistIntegration.test.ts` | Créer |
| `app/api/user-analyses/route.ts` | Créer |
| `app/api/user-analyses/route.test.ts` | Créer |
| `types/crisis.types.ts` | Modifier (ajout `UserAnalysis`) |
| `components/crisis/UserAnalysisHistory.tsx` | Créer |
| `components/crisis/UserAnalysisHistory.test.ts` | Créer |
| `app/dashboard/page.tsx` | Créer |
| `components/auth/UserMenu.tsx` | Modifier (lien dashboard) |
