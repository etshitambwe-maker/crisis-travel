# GOAL-036 Gate 1 — Cache Instrumentation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Instrumenter le cache par provider (sans aucun fix) pour prouver/quantifier pourquoi deux analyses identiques restent à 17 hits / 83 misses.

**Architecture:** Registre par-requête keyé par `tag` dans `lib/cache/redis.ts`, alimenté via un paramètre `tag` optionnel ajouté à `getFromCache`/`setInCache`/`withCache`. `withCache` gagne un `try/catch` autour du `fetcher()` qui compte `fetcherThrew` puis re-throw immédiatement (zéro changement de comportement). Les 8 services passant par `withCache` reçoivent leur tag. `route.ts` logge un nouveau `[API/analyze] cache-by-provider`. Le registre global existant (`getCacheStats`, `meta.cacheHitRate`, circuit-breaker) reste strictement inchangé.

**Tech Stack:** TypeScript strict, Next.js 14 API Route, Upstash Redis SDK, Vitest.

**Design source:** `docs/plans/2026-06-02-goal-036-cache-instrumentation-design.md` (commit e210a8c).

**Contraintes permanentes (NE PAS toucher):** scoring, pondérations, N=18, Claude Opportunities, Stripe/OAuth/légal/Booking-Travelpayouts. `getCacheStats()` et `meta.cacheHitRate` inchangés. Sonde non-throwing, non-bloquante. AUCUN fix : on ne cache aucun fallback, on ne modifie aucune clé/TTL.

---

## Périmètre des services à tagger (vérifié)

| Service | Appel `withCache` | Tag |
|---|---|---|
| `lib/services/geopolitical/gdelt.service.ts:43` | oui | `'gdelt'` |
| `lib/services/geopolitical/perplexity.service.ts:42` | oui | `'perplexity'` |
| `lib/services/geopolitical/worldbank.service.ts:25` | oui | `'worldbank'` |
| `lib/services/security/acled.service.ts:66` | oui | `'ucdp'` (la clé est `ucdp`, pas acled) |
| `lib/services/security/nasaEonet.service.ts:38` | oui | `'eonet'` |
| `lib/services/security/reliefweb.service.ts:13` | oui | `'reliefweb'` |
| `lib/services/budget/numbeo.service.ts:50` | oui | `'numbeo'` |
| `lib/services/budget/teleport.service.ts:39` | oui | `'teleport'` |
| `lib/services/budget/frankfurter.service.ts:25` | oui | `'frankfurter'` |

`meae` et `stateDept` n'utilisent PAS `withCache` → ne pas les tagger. Aucun service n'appelle
`getFromCache`/`setInCache` directement → seul `withCache` propage le tag en pratique, mais les
trois signatures reçoivent quand même le paramètre (cohérence + tests directs).

---

## Task 1 : Registre par tag + signatures `tag` (cœur dans redis.ts)

**Files:**
- Modify: `lib/cache/redis.ts`
- Test: `lib/cache/redis.test.ts`

### Step 1 — Rendre `setex` pilotable dans le mock de test

Le mock actuel a `setex()` toujours-succès. Pour tester `setErrors`/`setSuccess` il faut le piloter
comme `getImpl`.

Modifier le haut de `lib/cache/redis.test.ts` :

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Pilote redis.get() : valeur (hit), null (miss), ou throw (error).
let getImpl: (key: string) => Promise<unknown>;
// Pilote redis.setex() : résout (succès) ou throw (erreur d'écriture).
let setexImpl: (key: string, ttl: number, val: string) => Promise<unknown> = () => Promise.resolve();

vi.mock('@upstash/redis', () => ({
  Redis: class {
    constructor(_: unknown) {}
    get(key: string) {
      return getImpl(key);
    }
    setex(key: string, ttl: number, val: string) {
      return setexImpl(key, ttl, val);
    }
  },
}));

