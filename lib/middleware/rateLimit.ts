import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

function createRateLimiter() {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return null;
  }
  // retry: false — un Upstash injoignable doit échouer immédiatement (le fail-open
  // GOAL-030 laisse alors passer), sans accumuler plusieurs secondes de retries DNS.
  const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
    retry: false,
  });
  return {
    // 10 analyses par heure par IP (visiteurs anonymes)
    anonymous: new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(10, '1h'),
      prefix: 'ct:rl:anon',
      analytics: true,
    }),
    // 3 analyses par 30 jours par user (plan gratuit)
    free: new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(3, '30d'),
      prefix: 'ct:rl:free',
      analytics: true,
    }),
    // 200 analyses par heure par user (plan premium)
    premium: new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(200, '1h'),
      prefix: 'ct:rl:premium',
      analytics: true,
    }),
  };
}

let _limiter: ReturnType<typeof createRateLimiter> = null;

function getLimiter() {
  if (_limiter === null) {
    _limiter = createRateLimiter();
  }
  return _limiter;
}

export type RateLimitTier = 'anonymous' | 'free' | 'premium';

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
  tier: RateLimitTier;
  /** true quand Upstash a échoué et qu'on a laissé passer (fail-open). Sert au diagnostic, jamais exposé au client. */
  degraded?: boolean;
}

export async function checkRateLimit(
  identifier: string,
  tier: RateLimitTier = 'anonymous'
): Promise<RateLimitResult> {
  const limiter = getLimiter();

  // Si Redis non configuré (dev local sans Redis), on laisse passer
  if (!limiter) {
    return { success: true, limit: 999, remaining: 999, reset: 0, tier };
  }

  // Fail-open contrôlé : si l'appel Upstash lève une exception (Redis injoignable,
  // token invalide, base suspendue/quota Upstash épuisé…), on NE bloque PAS tout le
  // produit. On logue côté serveur et on laisse passer — le quota Supabase (fail-closed)
  // reste le garde-fou des coûts API. Un `success: false` LÉGITIME (limite réellement
  // atteinte) n'est pas concerné : il sort du try sans exception et reste un 429.
  try {
    const result = await limiter[tier].limit(identifier);
    return {
      success: result.success,
      limit: result.limit,
      remaining: result.remaining,
      reset: result.reset,
      tier,
    };
  } catch (err) {
    console.error('[RateLimit] Upstash unavailable — failing open', err);
    return { success: true, limit: 999, remaining: 999, reset: 0, tier, degraded: true };
  }
}

export function getClientIdentifier(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  const ip = forwarded?.split(',')[0]?.trim() ?? realIp ?? 'unknown';
  return ip;
}
