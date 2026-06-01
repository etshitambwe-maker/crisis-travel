import { describe, it, expect, vi, beforeEach } from 'vitest';

// Pilote partagé : ce que `.limit()` fera à chaque test.
// On le réassigne avant chaque cas, le mock le lit par référence.
let limitImpl: (id: string) => Promise<{ success: boolean; limit: number; remaining: number; reset: number }>;

vi.mock('@upstash/redis', () => ({
  Redis: class {
    constructor(_: unknown) {}
  },
}));

vi.mock('@upstash/ratelimit', () => ({
  Ratelimit: class {
    static slidingWindow() {
      return {};
    }
    constructor(_: unknown) {}
    limit(id: string) {
      return limitImpl(id);
    }
  },
}));

// Les variables d'env doivent être présentes pour que createRateLimiter() construise
// un vrai limiter (sinon checkRateLimit court-circuite en fail-open trivial).
beforeEach(() => {
  vi.resetModules();
  process.env.UPSTASH_REDIS_REST_URL = 'https://fake.upstash.io';
  process.env.UPSTASH_REDIS_REST_TOKEN = 'fake-token';
});

async function loadCheckRateLimit() {
  const mod = await import('./rateLimit');
  return mod.checkRateLimit;
}

describe('checkRateLimit — fail-open contrôlé (GOAL-030)', () => {
  it('laisse passer (success:true, degraded:true) quand .limit() lève une exception Upstash', async () => {
    limitImpl = () => Promise.reject(new Error('Upstash unreachable'));
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const checkRateLimit = await loadCheckRateLimit();
    const result = await checkRateLimit('1.2.3.4', 'anonymous');

    expect(result.success).toBe(true);
    expect(result.degraded).toBe(true);
    // L'erreur est loguée côté serveur, jamais propagée
    expect(errSpy).toHaveBeenCalledWith(
      '[RateLimit] Upstash unavailable — failing open',
      expect.any(Error),
    );
    errSpy.mockRestore();
  });

  it('préserve success:false (429) quand la limite est réellement atteinte', async () => {
    limitImpl = () =>
      Promise.resolve({ success: false, limit: 10, remaining: 0, reset: 9999 });

    const checkRateLimit = await loadCheckRateLimit();
    const result = await checkRateLimit('1.2.3.4', 'anonymous');

    expect(result.success).toBe(false);
    expect(result.degraded).toBeUndefined();
    expect(result.remaining).toBe(0);
  });

  it('laisse passer normalement (success:true, non dégradé) quand la limite n’est pas atteinte', async () => {
    limitImpl = () =>
      Promise.resolve({ success: true, limit: 10, remaining: 9, reset: 9999 });

    const checkRateLimit = await loadCheckRateLimit();
    const result = await checkRateLimit('1.2.3.4', 'anonymous');

    expect(result.success).toBe(true);
    expect(result.degraded).toBeUndefined();
    expect(result.remaining).toBe(9);
  });
});