beforeEach(() => {
  vi.resetModules();
  process.env.UPSTASH_REDIS_REST_URL = 'https://fake.upstash.io';
  process.env.UPSTASH_REDIS_REST_TOKEN = 'fake-token';
  setexImpl = () => Promise.resolve(); // reset par défaut
});
```

### Step 2 — Écrire les tests qui échouent (invariants Gate 1)

Ajouter ce bloc `describe` à la fin de `lib/cache/redis.test.ts` :

```ts
describe('cache stats par provider (GOAL-036)', () => {
  it('getCacheStatsByTag ségrège hits/misses par tag', async () => {
    const { getFromCache, getCacheStatsByTag, resetCacheStats } = await load();
    resetCacheStats();
    getImpl = () => Promise.resolve({ ok: true }); await getFromCache('ct:gdelt:PT', 'gdelt');
    getImpl = () => Promise.resolve(null);         await getFromCache('ct:numbeo:PT', 'numbeo');
    const byTag = getCacheStatsByTag();
    expect(byTag.gdelt.getHits).toBe(1);
    expect(byTag.gdelt.getMisses).toBe(0);
    expect(byTag.numbeo.getMisses).toBe(1);
    expect(byTag.numbeo.getHits).toBe(0);
  });

  it('un appel sans tag tombe dans le bucket "unknown"', async () => {
    const { getFromCache, getCacheStatsByTag, resetCacheStats } = await load();
    resetCacheStats();
    getImpl = () => Promise.resolve(null); await getFromCache('ct:x:1');
    expect(getCacheStatsByTag().unknown.getMisses).toBe(1);
  });

  it('setInCache succès incrémente setAttempts ET setSuccess pour le tag', async () => {
    const { setInCache, getCacheStatsByTag, resetCacheStats } = await load();
    resetCacheStats();
    await setInCache('ct:gdelt:PT', { v: 1 }, 3600, 'gdelt');
    const t = getCacheStatsByTag().gdelt;
    expect(t.setAttempts).toBe(1);
    expect(t.setSuccess).toBe(1);
    expect(t.setErrors).toBe(0);
  });

  it('setInCache qui échoue incrémente setErrors et NE throw PAS (H1)', async () => {
    setexImpl = () => Promise.reject(new Error('write failed'));
    const { setInCache, getCacheStatsByTag, resetCacheStats } = await load();
    resetCacheStats();
    await expect(setInCache('ct:gdelt:PT', { v: 1 }, 3600, 'gdelt')).resolves.toBeUndefined();
    const t = getCacheStatsByTag().gdelt;
    expect(t.setAttempts).toBe(1);
    expect(t.setSuccess).toBe(0);
    expect(t.setErrors).toBe(1);
  });

  it('withCache : fetcher qui throw incrémente fetcherThrew ET re-throw la MÊME erreur (H2)', async () => {
    const { withCache, getCacheStatsByTag, resetCacheStats } = await load();
    resetCacheStats();
    getImpl = () => Promise.resolve(null); // cache miss → on appelle le fetcher
    const boom = new Error('provider timeout');
    await expect(
      withCache('ct:perplexity:PT', () => Promise.reject(boom), 1800, 'perplexity')
    ).rejects.toBe(boom); // MÊME objet re-thrown
    const t = getCacheStatsByTag().perplexity;
    expect(t.fetcherThrew).toBe(1);
    expect(t.setAttempts).toBe(0); // pas de set quand le fetcher throw
  });

  it('withCache : fetcher qui réussit ne touche pas fetcherThrew et fait un set', async () => {
    const { withCache, getCacheStatsByTag, resetCacheStats } = await load();
    resetCacheStats();
    getImpl = () => Promise.resolve(null);
    const r = await withCache('ct:gdelt:PT', () => Promise.resolve({ score: 1 }), 3600, 'gdelt');
    expect(r.fromCache).toBe(false);
    const t = getCacheStatsByTag().gdelt;
    expect(t.fetcherThrew).toBe(0);
    expect(t.setSuccess).toBe(1);
  });

  it('resetCacheStats vide aussi le registre par tag', async () => {
    const { getFromCache, getCacheStatsByTag, resetCacheStats } = await load();
    getImpl = () => Promise.resolve({ ok: true }); await getFromCache('ct:gdelt:PT', 'gdelt');
    resetCacheStats();
    expect(getCacheStatsByTag()).toEqual({});
  });

  it('getCacheStats() global reste inchangé (non-régression)', async () => {
    const { getFromCache, getCacheStats, resetCacheStats } = await load();
    resetCacheStats();
    getImpl = () => Promise.resolve({ ok: true }); await getFromCache('ct:gdelt:PT', 'gdelt');
    const s = getCacheStats();
    expect(s.hits).toBe(1);
    expect(s.hitRate).toBe(1);
  });

  it('échantillon de clé : première clé vue conservée par tag', async () => {
    const { getFromCache, getCacheStatsByTag, resetCacheStats } = await load();
    resetCacheStats();
    getImpl = () => Promise.resolve(null);
    await getFromCache('ct:gdelt:PT', 'gdelt');
    await getFromCache('ct:gdelt:GE', 'gdelt');
    expect(getCacheStatsByTag().gdelt.sampleKey).toBe('ct:gdelt:PT'); // la PREMIÈRE
  });
});
```

### Step 3 — Lancer les tests, vérifier qu'ils échouent

Run: `npx vitest run lib/cache/redis.test.ts`
Expected: les anciens tests GOAL-033 PASS ; les nouveaux GOAL-036 FAIL (`getCacheStatsByTag is not a function`, `sampleKey` undefined, etc.).

### Step 4 — Implémenter dans `lib/cache/redis.ts`

Remplacer le contenu entre la déclaration de `_circuitOpen` et `buildCacheKey` (inclus les fonctions
`resetCacheStats`, `getCacheStats`, `getFromCache`, `setInCache`) par la version instrumentée
ci-dessous. Le registre global et le circuit-breaker restent identiques en comportement.

```ts
let _hits = 0;
let _misses = 0;
let _errors = 0;
let _circuitOpen = false;

