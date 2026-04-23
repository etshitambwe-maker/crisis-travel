# Crisis Travel MVP — Plan d'Implémentation

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Construire le MVP complet de Crisis Travel — application Next.js 14 full-stack avec algorithme CrisisScore, intégrations APIs géopolitiques/sécurité/budget, et interface dark "salle de crise".

**Architecture:** Next.js 14 App Router (frontend + API Routes backend) déployé sur Vercel. Supabase pour DB/auth, Upstash Redis pour cache, Claude AI + Perplexity pour l'intelligence.

**Tech Stack:** Next.js 14, TypeScript strict, TailwindCSS, shadcn/ui, Supabase, Upstash Redis, Anthropic Claude API, Perplexity Sonar API, Zod, axios, xml2js

---

## Task 1 : Initialisation du projet Next.js

**Files:**
- Create: `crisis-travel/` (racine projet)
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `tailwind.config.ts`

**Step 1: Initialiser Next.js avec TypeScript + Tailwind**
```bash
cd "c:/Users/asus/Desktop/01_PROJETS_ACTIFS/appli voyage"
npx create-next-app@latest crisis-travel --typescript --tailwind --app --no-src-dir --import-alias "@/*" --use-npm
```

**Step 2: Installer les dépendances**
```bash
cd crisis-travel
npm install @anthropic-ai/sdk axios xml2js zod @upstash/redis @supabase/supabase-js
npm install framer-motion recharts react-hook-form @hookform/resolvers
npm install -D @types/xml2js
```

**Step 3: Installer shadcn/ui**
```bash
npx shadcn@latest init
# Choisir : Dark theme, CSS variables, default style
```

**Step 4: Ajouter les composants shadcn nécessaires**
```bash
npx shadcn@latest add button card badge slider progress tabs dialog
```

**Step 5: Copier les fichiers de documentation déjà créés**
```bash
# Les fichiers docs/, CLAUDE.md, PRD.md, .env.example sont déjà dans le dossier parent
# Les déplacer dans le nouveau projet ou s'assurer qu'ils sont au bon endroit
```

**Step 6: Configurer .env.local**
```bash
cp .env.example .env.local
# Remplir les clés : ANTHROPIC_API_KEY, PERPLEXITY_API_KEY, UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN
# Supabase : NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
```

**Step 7: Commit initial**
```bash
git init
git add .
git commit -m "feat: initialisation projet Crisis Travel"
```

---

## Task 2 : Configuration TypeScript et types métier

**Files:**
- Create: `types/crisis.types.ts`
- Create: `types/api.types.ts`
- Modify: `tsconfig.json`

**Step 1: Vérifier tsconfig.json (strict mode)**
```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "target": "es2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "paths": { "@/*": ["./*"] }
  }
}
```

**Step 2: Créer types/crisis.types.ts**
```typescript
export interface UserProfile {
  departureCountry: string;
  budget: number;
  duration: number;
  period: string;
  travelType: 'solo' | 'couple' | 'family' | 'nomad';
  mode: 'standard' | 'bunker' | 'budget_crisis';
  excludedContinents?: string[];
}

export interface SubScore {
  value: number;           // 0-100
  source: 'live' | 'fallback' | 'partial';
  confidence: 'high' | 'medium' | 'low';
  details: Record<string, number | string>;
}

export interface CrisisScore {
  country: string;
  countryCode: string;
  total: number;           // 0-100
  security: SubScore;
  geopolitical: SubScore;
  budget: SubScore;
  practicality: SubScore;
  status: 'ideal' | 'recommended' | 'possible' | 'discouraged';
  confidence: 'high' | 'medium' | 'low';
  calculatedAt: string;   // ISO date
  opportunities?: string[];
}

export interface AnalyzeRequest {
  profile: UserProfile;
  targetCountries?: string[];  // si vide = scan mondial
}

export interface AnalyzeResponse {
  results: CrisisScore[];
  topDestinations: CrisisScore[];
  opportunities: OpportunityWindow[];
  meta: {
    analyzedCountries: number;
    duration: number;
    cacheHitRate: number;
  };
}

export interface OpportunityWindow {
  countryCode: string;
  country: string;
  type: 'currency' | 'security_improved' | 'cheap_flights' | 'jackpot';
  explanation: string;
  estimatedSaving: number;
  score: number;
}

export type StatusColor = 'green' | 'yellow' | 'orange' | 'red';

export function getScoreStatus(score: number): CrisisScore['status'] {
  if (score >= 80) return 'ideal';
  if (score >= 60) return 'recommended';
  if (score >= 40) return 'possible';
  return 'discouraged';
}

export function getScoreColor(score: number): StatusColor {
  if (score >= 80) return 'green';
  if (score >= 60) return 'yellow';
  if (score >= 40) return 'orange';
  return 'red';
}
```

**Step 3: Créer types/api.types.ts**
```typescript
export interface ServiceResult<T> {
  data: T;
  source: 'live' | 'fallback';
  error?: string;
  cachedAt?: string;
}

export interface MEAEAlert {
  country: string;
  level: 1 | 2 | 3 | 4;
  description: string;
  updatedAt: string;
}

export interface ACLEDResult {
  countryCode: string;
  incidentCount: number;
  fatalitiesTotal: number;
  lastIncidentDate: string;
}

export interface PerplexityGeoAnalysis {
  stabilityScore: number;
  summary: string;
  mainRisks: string[];
  recentEvents: string[];
  trend: 'improving' | 'stable' | 'deteriorating';
}

export interface FrankfurterRate {
  base: string;
  target: string;
  currentRate: number;
  avg12mRate: number;
  variation: number;  // % de variation favorable pour EUR
}

export interface NumbeoData {
  city: string;
  country: string;
  costOfLivingIndex: number;
  rentIndex: number;
  restaurantIndex: number;
  mealCheap: number;   // EUR
  hotelAvg: number;    // EUR/nuit
}
```

**Step 4: Commit**
```bash
git add types/
git commit -m "feat: types TypeScript métier (CrisisScore, UserProfile, API types)"
```

---

## Task 3 : Infrastructure Cache Redis

**Files:**
- Create: `lib/cache/redis.ts`

**Step 1: Créer lib/cache/redis.ts**
```typescript
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export type CacheTTL = 300 | 1800 | 3600 | 21600 | 86400;
// 5min | 30min | 1h | 6h | 24h

export async function getFromCache<T>(key: string): Promise<T | null> {
  try {
    const data = await redis.get<T>(key);
    return data;
  } catch (error) {
    console.error('[Redis] Erreur get:', key, error);
    return null;
  }
}

export async function setInCache<T>(
  key: string,
  data: T,
  ttlSeconds: CacheTTL
): Promise<void> {
  try {
    await redis.setex(key, ttlSeconds, data);
  } catch (error) {
    console.error('[Redis] Erreur set:', key, error);
  }
}

export function buildCacheKey(service: string, ...parts: string[]): string {
  return `crisis-travel:${service}:${parts.join(':')}`;
}

export async function withCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl: CacheTTL
): Promise<{ data: T; fromCache: boolean }> {
  const cached = await getFromCache<T>(key);
  if (cached !== null) {
    return { data: cached, fromCache: true };
  }
  const data = await fetcher();
  await setInCache(key, data, ttl);
  return { data, fromCache: false };
}
```

**Step 2: Commit**
```bash
git add lib/cache/
git commit -m "feat: infrastructure cache Upstash Redis avec withCache helper"
```

---

## Task 4 : Utilitaires — Normalisation et Logger

**Files:**
- Create: `lib/utils/normalize.ts`
- Create: `lib/utils/logger.ts`
- Create: `lib/utils/countries.ts`

