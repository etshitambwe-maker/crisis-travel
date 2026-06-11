import { describe, it, expect } from 'vitest';
import { getMEAEScore, MEAE_LAST_UPDATED } from './meae.service';

describe('meae.service — source honesty (MEAE-HONESTY-001)', () => {
  it('MEAE_LAST_UPDATED est une date ISO valide', () => {
    expect(MEAE_LAST_UPDATED).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(new Date(MEAE_LAST_UPDATED).toString()).not.toBe('Invalid Date');
  });

  it('getMEAEScore retourne source "static", jamais "live"', async () => {
    const result = await getMEAEScore('PT', 'portugal');
    expect(result.source).toBe('static');
    expect(result.source).not.toBe('live');
  });

  it('getMEAEScore retourne un niveau entre 1 et 4', async () => {
    const result = await getMEAEScore('GE', 'georgie');
    expect(result.data.level).toBeGreaterThanOrEqual(1);
    expect(result.data.level).toBeLessThanOrEqual(4);
  });

  it('getMEAEScore utilise le fallback niveau 2 pour un code inconnu', async () => {
    const result = await getMEAEScore('ZZ', 'inconnu');
    expect(result.data.level).toBe(2);
    expect(result.source).toBe('static');
  });
});
