import { Redis } from '@upstash/redis';

// retry: false — sans ça, le SDK Upstash réessaie plusieurs fois (avec backoff) sur
// erreur réseau. Quand le host est injoignable (ENOTFOUND), ces retries transforment
// chaque lookup en plusieurs secondes d'attente. Un échec doit être immédiat (GOAL-033).
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  retry: false,
});

export type CacheTTL = 300 | 1800 | 3600 | 7200 | 21600 | 86400;

// ── Instrumentation cache (GOAL-033) ──────────────────────────────────────────
// Compteurs de module remis à zéro par requête. Permettent de calculer un vrai
// cacheHitRate (le champ meta était codé en dur à 0) et surtout de distinguer un
// MISS légitime (clé absente) d'une ERREUR Redis (Upstash injoignable) — ce dernier
// cas était jusqu'ici avalé silencieusement et traité comme un miss, masquant une
// éventuelle panne Upstash qui force du cold-cache permanent.
let _hits = 0;
let _misses = 0;
let _errors = 0;

// Circuit-breaker par requête (GOAL-033) : dès qu'un appel Redis échoue (réseau/DNS),
// on ouvre le circuit et TOUS les lookups suivants de la requête court-circuitent sans
// toucher le réseau. Évite ~20 timeouts Upstash morts par pays × 18 pays. Réinitialisé
// à chaque requête via resetCacheStats().
let _circuitOpen = false;

export function resetCacheStats(): void {
  _hits = 0; _misses = 0; _errors = 0; _circuitOpen = false;
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

export async function getFromCache<T>(key: string): Promise<T | null> {
  // Circuit ouvert : Redis a déjà échoué cette requête → ne pas retenter le réseau.
  if (_circuitOpen) { _errors++; return null; }
  try {
    const v = await redis.get<T>(key);
    if (v !== null) _hits++; else _misses++;
    return v;
  } catch {
    // Redis injoignable — compté comme ERREUR (pas un miss), traité comme cache absent.
    // On ouvre le circuit : les lookups suivants de cette requête seront instantanés.
    _errors++;
    _circuitOpen = true;
    return null;
  }
}

export async function setInCache<T>(key: string, data: T, ttl: CacheTTL): Promise<void> {
  // Circuit ouvert : inutile (et coûteux) d'essayer d'écrire sur un Redis injoignable.
  if (_circuitOpen) return;
  try {
    await redis.setex(key, ttl, JSON.stringify(data));
  } catch {
    // Cache non critique — on continue sans, et on ouvre le circuit pour la suite.
    _circuitOpen = true;
  }
}

export function buildCacheKey(service: string, ...parts: string[]): string {
  return `ct:${service}:${parts.join(':')}`;
}

export async function withCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl: CacheTTL
): Promise<{ data: T; fromCache: boolean }> {
  const cached = await getFromCache<T>(key);
  if (cached !== null) return { data: cached, fromCache: true };
  const data = await fetcher();
  await setInCache(key, data, ttl);
  return { data, fromCache: false };
}