**Step 1: Créer lib/utils/normalize.ts**
```typescript
export function clamp(value: number, min = 0, max = 100): number {
  return Math.min(max, Math.max(min, value));
}

export function normalize(value: number, min: number, max: number): number {
  return clamp(Math.round(((value - min) / (max - min)) * 100));
}

export function normalizeWorldBankIndicator(value: number | null): number {
  // Indicateurs WB : -2.5 à +2.5
  if (value === null) return 50;
  return normalize(value, -2.5, 2.5);
}

export function meaeLevelToScore(level: 1 | 2 | 3 | 4): number {
  const map = { 1: 100, 2: 70, 3: 25, 4: 0 };
  return map[level];
}

export function acledIncidentsToScore(count: number, fatalities: number): number {
  const base = count === 0 ? 100
    : count <= 5 ? 80
    : count <= 20 ? 50
    : count <= 50 ? 20
    : 0;
  const fatalityMalus = fatalities > 10 ? -15 : 0;
  return clamp(base + fatalityMalus);
}

export function currencyVariationToScore(variationPercent: number): number {
  // Variation positive = EUR vaut plus = bon pour voyageur
  return clamp(50 + variationPercent * 2);
}

export function costOfLivingToScore(numbeoIndex: number): number {
  if (numbeoIndex < 30) return 100;
  if (numbeoIndex < 50) return 80;
  if (numbeoIndex < 70) return 60;
  if (numbeoIndex < 90) return 40;
  return 20;
}
```

**Step 2: Créer lib/utils/logger.ts**
```typescript
const isDev = process.env.NODE_ENV === 'development';

export const logger = {
  api(service: string, country: string, duration: number, fromCache: boolean) {
    if (isDev) {
      console.log(
        `[${service}] country=${country} duration=${duration}ms cache=${fromCache ? 'HIT' : 'MISS'}`
      );
    }
  },
  error(service: string, error: unknown) {
    console.error(`[${service}] ERREUR:`, error);
  },
  warn(service: string, message: string) {
    console.warn(`[${service}] WARN: ${message}`);
  },
};
```

**Step 3: Créer lib/utils/countries.ts** (liste des pays avec codes ISO)
```typescript
// Pays analysés par défaut (50 pays les plus visités + zones à surveiller)
export const TARGET_COUNTRIES = [
  { code: 'TH', name: 'Thaïlande', continent: 'Asia' },
  { code: 'GE', name: 'Géorgie', continent: 'Europe' },
  { code: 'PT', name: 'Portugal', continent: 'Europe' },
  { code: 'MA', name: 'Maroc', continent: 'Africa' },
  { code: 'VN', name: 'Vietnam', continent: 'Asia' },
  { code: 'MX', name: 'Mexique', continent: 'Americas' },
  { code: 'AL', name: 'Albanie', continent: 'Europe' },
  { code: 'KG', name: 'Kirghizistan', continent: 'Asia' },
  { code: 'MD', name: 'Moldavie', continent: 'Europe' },
  { code: 'XK', name: 'Kosovo', continent: 'Europe' },
  { code: 'JP', name: 'Japon', continent: 'Asia' },
  { code: 'ID', name: 'Indonésie', continent: 'Asia' },
  { code: 'CO', name: 'Colombie', continent: 'Americas' },
  { code: 'PE', name: 'Pérou', continent: 'Americas' },
  { code: 'TR', name: 'Turquie', continent: 'Europe' },
  { code: 'EG', name: 'Égypte', continent: 'Africa' },
  { code: 'TN', name: 'Tunisie', continent: 'Africa' },
  { code: 'RS', name: 'Serbie', continent: 'Europe' },
  { code: 'BA', name: 'Bosnie', continent: 'Europe' },
  { code: 'MK', name: 'Macédoine du Nord', continent: 'Europe' },
  // Ajouter jusqu'à 50-100 pays...
] as const;

export type CountryCode = typeof TARGET_COUNTRIES[number]['code'];
```

**Step 4: Commit**
```bash
git add lib/utils/
git commit -m "feat: utilitaires normalisation, logger, liste pays cibles"
```

---

## Task 5 : Services Sécurité

**Files:**
- Create: `lib/services/security/meae.service.ts`
- Create: `lib/services/security/stateDept.service.ts`
- Create: `lib/services/security/acled.service.ts`
- Create: `lib/services/security/reliefweb.service.ts`
- Create: `lib/services/security/index.ts`

**Step 1: Créer lib/services/security/meae.service.ts**
```typescript
import axios from 'axios';
import * as xml2js from 'xml2js';
import { withCache, buildCacheKey } from '@/lib/cache/redis';
import { meaeLevelToScore } from '@/lib/utils/normalize';
import { logger } from '@/lib/utils/logger';
import type { MEAEAlert, ServiceResult } from '@/types/api.types';

const MEAE_BASE = 'https://www.diplomatie.gouv.fr';

async function fetchMEAEAlert(countrySlug: string): Promise<MEAEAlert> {
  const url = `${MEAE_BASE}/fr/conseils-aux-voyageurs/conseils-par-pays-destination/${countrySlug}/`;
  const start = Date.now();
  const response = await axios.get(url, { timeout: 5000 });
  logger.api('MEAE', countrySlug, Date.now() - start, false);

  // Parser le HTML pour extraire le niveau (regex sur le contenu)
  const html = response.data as string;
  const levelMatch = html.match(/Niveau\s+(\d)\s*[-–]/i);
  const level = levelMatch ? (parseInt(levelMatch[1]) as 1 | 2 | 3 | 4) : 1;

  return {
    country: countrySlug,
    level,
    description: `Niveau ${level}`,
    updatedAt: new Date().toISOString(),
  };
}

export async function getMEAEScore(
  countrySlug: string
): Promise<ServiceResult<{ score: number; level: number }>> {
  const cacheKey = buildCacheKey('meae', countrySlug);
  try {
    const { data, fromCache } = await withCache(
      cacheKey,
      () => fetchMEAEAlert(countrySlug),
      1800 // 30 minutes
    );
    if (fromCache) logger.api('MEAE', countrySlug, 0, true);
    return {
      data: { score: meaeLevelToScore(data.level), level: data.level },
      source: 'live',
    };
  } catch (error) {
    logger.error('MEAE', error);
    return {
      data: { score: 50, level: 1 },
      source: 'fallback',
      error: String(error),
    };
  }
}
```

**Step 2: Créer lib/services/security/acled.service.ts**
```typescript
import axios from 'axios';
import { withCache, buildCacheKey } from '@/lib/cache/redis';
import { acledIncidentsToScore } from '@/lib/utils/normalize';
import { logger } from '@/lib/utils/logger';
import type { ACLEDResult, ServiceResult } from '@/types/api.types';

const ACLED_BASE = 'https://api.acleddata.com';

function getLast30Days(): { start: string; end: string } {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 30);
  return {
    start: start.toISOString().split('T')[0],
    end: end.toISOString().split('T')[0],
  };
}

async function fetchACLEDData(countryName: string): Promise<ACLEDResult> {
  const { start, end } = getLast30Days();
  const params = {
    key: process.env.ACLED_ACCESS_KEY,
    email: process.env.ACLED_EMAIL,
    country: countryName,
    event_date: `${start}|${end}`,
    event_date_where: 'BETWEEN',
    event_type: 'Battles|Explosions/Remote violence|Violence against civilians',
    fields: 'event_date,event_type,fatalities,country',
    limit: 500,
  };

  const start_time = Date.now();
  const response = await axios.get(`${ACLED_BASE}/acled/read`, { params, timeout: 5000 });
  logger.api('ACLED', countryName, Date.now() - start_time, false);

  const incidents = response.data.data || [];
  const totalFatalities = incidents.reduce(
    (sum: number, i: { fatalities: number }) => sum + (i.fatalities || 0),
    0
  );

  return {
    countryCode: countryName,
    incidentCount: incidents.length,
    fatalitiesTotal: totalFatalities,
    lastIncidentDate: incidents[0]?.event_date || '',
  };
}

export async function getACLEDScore(
  countryName: string,
  countryCode: string
): Promise<ServiceResult<{ score: number; incidents: number; fatalities: number }>> {
  const cacheKey = buildCacheKey('acled', countryCode);
  try {
    if (!process.env.ACLED_ACCESS_KEY || !process.env.ACLED_EMAIL) {
      logger.warn('ACLED', 'Clés API non configurées — fallback neutre');
      return { data: { score: 50, incidents: 0, fatalities: 0 }, source: 'fallback' };
    }
    const { data, fromCache } = await withCache(
      cacheKey,
      () => fetchACLEDData(countryName),
      21600 // 6h
    );
    if (fromCache) logger.api('ACLED', countryCode, 0, true);
    return {
      data: {
        score: acledIncidentsToScore(data.incidentCount, data.fatalitiesTotal),
        incidents: data.incidentCount,
        fatalities: data.fatalitiesTotal,
      },
      source: 'live',
    };
  } catch (error) {
    logger.error('ACLED', error);
    return { data: { score: 50, incidents: 0, fatalities: 0 }, source: 'fallback', error: String(error) };
  }
}
```

