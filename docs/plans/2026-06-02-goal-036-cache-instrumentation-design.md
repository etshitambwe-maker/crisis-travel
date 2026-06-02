# GOAL-036 — Cache Key Efficiency & Provider Cache Coverage

**Date :** 2026-06-02
**Statut :** Design validé — Gate 1 (contrat d'instrumentation). AUCUN fix dans ce GOAL.
**Prérequis :** GOAL-035 clôturé (Upstash réparé, `cacheErrors:0`, host `included-sunbird-85717.upstash.io`).

---

## Problème

Deux analyses prod strictement identiques (même URL `/results`, F5, sans changer les paramètres)
donnent un profil quasi constant :

| | Test 1 | Test 2 |
|---|---|---|
| `msScoring` | 36372 | 36326 |
| `msOpportunities` | 8001 | 8001 |
| `msTotal` | 45810 | 45570 |
| `partial` | false | false |
| `cacheHits` | 17 | 17 |
| `cacheMisses` | 83 | 83 |
| `cacheErrors` | 0 | 0 |
| `cacheHitRate` | 0.17 | 0.17 |

Profil testé : `budget=1500 duration=10 travelType=couple mode=bunker priority=securite airport=CDG`.

Upstash fonctionne (`cacheErrors:0`) mais le cache est inefficace : `cacheHitRate` plafonne à 0.17,
83 misses constants, `msScoring` ~36s, la 2e analyse identique n'est PAS plus rapide.

`cacheHits + cacheMisses = 100` sur 18 pays scorés → ~5,5 lookups/pays.

## Anomalie centrale

Si le run 1 écrivait correctement les 83 misses en cache (TTL 1800–3600s), le run 2 **immédiat**
devrait lire ~100 hits. Il en lit toujours 17. Les mêmes 17/83 sont reproductibles à l'identique.

## Hypothèses

- **H1 — writes échouent silencieusement** : `setInCache` non appelé, ou `setex` qui throw et est
  avalé, ou mauvaise clé, ou TTL/payload problématique. (Hypothèse prioritaire de l'utilisateur.)
- **H2 — fallbacks non cachés** (quasi-certaine par lecture de code) : `withCache(key, fetcher, ttl)`
  n'appelle `setInCache` **que si `fetcher()` réussit**. Quand un provider timeout (6s) ou throw, le
  `catch` du service renvoie un fallback **hors de `withCache`** → jamais caché → miss garanti au run
  suivant. Les mêmes providers fallbackent à chaque run → 17/83 reproductible.

Les deux peuvent coexister. L'instrumentation doit **prouver et quantifier** la part de chacune.

## Décision méthodologique

**Gate 1 = instrumentation, PAS un fix.** On ne corrige rien tant que les chiffres n'ont pas parlé.
La décision du correctif (cacher les fallbacks ? TTL court ? Regional vs Global ?) sera un GOAL
séparé décidé APRÈS lecture (Gate 3).

---

## Section 1 — Modèle de données : compteurs par provider

Registre par-requête dans `lib/cache/redis.ts`, keyé par `tag` (= nom du provider). Par tag :

| Champ | Source | Prouve |
|---|---|---|
| `getAttempts` | entrée `getFromCache` | volume de lookups |
| `getHits` | `redis.get` ≠ null | hits réels |
| `getMisses` | `redis.get` === null | clé absente |
| `getErrors` | catch `getFromCache` / circuit | Redis injoignable |
| `setAttempts` | entrée `setInCache` | writes tentés |
| `setSuccess` | `setex` résolu | **H1 : writes réussissent ?** |
| `setErrors` | catch `setInCache` | writes échoués silencieusement |
| `fetcherThrew` | catch du fetcher dans `withCache` | **H2 : fallback hors cache (preuve directe)** |
| `msRedisGet` | timing autour de `redis.get` | coût réseau Redis lecture |
| `msRedisSet` | timing autour de `setex` | coût réseau Redis écriture |

**Point délicat validé :** `withCache` n'a aujourd'hui aucun `try/catch` autour de `fetcher()`.
Pour compter `fetcherThrew`, on ajoute un `try/catch` qui **incrémente puis re-throw immédiatement
le même objet d'erreur**. Le service reçoit toujours l'exception au même moment → aucun fallback
caché, aucun comportement métier changé. On mesure seulement.

## Section 2 — Signature & câblage du `tag`

Paramètre `tag` **optionnel** (défaut `'unknown'`), rétro-compatible (TS strict OK, aucun appelant
ne casse) :

```ts
getFromCache<T>(key: string, tag?: string): Promise<T | null>
setInCache<T>(key: string, data: T, ttl: CacheTTL, tag?: string): Promise<void>
withCache<T>(key, fetcher, ttl, tag?: string): Promise<{ data; fromCache }>
```

Chaque service passe son nom : `withCache(key, fetcher, 3600, 'gdelt')`. Bucket `'unknown'` loggé
pour repérer un service oublié.

**Périmètre à tagger** (services qui passent réellement par `withCache`/`getFromCache`) :
`gdelt`, `perplexity`, `worldbank`, `acled`, `nasaEonet`, `numbeo`, `frankfurter`, `teleport`,
+ `reliefweb`/`stateDept`/`meae` si applicable (vérifié à l'écriture). ~9 fichiers, une ligne chacun.

**Écarté :** AsyncLocalStorage (fragile en serverless Edge), wrapper par provider (surface inutile),
parsing du tag depuis la clé (couple l'instrumentation au format de clé, ne gère pas `fetcherThrew`).

## Section 3 — Restitution

**3a — API d'agrégation** (en plus de `getCacheStats()`, gardé inchangé) :

```ts
getCacheStatsByTag(): Record<string, {
  getAttempts, getHits, getMisses, getErrors,
  setAttempts, setSuccess, setErrors,
  fetcherThrew, msRedisGet, msRedisSet
}>
```

`resetCacheStats()` réinitialise aussi le registre par tag (un seul point de reset, déjà appelé en
`route.ts`). Le registre global `_hits/_misses/_errors` continue d'alimenter `getCacheStats()` →
zéro régression sur `meta.cacheHitRate` ni sur le log `[API/analyze] timing`.

**3b — Nouveau log structuré** dans `route.ts`, à côté de `[API/analyze] timing` (non touché) :

```
[API/analyze] cache-by-provider {"gdelt":{...},"perplexity":{...},...}
```

Une ligne JSON, lisible/copiable dans Vercel.

**3c — Stabilité des clés** : par tag, on logge la **première clé vue** (ex. `ct:gdelt:PT`). Deux
runs identiques → même première clé → preuve de stabilité sans logger 100 clés.

**Écart validé** : TTL et « payload stocké oui/non » NON instrumentés (TTL statique, vérifiable en
lecture de code ; payload couvert par `setSuccess`/`setErrors`). Dérivés en analyse Gate 3.

## Section 4 — Garanties de non-régression

**4a — `try/catch` autour de `fetcher()`** (re-throw immédiat) :

```ts
const cached = await getFromCache<T>(key, tag);
if (cached !== null) return { data: cached, fromCache: true };
let data: T;
try {
  data = await fetcher();
} catch (e) {
  bumpFetcherThrew(tag);   // compteur mémoire synchrone, ne throw pas
  throw e;                 // re-throw immédiat, même objet
}
await setInCache(key, data, ttl, tag);
return { data, fromCache: false };
```

Invariant : le service reçoit exactement la même exception, au même moment.

**4b — Sonde non-bloquante et non-throwing** : timings (`Date.now()`) et `bump*` sont synchrones et
triviaux. Une sonde qui planterait ne doit jamais transformer un 200 en 500.

**4c — Comportement cache strictement préservé** : `getCacheStats()`, `_hits/_misses/_errors`,
circuit-breaker, `meta.cacheHitRate`, log `timing`, TTL, clés, fallbacks — tous inchangés.
Pas de `timeoutCount` séparé en Gate 1 (dérivable de `fetcherThrew`).

**4d — Tests TDD** (dans `redis.test.ts` existant, écrits avant le câblage) :
1. `fetcher` throw → `fetcherThrew` +1 ET l'exception remonte.
2. `setInCache` échoue → `setErrors` +1, pas de throw.
3. `getCacheStatsByTag` ségrège bien par tag.
4. `resetCacheStats` remet le registre par tag à zéro.

## Section 5 — Protocole d'interprétation (Gate 3)

**5a — Test** : même URL `/results`, F5, puis 2e F5. Comparer deux runs consécutifs du log
`[API/analyze] cache-by-provider`.

**5b — Grille de lecture par provider** (identité : `getAttempts = getHits + getMisses + getErrors`) :

| Observation | Verdict |
|---|---|
| `fetcherThrew > 0` récurrent (run 1 ET 2) | **H2 confirmée** — fallback hors cache, miss permanent |
| `setAttempts > 0` mais `setErrors > 0` / `setSuccess ≈ 0` | **H1 confirmée** — writes échouent |
| `setSuccess > 0` run 1 mais `getHits = 0` run 2 | clé instable (vérifier échantillon) ou TTL expiré (improbable à 36s) |
| `setSuccess > 0` run 1 ET `getHits > 0` run 2 | provider **sain** |
| `getErrors > 0` | régression Redis/Upstash (ne devrait plus arriver post-GOAL-035) |

**5c — Reconstituer les 83 misses** : verdict quantitatif, ex. « 70 misses = 7 providers
fetcherThrew × 10 pays (H2 dominante) ; 0 setErrors (H1 écartée) ; clés stables. »

**5d — `msRedis` vs `msScoring`** : si `Σ msRedisGet + Σ msRedisSet` ≪ `msScoring` (~36s) → Redis
n'est PAS le goulot (les 36s = attente API externes). Réoriente le futur fix vers « cacher les
fallbacks », PAS vers Regional/parallélisation. Si `msRedis` élevé → rouvre la piste base
Regional / lookups non parallélisés / latence Global Londres.

**5e — Livrable Gate 3** : compte-rendu écrit répondant aux 5 questions de mesure, SANS fix. Le
correctif est un GOAL ultérieur décidé après lecture.

## Contraintes permanentes

Ne PAS modifier : scoring, pondérations, N=18, Claude Opportunities, Stripe/OAuth/légal/
Booking-Travelpayouts. Instrumentation seulement. Aucun fix avant que l'instrumentation ait parlé.
