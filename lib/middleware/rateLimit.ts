import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

function createRateLimiter() {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return null;
  }
  const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
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

  const result = await limiter[tier].limit(identifier);
  return {
    success: result.success,
    limit: result.limit,
    remaining: result.remaining,
    reset: result.reset,
    tier,
  };
}

export function getClientIdentifier(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  const ip = forwarded?.split(',')[0]?.trim() ?? realIp ?? 'unknown';
  return ip;
}