**Step 3: Créer lib/services/security/reliefweb.service.ts**
```typescript
import axios from 'axios';
import { withCache, buildCacheKey } from '@/lib/cache/redis';
import { logger } from '@/lib/utils/logger';
import type { ServiceResult } from '@/types/api.types';

const RELIEFWEB_BASE = 'https://api.reliefweb.int/v1';

export async function getReliefWebScore(
  iso3: string
): Promise<ServiceResult<{ score: number; activeCrises: number }>> {
  const cacheKey = buildCacheKey('reliefweb', iso3);
  try {
    const { data: response, fromCache } = await withCache(
      cacheKey,
      async () => {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const res = await axios.post(
          `${RELIEFWEB_BASE}/reports?appname=crisis-travel`,
          {
            filter: {
              operator: 'AND',
              conditions: [
                { field: 'country.iso3', value: iso3 },
                { field: 'date.created', value: { from: thirtyDaysAgo.toISOString() } },
              ],
            },
            fields: { include: ['title', 'date', 'status'] },
            limit: 5,
          },
          { timeout: 5000 }
        );
        logger.api('ReliefWeb', iso3, 0, false);
        return res.data;
      },
      7200 // 2h
    );
    if (fromCache) logger.api('ReliefWeb', iso3, 0, true);
    const criseCount = response.totalCount || 0;
    return {
      data: { score: criseCount > 0 ? 30 : 100, activeCrises: criseCount },
      source: 'live',
    };
  } catch (error) {
    logger.error('ReliefWeb', error);
    return { data: { score: 100, activeCrises: 0 }, source: 'fallback', error: String(error) };
  }
}
```

**Step 4: Créer lib/services/security/stateDept.service.ts**
```typescript
import axios from 'axios';
import { withCache, buildCacheKey } from '@/lib/cache/redis';
import { meaeLevelToScore } from '@/lib/utils/normalize';
import { logger } from '@/lib/utils/logger';
import type { ServiceResult } from '@/types/api.types';

// Mapping manuel basé sur les données State Dept (à enrichir)
const STATE_DEPT_FALLBACK: Record<string, 1 | 2 | 3 | 4> = {
  TH: 1, JP: 1, PT: 1, GE: 2, MA: 2, VN: 1, MX: 2, TR: 2,
  EG: 2, SD: 4, SY: 4, YE: 4, AF: 4, IQ: 4, UA: 4,
};

export async function getStateDeptScore(
  countryCode: string
): Promise<ServiceResult<{ score: number; level: number }>> {
  const cacheKey = buildCacheKey('statedept', countryCode);
  try {
    const { data } = await withCache(
      cacheKey,
      async () => {
        // Scraping du XML State Dept (structure simplifiée)
        const response = await axios.get(
          'https://travel.state.gov/content/dam/NEWTravelAssets/pdfs/travel-advisories-2024.json',
          { timeout: 5000 }
        );
        logger.api('StateDept', countryCode, 0, false);
        return response.data;
      },
      3600 // 1h
    );
    // Chercher le pays dans la réponse
    const level = STATE_DEPT_FALLBACK[countryCode] ?? 1;
    return { data: { score: meaeLevelToScore(level), level }, source: 'live' };
  } catch (error) {
    logger.error('StateDept', error);
    const level = STATE_DEPT_FALLBACK[countryCode] ?? 2;
    return { data: { score: meaeLevelToScore(level), level }, source: 'fallback', error: String(error) };
  }
}
```

**Step 5: Commit**
```bash
git add lib/services/security/
git commit -m "feat: services sécurité (MEAE, ACLED, ReliefWeb, State Dept)"
```

---

## Task 6 : Services Géopolitiques

**Files:**
- Create: `lib/services/geopolitical/perplexity.service.ts`
- Create: `lib/services/geopolitical/worldbank.service.ts`
- Create: `lib/services/geopolitical/gdelt.service.ts`

**Step 1: Créer lib/services/geopolitical/perplexity.service.ts**
```typescript
import axios from 'axios';
import { withCache, buildCacheKey } from '@/lib/cache/redis';
import { logger } from '@/lib/utils/logger';
import type { PerplexityGeoAnalysis, ServiceResult } from '@/types/api.types';

const PERPLEXITY_BASE = 'https://api.perplexity.ai';

function buildGeoPrompt(country: string): string {
  return `Analyse la situation géopolitique actuelle de ${country} pour un voyageur français en ${new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}.

Retourne UNIQUEMENT ce JSON valide, sans markdown :
{
  "stabilityScore": <entier 0-100, 100=très stable>,
  "summary": "<2 phrases sur la situation actuelle>",
  "mainRisks": ["<risque1>", "<risque2>"],
  "recentEvents": ["<événement récent pertinent>"],
  "trend": "<improving|stable|deteriorating>"
}

Sois factuel, basé sur les actualités récentes.`;
}

export async function getPerplexityGeoScore(
  country: string,
  countryCode: string
): Promise<ServiceResult<PerplexityGeoAnalysis>> {
  const cacheKey = buildCacheKey('perplexity-geo', countryCode);
  const fallback: PerplexityGeoAnalysis = {
    stabilityScore: 50,
    summary: 'Analyse géopolitique temporairement indisponible.',
    mainRisks: [],
    recentEvents: [],
    trend: 'stable',
  };

  try {
    if (!process.env.PERPLEXITY_API_KEY) {
      logger.warn('Perplexity', 'API Key manquante');
      return { data: fallback, source: 'fallback' };
    }

    const { data, fromCache } = await withCache(
      cacheKey,
      async () => {
        const start = Date.now();
        const response = await axios.post(
          `${PERPLEXITY_BASE}/chat/completions`,
          {
            model: 'sonar',
            messages: [{ role: 'user', content: buildGeoPrompt(country) }],
            max_tokens: 500,
          },
          {
            headers: {
              Authorization: `Bearer ${process.env.PERPLEXITY_API_KEY}`,
              'Content-Type': 'application/json',
            },
            timeout: 8000,
          }
        );
        logger.api('Perplexity', countryCode, Date.now() - start, false);
        const content = response.data.choices[0].message.content as string;
        return JSON.parse(content) as PerplexityGeoAnalysis;
      },
      1800 // 30min
    );
    if (fromCache) logger.api('Perplexity', countryCode, 0, true);
    return { data, source: 'live' };
  } catch (error) {
    logger.error('Perplexity', error);
    return { data: fallback, source: 'fallback', error: String(error) };
  }
}
```