// ── Instrumentation par provider (GOAL-036) ──────────────────────────────────
// Registre par-requête keyé par tag. Sonde non-throwing : un bump ne fait
// qu'incrémenter un compteur mémoire synchrone, ne peut pas casser une requête.
interface TagStats {
  getAttempts: number; getHits: number; getMisses: number; getErrors: number;
  setAttempts: number; setSuccess: number; setErrors: number;
  fetcherThrew: number; msRedisGet: number; msRedisSet: number;
  sampleKey: string | null;
}
let _byTag: Record<string, TagStats> = {};

function tagBucket(tag: string, key?: string): TagStats {
  let b = _byTag[tag];
  if (!b) {
    b = {
      getAttempts: 0, getHits: 0, getMisses: 0, getErrors: 0,
      setAttempts: 0, setSuccess: 0, setErrors: 0,
      fetcherThrew: 0, msRedisGet: 0, msRedisSet: 0, sampleKey: null,
    };
    _byTag[tag] = b;
  }
  if (b.sampleKey === null && key) b.sampleKey = key; // première clé vue
  return b;
}

export function resetCacheStats(): void {
  _hits = 0; _misses = 0; _errors = 0; _circuitOpen = false;
  _byTag = {};
}

export function getCacheStats(): { hits: number; misses: number; errors: number; hitRate: number } {
  const lookups = _hits + _misses + _errors;
  return {
    hits: _hits,
    misses: _misses,
    errors: _errors,
    hitRate: lookups === 0 ? 0 : Math.round((_hits / lookups) * 100) / 100,
  };
}

export function getCacheStatsByTag(): Record<string, TagStats> {
  return _byTag;
}

