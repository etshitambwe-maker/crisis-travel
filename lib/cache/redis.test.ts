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

  it('msRedisGet est renseigné (>=0) sur un hit et msRedisSet sur un set réussi', async () => {
    const { getFromCache, setInCache, getCacheStatsByTag, resetCacheStats } = await load();
    resetCacheStats();
    getImpl = () => Promise.resolve({ ok: true });
    await getFromCache('ct:gdelt:PT', 'gdelt');
    await setInCache('ct:gdelt:PT', { v: 1 }, 3600, 'gdelt');
    const t = getCacheStatsByTag().gdelt;
    expect(t.msRedisGet).toBeGreaterThanOrEqual(0);
    expect(t.msRedisSet).toBeGreaterThanOrEqual(0);
  });

  it('msRedisGet est renseigné (>=0) même sur le chemin d\'erreur Redis', async () => {
    getImpl = () => Promise.reject(new Error('down'));
    const { getFromCache, getCacheStatsByTag, resetCacheStats } = await load();
    resetCacheStats();
    await getFromCache('ct:gdelt:PT', 'gdelt');
    const t = getCacheStatsByTag().gdelt;
    expect(t.getErrors).toBe(1);
    expect(t.msRedisGet).toBeGreaterThanOrEqual(0);
  });

  it('circuit ouvert : un getFromCache court-circuité bumpe getErrors/getAttempts du tag sans toucher le réseau', async () => {
    let calls = 0;
    getImpl = () => { calls++; return Promise.reject(new Error('ENOTFOUND')); };
    const { getFromCache, getCacheStatsByTag, resetCacheStats } = await load();
    resetCacheStats();
    await getFromCache('ct:gdelt:PT', 'gdelt'); // ouvre le circuit (1 appel réseau)
    await getFromCache('ct:numbeo:PT', 'numbeo'); // court-circuité, aucun appel réseau
    expect(calls).toBe(1); // le réseau n'a été tenté qu'une fois
    const numbeo = getCacheStatsByTag().numbeo;
    expect(numbeo.getAttempts).toBe(1);
    expect(numbeo.getErrors).toBe(1);
    expect(numbeo.getAttempts).toBe(numbeo.getErrors);
  });
});
