import { clamp } from '@/types/crisis.types';

export function normalize(value: number, min: number, max: number): number {
  return clamp(Math.round(((value - min) / (max - min)) * 100));
}

export function normalizeWorldBankIndicator(value: number | null): number {
  if (value === null) return 50;
  return normalize(value, -2.5, 2.5);
}

export function meaeLevelToScore(level: 1 | 2 | 3 | 4): number {
  const map = { 1: 100, 2: 70, 3: 25, 4: 0 };
  return map[level];
}

export function acledIncidentsToScore(count: number, fatalities: number): number {
  const base = count === 0 ? 100 : count <= 5 ? 80 : count <= 20 ? 50 : count <= 50 ? 20 : 0;
  const fatalityMalus = fatalities > 10 ? -15 : 0;
  return clamp(base + fatalityMalus);
}

export function currencyVariationToScore(variationPercent: number): number {
  return clamp(50 + variationPercent * 2);
}

export function costOfLivingToScore(index: number): number {
  if (index < 30) return 100;
  if (index < 50) return 80;
  if (index < 70) return 60;
  if (index < 90) return 40;
  return 20;
}