**Step 2: Créer lib/services/geopolitical/worldbank.service.ts**
```typescript
import axios from 'axios';
import { withCache, buildCacheKey } from '@/lib/cache/redis';
import { normalizeWorldBankIndicator } from '@/lib/utils/normalize';
import { logger } from '@/lib/utils/logger';
import type { ServiceResult } from '@/types/api.types';

const WB_BASE = 'https://api.worldbank.org/v2';
const INDICATORS = ['PV.EST', 'RL.EST', 'GE.EST'];

async function fetchWBIndicator(countryCode: string, indicator: string): Promise<number | null> {
  const url = `${WB_BASE}/country/${countryCode}/indicator/${indicator}`;
  const response = await axios.get(url, {
    params: { format: 'json', mrv: 1 },
    timeout: 5000,
  });
  const data = response.data;
  if (Array.isArray(data) && data[1]?.length > 0) {
    return data[1][0].value as number | null;
  }
  return null;
}

export async function getWorldBankScore(
  countryCode: string
): Promise<ServiceResult<{ score: number; indicators: Record<string, number> }>> {
  const cacheKey = buildCacheKey('worldbank', countryCode);
  try {
    const { data, fromCache } = await withCache(
      cacheKey,
      async () => {
        const start = Date.now();
        const values = await Promise.all(
          INDICATORS.map((ind) => fetchWBIndicator(countryCode.toLowerCase(), ind))
        );
        logger.api('WorldBank', countryCode, Date.now() - start, false);
        return Object.fromEntries(INDICATORS.map((ind, i) => [ind, values[i]]));
      },
      86400 // 24h
    );
    if (fromCache) logger.api('WorldBank', countryCode, 0, true);

    const indicators = data as Record<string, number | null>;
    const scores = INDICATORS.map((ind) => normalizeWorldBankIndicator(indicators[ind] ?? null));
    const avgScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);

    return {
      data: {
        score: avgScore,
        indicators: Object.fromEntries(INDICATORS.map((ind, i) => [ind, scores[i]])),
      },
      source: 'live',
    };
  } catch (error) {
    logger.error('WorldBank', error);
    return { data: { score: 50, indicators: {} }, source: 'fallback', error: String(error) };
  }
}
```

**Step 3: Commit**
```bash
git add lib/services/geopolitical/
git commit -m "feat: services géopolitiques (Perplexity Sonar, World Bank)"
```

---

## Task 7 : Services Budget

**Files:**
- Create: `lib/services/budget/frankfurter.service.ts`
- Create: `lib/services/budget/numbeo.service.ts`

**Step 1: Créer lib/services/budget/frankfurter.service.ts**
```typescript
import axios from 'axios';
import { withCache, buildCacheKey } from '@/lib/cache/redis';
import { currencyVariationToScore } from '@/lib/utils/normalize';
import { logger } from '@/lib/utils/logger';
import type { FrankfurterRate, ServiceResult } from '@/types/api.types';

const FRANKFURTER_BASE = 'https://api.frankfurter.app';

// Mapping pays → devise ISO
const COUNTRY_CURRENCY: Record<string, string> = {
  TH: 'THB', GE: 'GEL', MA: 'MAD', VN: 'VND', MX: 'MXN',
  TR: 'TRY', EG: 'EGP', RS: 'RSD', AL: 'ALL', CO: 'COP',
  JP: 'JPY', ID: 'IDR', PE: 'PEN', TN: 'TND', PT: 'EUR',
};

export async function getFrankfurterScore(
  countryCode: string
): Promise<ServiceResult<{ score: number; currency: string; variation: number }>> {
  const currency = COUNTRY_CURRENCY[countryCode];
  if (!currency || currency === 'EUR') {
    return { data: { score: 60, currency: 'EUR', variation: 0 }, source: 'fallback' };
  }

  const cacheKey = buildCacheKey('frankfurter', countryCode);
  try {
    const { data, fromCache } = await withCache(
      cacheKey,
      async () => {
        const start = Date.now();
        const yearAgo = new Date();
        yearAgo.setFullYear(yearAgo.getFullYear() - 1);
        const dateStr = yearAgo.toISOString().split('T')[0];

        const [current, historical] = await Promise.all([
          axios.get(`${FRANKFURTER_BASE}/latest`, { params: { from: 'EUR', to: currency }, timeout: 5000 }),
          axios.get(`${FRANKFURTER_BASE}/${dateStr}`, { params: { from: 'EUR', to: currency }, timeout: 5000 }),
        ]);
        logger.api('Frankfurter', countryCode, Date.now() - start, false);

        const currentRate = current.data.rates[currency] as number;
        const historicalRate = historical.data.rates[currency] as number;
        const variation = ((currentRate - historicalRate) / historicalRate) * 100;
        return { currentRate, historicalRate, variation } as FrankfurterRate & { currentRate: number; historicalRate: number; variation: number };
      },
      3600 // 1h
    );
    if (fromCache) logger.api('Frankfurter', countryCode, 0, true);

    return {
      data: {
        score: currencyVariationToScore(data.variation),
        currency,
        variation: Math.round(data.variation * 10) / 10,
      },
      source: 'live',
    };
  } catch (error) {
    logger.error('Frankfurter', error);
    return { data: { score: 50, currency, variation: 0 }, source: 'fallback', error: String(error) };
  }
}
```

**Step 2: Créer lib/services/budget/numbeo.service.ts**
```typescript
import axios from 'axios';
import { withCache, buildCacheKey } from '@/lib/cache/redis';
import { costOfLivingToScore } from '@/lib/utils/normalize';
import { logger } from '@/lib/utils/logger';
import type { NumbeoData, ServiceResult } from '@/types/api.types';

// Données statiques de fallback (mise à jour manuelle trimestrielle)
const NUMBEO_FALLBACK: Record<string, Partial<NumbeoData>> = {
  TH: { costOfLivingIndex: 42, mealCheap: 2.5, hotelAvg: 25 },
  GE: { costOfLivingIndex: 35, mealCheap: 3, hotelAvg: 30 },
  MA: { costOfLivingIndex: 38, mealCheap: 3.5, hotelAvg: 40 },
  PT: { costOfLivingIndex: 58, mealCheap: 10, hotelAvg: 80 },
  JP: { costOfLivingIndex: 72, mealCheap: 8, hotelAvg: 70 },
  VN: { costOfLivingIndex: 36, mealCheap: 2, hotelAvg: 20 },
  TR: { costOfLivingIndex: 33, mealCheap: 3, hotelAvg: 35 },
  AL: { costOfLivingIndex: 37, mealCheap: 4, hotelAvg: 35 },
};

export async function getNumbeoScore(
  countryCode: string
): Promise<ServiceResult<{ score: number; data: Partial<NumbeoData> }>> {
  const cacheKey = buildCacheKey('numbeo', countryCode);
  try {
    if (!process.env.NUMBEO_API_KEY) {
      const fallback = NUMBEO_FALLBACK[countryCode] ?? { costOfLivingIndex: 60 };
      return {
        data: { score: costOfLivingToScore(fallback.costOfLivingIndex ?? 60), data: fallback },
        source: 'fallback',
      };
    }

    const { data, fromCache } = await withCache(
      cacheKey,
      async () => {
        const start = Date.now();
        const response = await axios.get('https://www.numbeo.com/api/country_prices', {
          params: { api_key: process.env.NUMBEO_API_KEY, country: countryCode, currency: 'EUR' },
          timeout: 5000,
        });
        logger.api('Numbeo', countryCode, Date.now() - start, false);
        return response.data as NumbeoData;
      },
      86400 // 24h
    );
    if (fromCache) logger.api('Numbeo', countryCode, 0, true);

    return {
      data: {
        score: costOfLivingToScore(data.costOfLivingIndex ?? 60),
        data,
      },
      source: 'live',
    };
  } catch (error) {
    logger.error('Numbeo', error);
    const fallback = NUMBEO_FALLBACK[countryCode] ?? { costOfLivingIndex: 60 };
    return {
      data: { score: costOfLivingToScore(fallback.costOfLivingIndex ?? 60), data: fallback },
      source: 'fallback',
      error: String(error),
    };
  }
}
```

**Step 3: Commit**
```bash
git add lib/services/budget/
git commit -m "feat: services budget (Frankfurter taux de change, Numbeo coût de vie)"
```

---

## Task 8 : Algorithme CrisisScore

**Files:**
- Create: `lib/services/scoring/crisisScore.service.ts`