export async function getFromCache<T>(key: string, tag = 'unknown'): Promise<T | null> {
  const b = tagBucket(tag, key);
  b.getAttempts++;
  if (_circuitOpen) { _errors++; b.getErrors++; return null; }
  const t0 = Date.now();
  try {
    const v = await redis.get<T>(key);
    b.msRedisGet += Date.now() - t0;
    if (v !== null) { _hits++; b.getHits++; } else { _misses++; b.getMisses++; }
    return v;
  } catch {
    b.msRedisGet += Date.now() - t0;
    _errors++; b.getErrors++;
    _circuitOpen = true;
    return null;
  }
}

export async function setInCache<T>(key: string, data: T, ttl: CacheTTL, tag = 'unknown'): Promise<void> {
  const b = tagBucket(tag, key);
  if (_circuitOpen) return;
  b.setAttempts++;
  const t0 = Date.now();
  try {
    await redis.setex(key, ttl, JSON.stringify(data));
    b.msRedisSet += Date.now() - t0;
    b.setSuccess++;
  } catch {
    b.msRedisSet += Date.now() - t0;
    b.setErrors++;
    _circuitOpen = true;
  }
}
```

Puis modifier `withCache` (try/catch autour du fetcher, re-throw immédiat) :

```ts
export async function withCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl: CacheTTL,
  tag = 'unknown'
): Promise<{ data: T; fromCache: boolean }> {
  const cached = await getFromCache<T>(key, tag);
  if (cached !== null) return { data: cached, fromCache: true };
  let data: T;
  try {
    data = await fetcher();
  } catch (e) {
    tagBucket(tag, key).fetcherThrew++; // compteur synchrone, ne throw pas
    throw e;                            // re-throw immédiat, même objet
  }
  await setInCache(key, data, ttl, tag);
  return { data, fromCache: false };
}
```

> Note : `getCacheTTL`/`CacheTTL` et `buildCacheKey` restent inchangés.
> Le test circuit-breaker GOAL-033 appelle `setInCache('x', {v:1}, 1800)` sans tag → bucket `unknown`,
> et le retour anticipé `if (_circuitOpen) return;` reste AVANT `setAttempts++` : comportement identique.

### Step 5 — Lancer les tests, vérifier qu'ils passent

Run: `npx vitest run lib/cache/redis.test.ts`
Expected: PASS (anciens GOAL-033 + nouveaux GOAL-036).

### Step 6 — Vérifier la compilation TypeScript stricte

Run: `npx tsc --noEmit`
Expected: aucune erreur (le `tag` optionnel ne casse aucun appelant).

### Step 7 — Commit

```bash
git add lib/cache/redis.ts lib/cache/redis.test.ts
git commit -F <fichier-message>   # message: "feat(GOAL-036): per-provider cache instrumentation in redis.ts"
```
> Rappel mémoire : commit via `git commit -F fichier`, JAMAIS de heredoc PowerShell `@'...'@`.

---

## Task 2 : Tagger les 8 services

**Files (modifier la ligne `withCache(...)` de chacun — ajouter le tag en 4e argument) :**

- `lib/services/geopolitical/gdelt.service.ts` → `withCache(key, async () => {...}, 3600, 'gdelt')`
- `lib/services/geopolitical/perplexity.service.ts` → `withCache(cacheKey, async () => {...}, 1800, 'perplexity')`
- `lib/services/geopolitical/worldbank.service.ts` → `..., 'worldbank')`
- `lib/services/security/acled.service.ts` → `..., 'ucdp')`
- `lib/services/security/nasaEonet.service.ts` → `..., 'eonet')`
- `lib/services/security/reliefweb.service.ts` → `..., 'reliefweb')`
- `lib/services/budget/numbeo.service.ts` → `..., 'numbeo')`
- `lib/services/budget/teleport.service.ts` → `..., 'teleport')`
- `lib/services/budget/frankfurter.service.ts` → `..., 'frankfurter')`

### Step 1 — Pour chaque service, ajouter le 4e argument tag à l'appel `withCache`

Le TTL est déjà le 3e argument ; on ajoute le tag après. Ne RIEN changer d'autre (fetcher, clé, TTL).

Exemple (gdelt, ligne ~69) — le `3600` devient `3600,` suivi du tag :
```ts
      },
      3600, // 1h
      'gdelt',
    );
