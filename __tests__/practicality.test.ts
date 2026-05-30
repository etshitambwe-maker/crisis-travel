import { describe, it, expect } from 'vitest';
import { calculatePracticalityScore } from '../lib/services/scoring/practicality.service';

describe('calculatePracticalityScore', () => {
  it('Japon — sans visa + vol direct = score élevé', () => {
    const score = calculatePracticalityScore('JP');
    expect(score.value).toBeGreaterThan(90);
    expect(score.details.visaType).toBe('none');
    expect(score.details.directFlight).toBe(1);
  });

  it('Portugal — sans visa + vol direct = score max', () => {
    const score = calculatePracticalityScore('PT');
    expect(score.value).toBeGreaterThan(90);
  });

  it('Turquie — e-visa = score légèrement réduit', () => {
    const score = calculatePracticalityScore('TR');
    expect(score.value).toBeLessThan(95);
    expect(score.details.visaType).toBe('evisa');
  });

  it('Cameroun — visa ambassade = score réduit vs pays sans visa', () => {
    const scoreCM = calculatePracticalityScore('CM');
    const scoreJP = calculatePracticalityScore('JP');
    // Le Cameroun doit avoir un score inférieur au Japon (sans visa)
    expect(scoreCM.value).toBeLessThan(scoreJP.value);
    expect(scoreCM.details.visaType).toBe('embassy_simple');
  });

  it('pays inconnu → score neutre 65', () => {
    const score = calculatePracticalityScore('XX');
    expect(score.value).toBe(65);
    expect(score.source).toBe('fallback');
  });

  it('score toujours entre 0 et 100', () => {
    const countries = ['TH', 'VN', 'JP', 'ID', 'MA', 'ZA', 'BR', 'AR', 'AE', 'JO'];
    countries.forEach((code) => {
      const score = calculatePracticalityScore(code);
      expect(score.value).toBeGreaterThanOrEqual(0);
      expect(score.value).toBeLessThanOrEqual(100);
    });
  });
});