**Step 1: Créer lib/services/scoring/crisisScore.service.ts**
```typescript
import { getMEAEScore } from '@/lib/services/security/meae.service';
import { getACLEDScore } from '@/lib/services/security/acled.service';
import { getStateDeptScore } from '@/lib/services/security/stateDept.service';
import { getReliefWebScore } from '@/lib/services/security/reliefweb.service';
import { getPerplexityGeoScore } from '@/lib/services/geopolitical/perplexity.service';
import { getWorldBankScore } from '@/lib/services/geopolitical/worldbank.service';
import { getFrankfurterScore } from '@/lib/services/budget/frankfurter.service';
import { getNumbeoScore } from '@/lib/services/budget/numbeo.service';
import { clamp, getScoreStatus } from '@/types/crisis.types';
import type { CrisisScore, SubScore, UserProfile } from '@/types/crisis.types';

interface CountryInfo {
  code: string;
  name: string;
  meaeSlug?: string;
  iso3?: string;
  acledName?: string;
  currency?: string;
}

function buildSubScore(
  value: number,
  sources: Array<{ source: 'live' | 'fallback' }>,
  details: Record<string, number | string>
): SubScore {
  const fallbackCount = sources.filter((s) => s.source === 'fallback').length;
  const confidence =
    fallbackCount === 0 ? 'high' : fallbackCount <= 1 ? 'medium' : 'low';
  return {
    value: clamp(Math.round(value)),
    source: fallbackCount === 0 ? 'live' : fallbackCount === sources.length ? 'fallback' : 'partial',
    confidence,
    details,
  };
}

async function calculateSecurityScore(country: CountryInfo): Promise<SubScore> {
  const [meae, acled, stateDept, reliefweb] = await Promise.allSettled([
    getMEAEScore(country.meaeSlug ?? country.name),
    getACLEDScore(country.acledName ?? country.name, country.code),
    getStateDeptScore(country.code),
    getReliefWebScore(country.iso3 ?? country.code),
  ]);

  const get = <T>(result: PromiseSettledResult<T>, fallback: T): T =>
    result.status === 'fulfilled' ? result.value : fallback;

  const m = get(meae, { data: { score: 50, level: 1 }, source: 'fallback' as const });
  const a = get(acled, { data: { score: 50, incidents: 0, fatalities: 0 }, source: 'fallback' as const });
  const s = get(stateDept, { data: { score: 50, level: 1 }, source: 'fallback' as const });
  const r = get(reliefweb, { data: { score: 100, activeCrises: 0 }, source: 'fallback' as const });

  const value = m.data.score * 0.35 + a.data.score * 0.30 + s.data.score * 0.20 + r.data.score * 0.05
    + 50 * 0.10; // FCDO non implémenté → neutre

  return buildSubScore(value, [m, a, s, r], {
    meaeLevel: m.data.level,
    acledIncidents: a.data.incidents,
    stateDeptLevel: s.data.level,
    activeCrises: r.data.activeCrises,
  });
}

async function calculateGeopoliticalScore(country: CountryInfo): Promise<SubScore> {
  const [perplexity, worldbank] = await Promise.allSettled([
    getPerplexityGeoScore(country.name, country.code),
    getWorldBankScore(country.code),
  ]);

  const get = <T>(result: PromiseSettledResult<T>, fallback: T): T =>
    result.status === 'fulfilled' ? result.value : fallback;

  const p = get(perplexity, { data: { stabilityScore: 50, summary: '', mainRisks: [], recentEvents: [], trend: 'stable' as const }, source: 'fallback' as const });
  const w = get(worldbank, { data: { score: 50, indicators: {} }, source: 'fallback' as const });

  const value = p.data.stabilityScore * 0.40 + w.data.score * 0.25 + 50 * 0.20 + 70 * 0.15;
  // GDELT (50 neutre) et visa (70 défaut optimiste) non encore implémentés

  return buildSubScore(value, [p, w], {
    perplexityScore: p.data.stabilityScore,
    trend: p.data.trend,
    worldBankScore: w.data.score,
  });
}

async function calculateBudgetScore(
  country: CountryInfo,
  _profile: UserProfile
): Promise<SubScore> {
  const [fx, numbeo] = await Promise.allSettled([
    getFrankfurterScore(country.code),
    getNumbeoScore(country.code),
  ]);

  const get = <T>(result: PromiseSettledResult<T>, fallback: T): T =>
    result.status === 'fulfilled' ? result.value : fallback;

  const f = get(fx, { data: { score: 50, currency: '?', variation: 0 }, source: 'fallback' as const });
  const n = get(numbeo, { data: { score: 50, data: {} }, source: 'fallback' as const });

  // Vol et hébergement : valeur neutre en MVP (Phase 2 = Amadeus + Booking)
  const value = f.data.score * 0.30 + 50 * 0.30 + n.data.score * 0.25 + 50 * 0.15;

  return buildSubScore(value, [f, n], {
    currencyVariation: f.data.variation,
    costOfLivingScore: n.data.score,
    currency: f.data.currency,
  });
}

function calculatePracticalityScore(): SubScore {
  // MVP : score neutre fixe en attendant les données de visa et vols
  return buildSubScore(65, [], {
    note: 'Score praticité calculé en Phase 2 (visa + vols réels)',
  });
}

export async function calculateCrisisScore(
  country: CountryInfo,
  profile: UserProfile
): Promise<CrisisScore> {
  const [security, geopolitical, budget] = await Promise.all([
    calculateSecurityScore(country),
    calculateGeopoliticalScore(country),
    calculateBudgetScore(country, profile),
  ]);

  const practicality = calculatePracticalityScore();

  const total = clamp(
    Math.round(
      security.value * 0.40 +
      geopolitical.value * 0.30 +
      budget.value * 0.20 +
      practicality.value * 0.10
    )
  );

  const allConfidences = [security, geopolitical, budget, practicality].map((s) => s.confidence);
  const overallConfidence =
    allConfidences.filter((c) => c === 'low').length >= 2 ? 'low'
    : allConfidences.filter((c) => c === 'medium').length >= 2 ? 'medium'
    : 'high';

  return {
    country: country.name,
    countryCode: country.code,
    total,
    security,
    geopolitical,
    budget,
    practicality,
    status: getScoreStatus(total),
    confidence: overallConfidence,
    calculatedAt: new Date().toISOString(),
  };
}
```

**Step 2: Commit**
```bash
git add lib/services/scoring/
git commit -m "feat: algorithme CrisisScore avec agrégation pondérée des sous-scores"
```

---

## Task 9 : Service Claude AI

**Files:**
- Create: `lib/claude/claude.service.ts`

**Step 1: Créer lib/claude/claude.service.ts**
```typescript
import Anthropic from '@anthropic-ai/sdk';
import { withCache, buildCacheKey } from '@/lib/cache/redis';
import { logger } from '@/lib/utils/logger';
import type { CrisisScore, UserProfile } from '@/types/crisis.types';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function generateDestinationNarrative(
  score: CrisisScore,
  profile: UserProfile
): Promise<string> {
  const cacheKey = buildCacheKey('claude-narrative', score.countryCode, score.total.toString());
  const { data, fromCache } = await withCache(
    cacheKey,
    async () => {
      const start = Date.now();
      const message = await client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 800,
        messages: [
          {
            role: 'user',
            content: `Tu es un expert en géopolitique et voyage. Voici les données actuelles sur ${score.country} :

CrisisScore global : ${score.total}/100 (${score.status})
- Sécurité : ${score.security.value}/100 (confiance: ${score.security.confidence})
- Géopolitique : ${score.geopolitical.value}/100 (tendance: ${score.geopolitical.details.trend ?? 'inconnue'})
- Budget : ${score.budget.value}/100 (variation monnaie: ${score.budget.details.currencyVariation ?? 0}%)
- Praticité : ${score.practicality.value}/100

Profil voyageur : ${profile.travelType}, budget ${profile.budget}€, durée ${profile.duration} jours, depuis ${profile.departureCountry}.

Rédige en français un argumentaire de 3 paragraphes courts expliquant pourquoi ce pays est ${score.total >= 60 ? 'recommandé' : 'déconseillé'} en ce moment pour ce profil. Sois factuel, précis. Termine par "**Risques résiduels :** [3 risques concrets à anticiper]".`,
          },
        ],
      });
      logger.api('Claude', score.countryCode, Date.now() - start, false);
      return (message.content[0] as { text: string }).text;
    },
    3600 // 1h
  );
  if (fromCache) logger.api('Claude', score.countryCode, 0, true);
  return data;
}

export async function detectOpportunities(
  scores: CrisisScore[],
  budget: number
): Promise<Array<{ countryCode: string; type: string; explanation: string; estimatedSaving: number }>> {
  try {
    const topCountries = scores.filter((s) => s.total >= 55).slice(0, 15);
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 600,
      messages: [
        {
          role: 'user',
          content: `Voici les données économiques pour des pays avec un bon CrisisScore :
