import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export type CacheTTL = 300 | 1800 | 3600 | 7200 | 21600 | 86400;

export async function getFromCache<T>(key: string): Promise<T | null> {
  try {
    return await redis.get<T>(key);
  } catch {
    return null;
  }
}

export async function setInCache<T>(key: string, data: T, ttl: CacheTTL): Promise<void> {
  try {
    await redis.setex(key, ttl, JSON.stringify(data));
  } catch {
    // Cache non critique — on continue sans
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
