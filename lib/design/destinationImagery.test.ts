import { describe, it, expect } from 'vitest';
import {
  hasDestinationPhoto,
  DESTINATION_PHOTO_AVAILABILITY,
  DESTINATION_PHOTO_EXT,
  heroImagePath,
  cardImagePath,
  getDestinationImagery,
} from './destinationImagery';
import { TARGET_COUNTRIES } from '@/lib/utils/countries';

describe('destinationImagery — curated local photo opt-in (FRONT-024C)', () => {
  it('ships with an empty availability set (no curated local photo today)', () => {
    expect(DESTINATION_PHOTO_AVAILABILITY.size).toBe(0);
  });

  it('hasDestinationPhoto is false for every TARGET_COUNTRIES entry', () => {
    for (const c of TARGET_COUNTRIES) {
      expect(hasDestinationPhoto(c.code)).toBe(false);
    }
  });

  it('hasDestinationPhoto is false for a few representative codes', () => {
    for (const code of ['PT', 'MA', 'JP']) {
      expect(hasDestinationPhoto(code)).toBe(false);
    }
  });

  it('hasDestinationPhoto is case-insensitive and safe for unknown/empty input', () => {
    expect(hasDestinationPhoto('pt')).toBe(false);
    expect(hasDestinationPhoto('ZZ')).toBe(false);
    expect(hasDestinationPhoto('')).toBe(false);
    // @ts-expect-error — guards against nullish input at runtime
    expect(hasDestinationPhoto(undefined)).toBe(false);
  });

  it('keeps the curated photo paths on the .jpg extension (no WebP yet)', () => {
    expect(DESTINATION_PHOTO_EXT).toBe('jpg');
    expect(heroImagePath('portugal')).toBe('/images/destinations/portugal/hero.jpg');
    expect(cardImagePath('portugal')).toBe('/images/destinations/portugal/card.jpg');
  });

  it('still resolves a renderable duotone fallback for known and unknown codes', () => {
    const known = getDestinationImagery('PT');
    expect(known.fallback.from).toBeTruthy();
    expect(known.fallback.to).toBeTruthy();
    const unknown = getDestinationImagery('ZZ');
    expect(unknown.fallback.from).toBeTruthy();
    expect(unknown.fallback.to).toBeTruthy();
  });
});