${topCountries.map((s) => `${s.country} (${s.countryCode}): budget=${s.budget.value}/100, currencyVariation=${s.budget.details.currencyVariation ?? 0}%`).join('\n')}

Budget voyageur : ${budget}€. Identifie 3 pays avec une opportunité économique exceptionnelle actuellement pour un voyageur européen.

Réponds UNIQUEMENT avec ce JSON valide :
[{"countryCode":"XX","type":"currency|security_improved|cheap_flights|jackpot","explanation":"<1 phrase>","estimatedSaving":<entier euros>}]`,
        },
      ],
    });
    const content = (message.content[0] as { text: string }).text;
    return JSON.parse(content);
  } catch (error) {
    logger.error('Claude-Opportunities', error);
    return [];
  }
}
```

**Step 2: Commit**
```bash
git add lib/claude/
git commit -m "feat: service Claude AI (narrative destination + détection opportunités)"
```

---

## Task 10 : API Routes Next.js

**Files:**
- Create: `app/api/analyze/route.ts`
- Create: `app/api/destination/[code]/route.ts`
- Create: `app/api/destination/[code]/explain/route.ts`
- Create: `app/api/opportunities/route.ts`
- Create: `app/api/health/route.ts`

**Step 1: Créer app/api/analyze/route.ts**
```typescript
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { calculateCrisisScore } from '@/lib/services/scoring/crisisScore.service';
import { detectOpportunities } from '@/lib/claude/claude.service';
import { TARGET_COUNTRIES } from '@/lib/utils/countries';
import type { UserProfile, AnalyzeResponse } from '@/types/crisis.types';

const AnalyzeSchema = z.object({
  profile: z.object({
    departureCountry: z.string().min(2),
    budget: z.number().min(100).max(50000),
    duration: z.number().min(1).max(365),
    period: z.string(),
    travelType: z.enum(['solo', 'couple', 'family', 'nomad']),
    mode: z.enum(['standard', 'bunker', 'budget_crisis']).default('standard'),
    excludedContinents: z.array(z.string()).optional(),
  }),
});

export async function POST(request: Request): Promise<NextResponse> {
  const start = Date.now();
  try {
    const body = await request.json();
    const { profile } = AnalyzeSchema.parse(body) as { profile: UserProfile };

    // Filtrer les pays selon le mode
    let countries = [...TARGET_COUNTRIES];
    if (profile.excludedContinents?.length) {
      countries = countries.filter((c) => !profile.excludedContinents!.includes(c.continent));
    }

    // Analyser les pays en parallèle (par batch de 10)
    const batchSize = 10;
    const results = [];
    for (let i = 0; i < Math.min(countries.length, 30); i += batchSize) {
      const batch = countries.slice(i, i + batchSize);
      const batchResults = await Promise.allSettled(
        batch.map((c) => calculateCrisisScore({ code: c.code, name: c.name }, profile))
      );
      for (const r of batchResults) {
        if (r.status === 'fulfilled') results.push(r.value);
      }
    }

    // Trier et filtrer selon le mode
    let sorted = results.sort((a, b) => b.total - a.total);
    if (profile.mode === 'bunker') sorted = sorted.filter((s) => s.security.value >= 85);
    if (profile.mode === 'budget_crisis') sorted = sorted.filter((s) => s.budget.value >= 70);

    const topDestinations = sorted.slice(0, 5);
    const opportunities = await detectOpportunities(sorted, profile.budget);

    const response: AnalyzeResponse = {
      results: sorted,
      topDestinations,
      opportunities,
      meta: {
        analyzedCountries: results.length,
        duration: Date.now() - start,
        cacheHitRate: 0, // TODO: tracker les cache hits
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Données invalides', details: error.errors }, { status: 400 });
    }
    console.error('[API/analyze] Erreur:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
```

**Step 2: Créer app/api/destination/[code]/route.ts**
```typescript
import { NextResponse } from 'next/server';
import { calculateCrisisScore } from '@/lib/services/scoring/crisisScore.service';
import { TARGET_COUNTRIES } from '@/lib/utils/countries';

export async function GET(
  _request: Request,
  { params }: { params: { code: string } }
): Promise<NextResponse> {
  const { code } = params;
  const country = TARGET_COUNTRIES.find((c) => c.code === code.toUpperCase());
  if (!country) {
    return NextResponse.json({ error: 'Pays non trouvé' }, { status: 404 });
  }
  try {
    const score = await calculateCrisisScore(
      { code: country.code, name: country.name },
      { departureCountry: 'FR', budget: 1500, duration: 7, period: 'flexible', travelType: 'solo', mode: 'standard' }
    );
    return NextResponse.json(score);
  } catch (error) {
    console.error('[API/destination] Erreur:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
```

**Step 3: Créer app/api/destination/[code]/explain/route.ts**
```typescript
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { calculateCrisisScore } from '@/lib/services/scoring/crisisScore.service';
import { generateDestinationNarrative } from '@/lib/claude/claude.service';
import { TARGET_COUNTRIES } from '@/lib/utils/countries';

const ProfileSchema = z.object({
  travelType: z.enum(['solo', 'couple', 'family', 'nomad']).default('solo'),
  budget: z.number().default(1500),
  duration: z.number().default(7),
});

export async function GET(
  request: Request,
  { params }: { params: { code: string } }
): Promise<NextResponse> {
  const url = new URL(request.url);
  const profileParams = ProfileSchema.parse({
    travelType: url.searchParams.get('travelType') ?? 'solo',
    budget: parseInt(url.searchParams.get('budget') ?? '1500'),
    duration: parseInt(url.searchParams.get('duration') ?? '7'),
  });

  const { code } = params;
  const country = TARGET_COUNTRIES.find((c) => c.code === code.toUpperCase());
  if (!country) return NextResponse.json({ error: 'Pays non trouvé' }, { status: 404 });

  try {
    const profile = { ...profileParams, departureCountry: 'FR', period: 'flexible', mode: 'standard' as const };
    const score = await calculateCrisisScore({ code: country.code, name: country.name }, profile);
    const narrative = await generateDestinationNarrative(score, profile);
    return NextResponse.json({ score, narrative });
  } catch (error) {
    console.error('[API/explain] Erreur:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
```

**Step 4: Créer app/api/health/route.ts**
```typescript
import { NextResponse } from 'next/server';
import axios from 'axios';

async function checkAPI(name: string, url: string): Promise<{ name: string; status: 'ok' | 'down'; latency: number }> {
  const start = Date.now();
  try {
    await axios.get(url, { timeout: 3000 });
    return { name, status: 'ok', latency: Date.now() - start };
  } catch {
    return { name, status: 'down', latency: Date.now() - start };
  }
}

export async function GET(): Promise<NextResponse> {
  const checks = await Promise.all([
    checkAPI('Frankfurter', 'https://api.frankfurter.app/latest'),
    checkAPI('World Bank', 'https://api.worldbank.org/v2/country/TH/indicator/PV.EST?format=json&mrv=1'),
    checkAPI('ReliefWeb', 'https://api.reliefweb.int/v1/reports?appname=crisis-travel&limit=1'),
    checkAPI('FCDO', 'https://www.gov.uk/api/content/foreign-travel-advice/thailand'),
  ]);

  const allOk = checks.every((c) => c.status === 'ok');
  return NextResponse.json(
    { status: allOk ? 'healthy' : 'degraded', apis: checks, checkedAt: new Date().toISOString() },
    { status: allOk ? 200 : 207 }
  );
}
```

**Step 5: Commit**
```bash
git add app/api/
git commit -m "feat: API Routes Next.js (analyze, destination, explain, health)"
```

---

## Task 11 : Design System et Configuration Tailwind

