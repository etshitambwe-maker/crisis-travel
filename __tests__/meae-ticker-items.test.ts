import { describe, it, expect } from 'vitest';
import { getMeaeTickerItems, MEAE_LAST_UPDATED } from '@/lib/utils/meae-ticker-items';

describe('getMeaeTickerItems — LIVE-001B', () => {
  const items = getMeaeTickerItems();

  it('retourne au moins un item', () => {
    expect(items.length).toBeGreaterThan(0);
  });

  it('ne retourne que des niveaux 3 ou 4', () => {
    for (const item of items) {
      expect([3, 4]).toContain(item.level);
    }
  });

  it('chaque item a un officialUrl non vide pointant vers diplomatie.gouv.fr', () => {
    for (const item of items) {
      expect(item.officialUrl).toMatch(/^https:\/\/www\.diplomatie\.gouv\.fr\//);
    }
  });

  it('chaque item a un code, un name et un label non vides', () => {
    for (const item of items) {
      expect(item.code.length).toBeGreaterThan(0);
      expect(item.name.length).toBeGreaterThan(0);
      expect(item.label.length).toBeGreaterThan(0);
    }
  });

  it('les items sont triés : niveau 4 avant niveau 3', () => {
    const levels = items.map((i) => i.level);
    for (let j = 1; j < levels.length; j++) {
      expect(levels[j]).toBeLessThanOrEqual(levels[j - 1]);
    }
  });

  it('MEAE_LAST_UPDATED est une date ISO valide', () => {
    expect(MEAE_LAST_UPDATED).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(new Date(MEAE_LAST_UPDATED).toString()).not.toBe('Invalid Date');
  });

  it("aucun item fictif DEFAULT_ITEMS (FRA, PRT, ISL...) n'est present", () => {
    const codes = items.map((i) => i.code);
    expect(codes).not.toContain('FRA');
    expect(codes).not.toContain('PRT');
    expect(codes).not.toContain('ISL');
    expect(codes).not.toContain('JPN');
    expect(codes).not.toContain('VNM');
  });
});
