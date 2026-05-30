import { describe, it, expect } from 'vitest';
import {
  meaeLevelToScore,
  acledIncidentsToScore,
  currencyVariationToScore,
  costOfLivingToScore,
  normalizeWorldBankIndicator,
} from '../lib/utils/normalize';

describe('meaeLevelToScore', () => {
  it('niveau 1 → 100 (sûr)', () => expect(meaeLevelToScore(1)).toBe(100));
  it('niveau 2 → 70 (vigilance)', () => expect(meaeLevelToScore(2)).toBe(70));
  it('niveau 3 → 25 (déconseillé)', () => expect(meaeLevelToScore(3)).toBe(25));
  it('niveau 4 → 0 (formellement déconseillé)', () => expect(meaeLevelToScore(4)).toBe(0));
});

describe('acledIncidentsToScore', () => {
  it('0 incidents → 100', () => expect(acledIncidentsToScore(0, 0)).toBe(100));
  it('1-5 incidents → 80', () => expect(acledIncidentsToScore(3, 0)).toBe(80));
  it('6-20 incidents → 50', () => expect(acledIncidentsToScore(10, 0)).toBe(50));
  it('21-50 incidents → 20', () => expect(acledIncidentsToScore(30, 0)).toBe(20));
  it('>50 incidents → 0', () => expect(acledIncidentsToScore(100, 0)).toBe(0));
  it('fatalities > 10 = malus -15', () => expect(acledIncidentsToScore(3, 15)).toBe(65));
  it('score ne descend pas sous 0', () => expect(acledIncidentsToScore(100, 20)).toBe(0));
});

describe('currencyVariationToScore', () => {
  it('variation neutre (0%) → 50', () => expect(currencyVariationToScore(0)).toBe(50));
  it('EUR +20% → 90 (favorable voyageur)', () => expect(currencyVariationToScore(20)).toBe(90));
  it('EUR -10% → 30 (défavorable)', () => expect(currencyVariationToScore(-10)).toBe(30));
  it('score clampé à 100 max', () => expect(currencyVariationToScore(100)).toBe(100));
  it('score clampé à 0 min', () => expect(currencyVariationToScore(-100)).toBe(0));
});

describe('costOfLivingToScore', () => {
  it('index < 30 (très bon marché) → 100', () => expect(costOfLivingToScore(20)).toBe(100));
  it('index 30-50 → 80', () => expect(costOfLivingToScore(40)).toBe(80));
  it('index 50-70 → 60', () => expect(costOfLivingToScore(60)).toBe(60));
  it('index 70-90 → 40', () => expect(costOfLivingToScore(80)).toBe(40));
  it('index >= 90 (très cher) → 20', () => expect(costOfLivingToScore(95)).toBe(20));
});

describe('normalizeWorldBankIndicator', () => {
  it('null → 50 (neutre)', () => expect(normalizeWorldBankIndicator(null)).toBe(50));
  it('+2.5 (max) → 100', () => expect(normalizeWorldBankIndicator(2.5)).toBe(100));
  it('-2.5 (min) → 0', () => expect(normalizeWorldBankIndicator(-2.5)).toBe(0));
  it('0 (médiane) → 50', () => expect(normalizeWorldBankIndicator(0)).toBe(50));
});