**Files:**
- Modify: `tailwind.config.ts`
- Modify: `app/globals.css`
- Modify: `app/layout.tsx`

**Step 1: Configurer tailwind.config.ts avec la palette Crisis Travel**
```typescript
import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        background: '#0a0a0f',
        surface: '#13131a',
        border: '#1e1e2e',
        danger: '#ff4d2e',
        warning: '#ffd23f',
        safe: '#00e5a0',
        'text-muted': '#6b7280',
      },
      fontFamily: {
        title: ['var(--font-bebas)', 'sans-serif'],
        mono: ['var(--font-space-mono)', 'monospace'],
        body: ['var(--font-dm-sans)', 'sans-serif'],
      },
      animation: {
        ticker: 'ticker 30s linear infinite',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        ticker: {
          '0%': { transform: 'translateX(100%)' },
          '100%': { transform: 'translateX(-100%)' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
```

**Step 2: Mettre à jour app/globals.css**
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --font-bebas: 'Bebas Neue', sans-serif;
  --font-space-mono: 'Space Mono', monospace;
  --font-dm-sans: 'DM Sans', sans-serif;
}

body {
  background-color: #0a0a0f;
  color: #e8e8e8;
  font-family: var(--font-dm-sans);
}

/* Score colors */
.score-green { color: #00e5a0; }
.score-yellow { color: #ffd23f; }
.score-orange { color: #ff8c42; }
.score-red { color: #ff4d2e; }
```

**Step 3: Mettre à jour app/layout.tsx avec les fonts Google**
```typescript
import type { Metadata } from 'next';
import { DM_Sans, Space_Mono } from 'next/font/google';
import './globals.css';

const dmSans = DM_Sans({ subsets: ['latin'], variable: '--font-dm-sans' });
const spaceMono = Space_Mono({ weight: ['400', '700'], subsets: ['latin'], variable: '--font-space-mono' });

export const metadata: Metadata = {
  title: 'Crisis Travel — Voyage intelligent en temps de crise',
  description: 'Trouvez les meilleures destinations en tenant compte du contexte géopolitique et économique mondial.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className="dark">
      <body className={`${dmSans.variable} ${spaceMono.variable} bg-background text-gray-100 antialiased`}>
        {children}
      </body>
    </html>
  );
}
```

**Step 4: Commit**
```bash
git add tailwind.config.ts app/globals.css app/layout.tsx
git commit -m "feat: design system dark theme Crisis Travel (palette, fonts, Tailwind)"
```

---

## Task 12 : Composants UI Métier

**Files:**
- Create: `components/crisis/CrisisScoreGauge.tsx`
- Create: `components/crisis/CountryCard.tsx`
- Create: `components/crisis/SecurityAlert.tsx`
- Create: `components/crisis/BudgetBreakdown.tsx`
- Create: `components/crisis/TickerBanner.tsx`

**Step 1: Créer components/crisis/CrisisScoreGauge.tsx**
```typescript
'use client';
import { useEffect, useState } from 'react';

interface Props {
  score: number;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

const SIZE_MAP = { sm: 80, md: 120, lg: 180 };
const COLOR_MAP = {
  green: '#00e5a0', yellow: '#ffd23f', orange: '#ff8c42', red: '#ff4d2e',
};

function getColor(score: number): string {
  if (score >= 80) return COLOR_MAP.green;
  if (score >= 60) return COLOR_MAP.yellow;
  if (score >= 40) return COLOR_MAP.orange;
  return COLOR_MAP.red;
}

function getLabel(score: number): string {
  if (score >= 80) return 'IDÉALE';
  if (score >= 60) return 'RECOMMANDÉE';
  if (score >= 40) return 'POSSIBLE';
  return 'DÉCONSEILLÉE';
}

export function CrisisScoreGauge({ score, size = 'md', showLabel = true }: Props) {
  const [animated, setAnimated] = useState(0);
  const px = SIZE_MAP[size];
  const radius = px * 0.4;
  const circumference = 2 * Math.PI * radius;
  const color = getColor(score);
  const strokeDashoffset = circumference - (animated / 100) * circumference;

  useEffect(() => {
    const timer = setTimeout(() => setAnimated(score), 100);
    return () => clearTimeout(timer);
  }, [score]);

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={px} height={px} className="-rotate-90">
        <circle cx={px / 2} cy={px / 2} r={radius} fill="none" stroke="#1e1e2e" strokeWidth={px * 0.08} />
        <circle
          cx={px / 2} cy={px / 2} r={radius} fill="none"
          stroke={color} strokeWidth={px * 0.08}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 1s ease-in-out' }}
        />
      </svg>
      <div className="text-center -mt-2" style={{ marginTop: -(px * 0.6) }}>
        <div className="font-mono text-2xl font-bold" style={{ color }}>{animated}</div>
        <div className="text-xs text-gray-500">/100</div>
      </div>
      {showLabel && (
        <div className="font-title text-xs tracking-widest mt-1" style={{ color }}>
          {getLabel(score)}
        </div>
      )}
    </div>
  );
}
```

**Step 2: Créer components/crisis/CountryCard.tsx**
```typescript
import { CrisisScoreGauge } from './CrisisScoreGauge';
import type { CrisisScore } from '@/types/crisis.types';

interface Props {
  score: CrisisScore;
  onClick?: () => void;
}

export function CountryCard({ score, onClick }: Props) {
  return (
    <div
      onClick={onClick}
      className="bg-surface border border-border rounded-xl p-4 cursor-pointer hover:border-gray-600 transition-colors flex gap-4 items-center"
    >
      <CrisisScoreGauge score={score.total} size="sm" showLabel={false} />
      <div className="flex-1 min-w-0">
        <h3 className="font-title text-lg text-white">{score.country}</h3>
        <div className="flex gap-3 text-xs text-gray-400 mt-1">
          <span>Sécurité {score.security.value}</span>
          <span>•</span>
          <span>Géo {score.geopolitical.value}</span>
          <span>•</span>
          <span>Budget {score.budget.value}</span>
        </div>
        {score.confidence === 'low' && (
          <span className="text-xs text-warning mt-1 block">⚠ Données partielles</span>
        )}
      </div>
    </div>
  );
}
```

**Step 3: Créer components/crisis/SecurityAlert.tsx**
```typescript
interface Props {
  level: 1 | 2 | 3 | 4;
  country: string;
}

const LEVEL_CONFIG = {
  1: { color: 'text-safe bg-safe/10 border-safe/30', label: 'Vigilance normale', icon: '✓' },
  2: { color: 'text-warning bg-warning/10 border-warning/30', label: 'Vigilance renforcée', icon: '⚠' },
  3: { color: 'text-orange-400 bg-orange-400/10 border-orange-400/30', label: 'Déconseillé sauf raison impérative', icon: '⚠' },
  4: { color: 'text-danger bg-danger/10 border-danger/30', label: 'Déconseillé formellement', icon: '✕' },
};

export function SecurityAlert({ level, country }: Props) {
  const config = LEVEL_CONFIG[level];
  return (
    <div className={`border rounded-lg px-3 py-2 flex items-center gap-2 text-sm ${config.color}`}>
      <span className="font-bold">{config.icon}</span>
      <span><strong>MEAE Niveau {level}</strong> — {config.label} pour {country}</span>
    </div>
  );
}
```

**Step 4: Créer components/crisis/TickerBanner.tsx**
```typescript
'use client';

const DEFAULT_NEWS = [
  '🌍 Crisis Travel analyse 30 pays en temps réel',
  '📊 Données mises à jour toutes les 30 minutes',
  '🔒 Sources officielles : MEAE, State Dept, FCDO',
  '💶 Alertes taux de change favorables détectées',
];

interface Props {
  items?: string[];
}

export function TickerBanner({ items = DEFAULT_NEWS }: Props) {
  return (
    <div className="bg-surface border-b border-border overflow-hidden py-2">
      <div className="flex animate-ticker whitespace-nowrap">
        {[...items, ...items].map((item, i) => (
          <span key={i} className="font-mono text-xs text-gray-400 mx-8">
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}
```

**Step 5: Commit**
```bash
git add components/crisis/
git commit -m "feat: composants UI métier (gauge, country card, security alert, ticker)"
```

---

## Task 13 : Pages Frontend

**Files:**
- Modify: `app/page.tsx` (page d'accueil)
- Create: `app/results/page.tsx`
- Create: `app/destination/[country]/page.tsx`
- Create: `components/layout/Header.tsx`

**Step 1: Mettre à jour app/page.tsx**
```typescript
import Link from 'next/link';
import { TickerBanner } from '@/components/crisis/TickerBanner';
import { Header } from '@/components/layout/Header';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <TickerBanner />
      <main className="max-w-4xl mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h1 className="font-title text-6xl text-white mb-2">CRISIS TRAVEL</h1>
          <p className="text-gray-400 text-lg">Voyagez intelligemment. Le monde en temps réel.</p>
        </div>

        {/* Formulaire simplifié MVP */}
        <div className="bg-surface border border-border rounded-2xl p-8">
          <h2 className="font-title text-2xl text-white mb-6">Trouvez votre prochaine destination</h2>
          <TravelForm />
        </div>

        {/* Modes spéciaux */}
        <div className="grid grid-cols-3 gap-4 mt-8">
          <ModeCard
            title="MODE BUNKER"
            description="Sécurité absolue. Niveau 1 MEAE uniquement."
            icon="🛡️"
            mode="bunker"
          />
          <ModeCard
            title="CRISE DE PORTEFEUILLE"
            description="Budget < 1000€. Destinations oubliées et sûres."
            icon="💸"
            mode="budget_crisis"
          />
          <ModeCard
            title="FENÊTRE D'OPPORTUNITÉ"
            description="Pays avec taux de change exceptionnellement favorable."
            icon="📈"
            mode="standard"
          />
        </div>
      </main>
    </div>
  );
}

function ModeCard({ title, description, icon, mode }: { title: string; description: string; icon: string; mode: string }) {
  return (
    <Link
      href={`/results?mode=${mode}`}
      className="bg-surface border border-border rounded-xl p-4 hover:border-gray-600 transition-colors block"
    >
      <div className="text-2xl mb-2">{icon}</div>
      <h3 className="font-title text-sm text-white">{title}</h3>
      <p className="text-xs text-gray-500 mt-1">{description}</p>
    </Link>
  );
}

// TravelForm — composant client séparé
function TravelForm() {
  return (
    <p className="text-gray-500 text-sm">
      Formulaire interactif — voir components/TravelForm.tsx (Task 14)
    </p>
  );
}
```

**Step 2: Créer components/layout/Header.tsx**
```typescript
import Link from 'next/link';

export function Header() {
  return (
    <header className="bg-background border-b border-border px-4 py-3 flex items-center justify-between">
      <Link href="/" className="font-title text-xl text-danger tracking-widest">
        ⚡ CRISIS TRAVEL
      </Link>
      <nav className="flex gap-6 text-sm text-gray-400">
        <Link href="/results" className="hover:text-white transition-colors">Analyser</Link>
        <Link href="/api/health" className="hover:text-white transition-colors">Statut APIs</Link>
      </nav>
    </header>
  );
}
```

**Step 3: Créer app/results/page.tsx**
```typescript
import { Suspense } from 'react';
import { Header } from '@/components/layout/Header';
import { ResultsList } from '@/components/crisis/ResultsList';

export default function ResultsPage() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="font-title text-4xl text-white mb-2">VOS DESTINATIONS</h1>
        <p className="text-gray-400 mb-8">Analyse basée sur les données mondiales en temps réel</p>
        <Suspense fallback={<div className="text-gray-400">Analyse en cours...</div>}>
          <ResultsList />
        </Suspense>
      </main>
    </div>
  );
}
```

**Step 4: Créer app/destination/[country]/page.tsx**
```typescript
import { Header } from '@/components/layout/Header';
import { CrisisScoreGauge } from '@/components/crisis/CrisisScoreGauge';
import { SecurityAlert } from '@/components/crisis/SecurityAlert';

interface Props {
  params: { country: string };
}

async function getDestinationData(code: string) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  const res = await fetch(`${baseUrl}/api/destination/${code}/explain`, {
    next: { revalidate: 1800 },
  });
  if (!res.ok) return null;
  return res.json();
}

export default async function DestinationPage({ params }: Props) {
  const data = await getDestinationData(params.country.toUpperCase());

  if (!data) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-gray-400">Destination non trouvée ou analyse indisponible.</p>
      </div>
    );
  }

  const { score, narrative } = data;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-start gap-8 mb-8">
          <CrisisScoreGauge score={score.total} size="lg" />
          <div>
            <h1 className="font-title text-5xl text-white">{score.country}</h1>
            <p className="text-gray-400 mt-2">Analyse au {new Date(score.calculatedAt).toLocaleDateString('fr-FR')}</p>
            <SecurityAlert level={score.security.details.meaeLevel ?? 1} country={score.country} />
          </div>
        </div>

        {/* Sous-scores */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          {[
            { label: 'SÉCURITÉ', value: score.security.value, weight: '40%' },
            { label: 'GÉOPOLITIQUE', value: score.geopolitical.value, weight: '30%' },
            { label: 'BUDGET', value: score.budget.value, weight: '20%' },
            { label: 'PRATICITÉ', value: score.practicality.value, weight: '10%' },
          ].map((item) => (
            <div key={item.label} className="bg-surface border border-border rounded-xl p-4 text-center">
              <div className="font-mono text-2xl text-white">{item.value}</div>
              <div className="font-title text-xs text-gray-500 mt-1">{item.label}</div>
              <div className="text-xs text-gray-600">{item.weight}</div>
            </div>
          ))}
        </div>

        {/* Analyse narrative Claude */}
        <div className="bg-surface border border-border rounded-xl p-6">
          <h2 className="font-title text-xl text-white mb-4">ANALYSE IA</h2>
          <div className="text-gray-300 leading-relaxed whitespace-pre-wrap text-sm">{narrative}</div>
        </div>
      </main>
    </div>
  );
}
```

**Step 5: Commit**
```bash
git add app/ components/layout/
git commit -m "feat: pages frontend (accueil, résultats, fiche destination)"
```

---

## Task 14 : Test de l'application complète

**Step 1: Vérifier la configuration**
```bash
# S'assurer que .env.local est configuré
cat .env.local | grep -E "ANTHROPIC|PERPLEXITY|UPSTASH" | sed 's/=.*/=***/'
```

**Step 2: Lancer le serveur de développement**
```bash
npm run dev
```

**Step 3: Tester les APIs (ouvrir dans le navigateur)**
```
http://localhost:3000/api/health
http://localhost:3000/api/destination/TH
http://localhost:3000/api/destination/TH/explain
```

**Step 4: Vérifier TypeScript**
```bash
npm run type-check
# Attendu : 0 erreurs
```

**Step 5: Tester l'endpoint analyze**
```bash
curl -X POST http://localhost:3000/api/analyze \
  -H "Content-Type: application/json" \
  -d '{"profile":{"departureCountry":"FR","budget":1500,"duration":7,"period":"flexible","travelType":"solo","mode":"standard"}}'
```

**Step 6: Commit final**
```bash
git add .
git commit -m "feat: MVP Crisis Travel complet - analyse géopolitique AI-powered"
```

---

## Résumé des APIs à configurer AVANT de lancer

| Priorité | API | Où s'inscrire | Délai |
|---------|-----|--------------|-------|
| CRITIQUE | Anthropic Claude | console.anthropic.com | Immédiat |
| HAUTE | Upstash Redis | upstash.com | Immédiat |
| HAUTE | Supabase | supabase.com | Immédiat |
| HAUTE | Perplexity Sonar | perplexity.ai/api | Immédiat |
| MOYENNE | ACLED | developer.acleddata.com | 24-48h |
| BASSE | Numbeo | numbeo.com/api | Immédiat |

**APIs gratuites sans inscription fonctionnent dès le départ :**
Frankfurter, World Bank, ReliefWeb, FCDO, State Dept, GDELT