```

### Step 2 — Vérifier compilation

Run: `npx tsc --noEmit`
Expected: aucune erreur.

### Step 3 — Lancer toute la suite de tests (non-régression services)

Run: `npx vitest run`
Expected: PASS (aucun test de service ne dépend de la signature interne ; le tag est optionnel).

### Step 4 — Commit

```bash
git add lib/services
git commit -F <fichier-message>   # "feat(GOAL-036): tag cache calls per provider in 8 services"
```

---

## Task 3 : Log `cache-by-provider` dans route.ts

**Files:**
- Modify: `app/api/analyze/route.ts` (autour de la ligne 209-217, après `const cache = getCacheStats();`)

### Step 1 — Importer `getCacheStatsByTag`

Ligne 10, étendre l'import existant :
```ts
import { resetCacheStats, getCacheStats, getCacheStatsByTag } from '@/lib/cache/redis';
```

### Step 2 — Ajouter le log juste après le log `timing` existant

Après le `console.log('[API/analyze] timing', ...)` (ne pas toucher ce dernier), ajouter :
```ts
    // Détail par provider (GOAL-036, instrumentation temporaire) : permet de trancher
    // H1 (writes échoués) vs H2 (fallbacks non cachés). À retirer une fois le verdict posé.
    console.log('[API/analyze] cache-by-provider', JSON.stringify(getCacheStatsByTag()));
```

### Step 3 — Vérifier compilation

Run: `npx tsc --noEmit`
Expected: aucune erreur.

### Step 4 — Vérifier que `meta` et le log `timing` sont inchangés

Relecture : `meta.cacheHitRate` utilise toujours `cache.hitRate` (de `getCacheStats()`), le log
`timing` est intact. Le nouveau log est purement additif.

### Step 5 — Commit

```bash
git add app/api/analyze/route.ts
git commit -F <fichier-message>   # "feat(GOAL-036): log cache-by-provider in analyze route"
```

---

## Task 4 : Vérification finale (pré-déploiement, sans fix)

### Step 1 — Suite complète + types

Run: `npx vitest run && npx tsc --noEmit`
Expected: tout PASS, zéro erreur de type.

### Step 2 — Build Next.js (optionnel mais recommandé)

Run: `npx next build`
Expected: build OK (route `/api/analyze` compilée).

### Step 3 — Handoff vers test prod (Gate 3, côté utilisateur)

L'utilisateur déploie sur Vercel, refait le test prod strict (même URL `/results`, F5, 2e F5), et
récupère les DEUX lignes `[API/analyze] cache-by-provider`. On applique alors la grille
d'interprétation de la Section 5 du design pour rendre le verdict Gate 3. AUCUN fix avant ça.

---

## Definition of Done (Gate 1)

- [ ] `getCacheStatsByTag()` expose les 10 compteurs + `sampleKey` par provider.
- [ ] `withCache` compte `fetcherThrew` et re-throw la même erreur (test prouvé).
- [ ] `setInCache` échoué → `setErrors`, pas de throw (test prouvé).
- [ ] 8 services taggés ; pas de bucket `unknown` inattendu en prod.
- [ ] `getCacheStats()`, `meta.cacheHitRate`, log `timing`, circuit-breaker : inchangés.
- [ ] `npx vitest run` et `npx tsc --noEmit` verts.
- [ ] Aucun fix appliqué (aucun fallback caché, aucune clé/TTL modifié).
