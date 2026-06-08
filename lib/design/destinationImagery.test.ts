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

/** FRONT-024D pilot batch: exactly these five destinations ship curated WebP. */
const PILOT_CODES = ['GR', 'TH', 'TN', 'PT', 'MX'] as const;
/** code → meaeSlug for the pilot (asset folder names; grece, never greece). */
const PILOT_SLUGS: Record<(typeof PILOT_CODES)[number], string> = {
  GR: 'grece',
  TH: 'thailande',
  TN: 'tunisie',
  PT: 'portugal',
  MX: 'mexique',
};

describe('destinationImagery — curated local photo opt-in (FRONT-024D)', () => {
  it('exposes exactly the five pilot codes in the availability set', () => {
    expect(DESTINATION_PHOTO_AVAILABILITY.size).toBe(5);
    for (const code of PILOT_CODES) {
      expect(DESTINATION_PHOTO_AVAILABILITY.has(code)).toBe(true);
    }
  });

  it('hasDestinationPhoto is true for the five pilot codes', () => {
    for (const code of PILOT_CODES) {
      expect(hasDestinationPhoto(code)).toBe(true);
    }
  });

  it('hasDestinationPhoto is false for every non-pilot TARGET_COUNTRIES entry', () => {
    const pilot = new Set<string>(PILOT_CODES);
    for (const c of TARGET_COUNTRIES) {
      if (pilot.has(c.code)) continue;
      expect(hasDestinationPhoto(c.code)).toBe(false);
    }
  });

  it('hasDestinationPhoto is false for representative non-pilot codes', () => {
    for (const code of ['MA', 'JP', 'BR', 'IN']) {
      expect(hasDestinationPhoto(code)).toBe(false);
    }
  });

  it('hasDestinationPhoto is case-insensitive and safe for unknown/empty input', () => {
    expect(hasDestinationPhoto('gr')).toBe(true);
    expect(hasDestinationPhoto('pt')).toBe(true);
    expect(hasDestinationPhoto('zz')).toBe(false);
    expect(hasDestinationPhoto('ZZ')).toBe(false);
    expect(hasDestinationPhoto('')).toBe(false);
    // @ts-expect-error — guards against nullish input at runtime
    expect(hasDestinationPhoto(undefined)).toBe(false);
  });

  it('uses the WebP extension for every curated local photo path', () => {
    expect(DESTINATION_PHOTO_EXT).toBe('webp');
  });

  it('emits exact /images/destinations/<slug>/{hero,card}.webp paths for the pilot', () => {
    for (const code of PILOT_CODES) {
      const slug = PILOT_SLUGS[code];
      expect(heroImagePath(slug)).toBe(`/images/destinations/${slug}/hero.webp`);
      expect(cardImagePath(slug)).toBe(`/images/destinations/${slug}/card.webp`);
    }
  });

  it('resolves the pilot registry imagery to the .webp asset paths', () => {
    for (const code of PILOT_CODES) {
      const slug = PILOT_SLUGS[code];
      const ident = getDestinationImagery(code);
      expect(ident.slug).toBe(slug);
      expect(ident.heroImage).toBe(`/images/destinations/${slug}/hero.webp`);
      expect(ident.cardImage).toBe(`/images/destinations/${slug}/card.webp`);
    }
  });

  it('uses grece (FR slug) and never greece (EN) in Greece paths', () => {
    const gr = getDestinationImagery('GR');
    expect(gr.slug).toBe('grece');
    expect(gr.heroImage).toContain('/destinations/grece/');
    expect(gr.heroImage).not.toContain('greece');
    expect(gr.cardImage).not.toContain('greece');
    expect(heroImagePath('grece')).not.toContain('greece');
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
