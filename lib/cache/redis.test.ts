import { describe, it, expect, vi, beforeEach } from 'vitest';

// Pilote le comportement de redis.get() : valeur (hit), null (miss), ou throw (error).
let getImpl: (key: string) => Promise<unknown>;

vi.mock('@upstash/redis', () => ({
  Redis: class {
    constructor(_: unknown) {}
    get(key: string) {
      return getImpl(key);
    }
    setex() {
      return Promise.resolve();
    }
  },
}));

beforeEach(() => {
  vi.resetModules();
  process.env.UPSTASH_REDIS_REST_URL = 'https://fake.upstash.io';
  process.env.UPSTASH_REDIS_REST_TOKEN = 'fake-token';
});

async function load() {
  return import('./redis');
}

describe('cache stats (GOAL-033)', () => {
  it('compte un hit quand redis.get renvoie une valeur', async () => {
    getImpl = () => Promise.resolve({ score: 42 });
    const { getFromCache, getCacheStats, resetCacheStats } = await load();
    resetCacheStats();
    await getFromCache('ct:test:1');
    const s = getCacheStats();
    expect(s.hits).toBe(1);
    expect(s.misses).toBe(0);
    expect(s.errors).toBe(0);
    expect(s.hitRate).toBe(1);
  });

  it('compte un miss quand redis.get renvoie null', async () => {
    getImpl = () => Promise.resolve(null);
    const { getFromCache, getCacheStats, resetCacheStats } = await load();
    resetCacheStats();
    await getFromCache('ct:test:absent');
    const s = getCacheStats();
    expect(s.misses).toBe(1);
    expect(s.hits).toBe(0);
    expect(s.hitRate).toBe(0);
  });

  it('compte une ERREUR (pas un miss) quand Upstash throw — révèle une panne cache', async () => {
    getImpl = () => Promise.reject(new Error('Upstash down'));
    const { getFromCache, getCacheStats, resetCacheStats } = await load();
    resetCacheStats();
    const v = await getFromCache('ct:test:x');
    expect(v).toBeNull(); // dégradation gracieuse
    const s = getCacheStats();
    expect(s.errors).toBe(1);
    expect(s.misses).toBe(0); // une panne n'est PAS un miss
  });

  it('calcule un hitRate correct sur un mix hits/miss/errors', async () => {
    const { getFromCache, getCacheStats, resetCacheStats } = await load();
    resetCacheStats();
    // 2 hits, 1 miss, 1 error → hitRate = 2/4 = 0.5
    getImpl = () => Promise.resolve({ ok: true }); await getFromCache('a');
    getImpl = () => Promise.resolve({ ok: true }); await getFromCache('b');
    getImpl = () => Promise.resolve(null);          await getFromCache('c');
    getImpl = () => Promise.reject(new Error('x'));  await getFromCache('d');
    const s = getCacheStats();
    expect(s.hits).toBe(2);
    expect(s.misses).toBe(1);
    expect(s.errors).toBe(1);
    expect(s.hitRate).toBe(0.5);
  });

  it('resetCacheStats remet tout à zéro', async () => {
    getImpl = () => Promise.resolve({ ok: true });
    const { getFromCache, getCacheStats, resetCacheStats } = await load();
    await getFromCache('a');
    resetCacheStats();
    const s = getCacheStats();
    expect(s.hits).toBe(0);
    expect(s.hitRate).toBe(0);
  });

  it('circuit-breaker : après une erreur Redis, les lookups suivants ne touchent plus le réseau', async () => {
    let calls = 0;
    getImpl = () => { calls++; return Promise.reject(new Error('ENOTFOUND')); };
    const { getFromCache, getCacheStats, resetCacheStats } = await load();
    resetCacheStats();

    // 1er lookup : touche le réseau (échoue) → ouvre le circuit
    await getFromCache('a');
    // Lookups suivants : court-circuités, ZÉRO appel réseau supplémentaire
    await getFromCache('b');
    await getFromCache('c');

    expect(calls).toBe(1); // le réseau n'a été tenté qu'une seule fois
    const s = getCacheStats();
    expect(s.errors).toBe(3); // les 3 sont comptés comme erreurs (circuit ouvert inclus)
  });

  it('circuit-breaker : setInCache résout sans erreur quand le circuit est ouvert', async () => {
    getImpl = () => Promise.reject(new Error('down'));
    const mod = await load();
    mod.resetCacheStats();
    await mod.getFromCache('x'); // ouvre le circuit
    // setInCache après circuit ouvert : retour immédiat, pas de throw
    await expect(mod.setInCache('x', { v: 1 }, 1800)).resolves.toBeUndefined();
  });
});
