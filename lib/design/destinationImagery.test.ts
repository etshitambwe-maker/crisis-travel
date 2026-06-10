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

/** FRONT-024D pilot batch (5). */
const PILOT_CODES = ['GR', 'TH', 'TN', 'PT', 'MX'] as const;
/** FRONT-025B Europe batch (12). */
const EUROPE_025B_CODES = [
  'GE', 'AL', 'RS', 'BA', 'MD', 'MK', 'AM', 'TR', 'ME', 'XK', 'HR', 'HU',
] as const;
/** FRONT-025C Middle East + Americas pt.1 batch (9). */
const AMERICAS_ME_025C_CODES = [
  'JO', 'AE', 'OM', 'CO', 'PE', 'EC', 'BO', 'CL', 'AR',
] as const;
/** FRONT-025D Asia + Americas pt.2 batch (10). */
const ASIA_AMERICAS_025D_CODES = [
  'BR', 'CR', 'ID', 'MY', 'NP', 'PA', 'DO', 'LK', 'UY', 'VN',
] as const;
/** FRONT-025E Africa + Asia pt.1 batch (10). */
const AFRICA_ASIA_025E_CODES = [
  'JP', 'KH', 'UZ', 'SG', 'KG', 'MA', 'KE', 'RW', 'ZA', 'MG',
] as const;
/** FRONT-025E2A Africa pt.2 batch (12). */
const AFRICA_025E2A_CODES = [
  'EG', 'SN', 'CI', 'GH', 'TZ', 'ET', 'MU', 'CM', 'CG', 'CD', 'NG', 'AO',
] as const;
/** All currently opted-in codes (58). */
const ACTIVE_CODES = [
  ...PILOT_CODES,
  ...EUROPE_025B_CODES,
  ...AMERICAS_ME_025C_CODES,
  ...ASIA_AMERICAS_025D_CODES,
  ...AFRICA_ASIA_025E_CODES,
  ...AFRICA_025E2A_CODES,
] as const;

/** code → meaeSlug for every active destination (asset folder names). */
const ACTIVE_SLUGS: Record<(typeof ACTIVE_CODES)[number], string> = {
  // pilot
  GR: 'grece',
  TH: 'thailande',
  TN: 'tunisie',
  PT: 'portugal',
  MX: 'mexique',
  // Europe 025B
  GE: 'georgie',
  AL: 'albanie',
  RS: 'serbie',
  BA: 'bosnie-herzegovine',
  MD: 'moldavie',
  MK: 'macedoine-du-nord',
  AM: 'armenie',
  TR: 'turquie',
  ME: 'montenegro',
  XK: 'kosovo',
  HR: 'croatie',
  HU: 'hongrie',
  // Middle East + Americas pt.1 025C
  JO: 'jordanie',
  AE: 'emirats-arabes-unis',
  OM: 'oman',
  CO: 'colombie',
  PE: 'perou',
  EC: 'equateur',
  BO: 'bolivie',
  CL: 'chili',
  AR: 'argentine',
  // Asia + Americas pt.2 025D
  BR: 'bresil',
  CR: 'costa-rica',
  ID: 'indonesie',
  MY: 'malaisie',
  NP: 'nepal',
  PA: 'panama',
  DO: 'republique-dominicaine',
  LK: 'sri-lanka',
  UY: 'uruguay',
  VN: 'vietnam',
  // Africa + Asia pt.1 025E
  JP: 'japon',
  KH: 'cambodge',
  UZ: 'ouzbekistan',
  SG: 'singapour',
  KG: 'kirghizistan',
  MA: 'maroc',
  KE: 'kenya',
  RW: 'rwanda',
  ZA: 'afrique-du-sud',
  MG: 'madagascar',
  // Africa pt.2 025E2A
  EG: 'egypte',
  SN: 'senegal',
  CI: 'cote-d-ivoire',
  GH: 'ghana',
  TZ: 'tanzanie',
  ET: 'ethiopie',
  MU: 'maurice',
  CM: 'cameroun',
  CG: 'congo-brazzaville',
  CD: 'republique-democratique-du-congo',
  NG: 'nigeria',
  AO: 'angola',
};

describe('destinationImagery — curated local photo opt-in (FRONT-024D + 025B + 025C + 025D + 025E + 025E2A)', () => {
  it('exposes exactly the 58 opted-in codes in the availability set', () => {
    expect(DESTINATION_PHOTO_AVAILABILITY.size).toBe(58);
    for (const code of ACTIVE_CODES) {
      expect(DESTINATION_PHOTO_AVAILABILITY.has(code)).toBe(true);
    }
  });

  it('hasDestinationPhoto is true for all 58 active codes', () => {
    for (const code of ACTIVE_CODES) {
      expect(hasDestinationPhoto(code)).toBe(true);
    }
  });

  it('hasDestinationPhoto is true for each of the 12 Europe 025B codes', () => {
    for (const code of EUROPE_025B_CODES) {
      expect(hasDestinationPhoto(code)).toBe(true);
    }
  });

  it('hasDestinationPhoto is true for each of the 9 Middle East + Americas 025C codes', () => {
    for (const code of AMERICAS_ME_025C_CODES) {
      expect(hasDestinationPhoto(code)).toBe(true);
    }
  });

  it('hasDestinationPhoto is true for each of the 10 Asia + Americas 025D codes', () => {
    for (const code of ASIA_AMERICAS_025D_CODES) {
      expect(hasDestinationPhoto(code)).toBe(true);
    }
  });

  it('hasDestinationPhoto is true for each of the 10 Africa + Asia 025E codes', () => {
    for (const code of AFRICA_ASIA_025E_CODES) {
      expect(hasDestinationPhoto(code)).toBe(true);
    }
  });

  it('hasDestinationPhoto is true for each of the 12 Africa pt.2 025E2A codes', () => {
    for (const code of AFRICA_025E2A_CODES) {
      expect(hasDestinationPhoto(code)).toBe(true);
    }
  });

  it('hasDestinationPhoto is false for every non-active TARGET_COUNTRIES entry (7)', () => {
    const active = new Set<string>(ACTIVE_CODES);
    let falseCount = 0;
    for (const c of TARGET_COUNTRIES) {
      if (active.has(c.code)) continue;
      expect(hasDestinationPhoto(c.code)).toBe(false);
      falseCount += 1;
    }
    expect(falseCount).toBe(7);
    expect(TARGET_COUNTRIES.length).toBe(65);
  });

  it('hasDestinationPhoto is false for representative non-active codes', () => {
    for (const code of ['PH', 'MM', 'IN', 'KZ', 'PY', 'GT', 'CU']) {
      expect(hasDestinationPhoto(code)).toBe(false);
    }
  });

  it('hasDestinationPhoto is case-insensitive and safe for unknown/empty input', () => {
    expect(hasDestinationPhoto('gr')).toBe(true);
    expect(hasDestinationPhoto('al')).toBe(true);
    expect(hasDestinationPhoto('ba')).toBe(true);
    expect(hasDestinationPhoto('zz')).toBe(false);
    expect(hasDestinationPhoto('ZZ')).toBe(false);
    expect(hasDestinationPhoto('')).toBe(false);
    // @ts-expect-error — guards against nullish input at runtime
    expect(hasDestinationPhoto(undefined)).toBe(false);
  });

  it('uses the WebP extension for every curated local photo path', () => {
    expect(DESTINATION_PHOTO_EXT).toBe('webp');
  });

  it('emits exact /images/destinations/<slug>/{hero,card}.webp paths for every active code', () => {
    for (const code of ACTIVE_CODES) {
      const slug = ACTIVE_SLUGS[code];
      expect(heroImagePath(slug)).toBe(`/images/destinations/${slug}/hero.webp`);
      expect(cardImagePath(slug)).toBe(`/images/destinations/${slug}/card.webp`);
    }
  });

  it('resolves the registry imagery to the .webp asset paths via exact meaeSlug', () => {
    for (const code of ACTIVE_CODES) {
      const slug = ACTIVE_SLUGS[code];
      const ident = getDestinationImagery(code);
      expect(ident.slug).toBe(slug);
      expect(ident.heroImage).toBe(`/images/destinations/${slug}/hero.webp`);
      expect(ident.cardImage).toBe(`/images/destinations/${slug}/card.webp`);
    }
  });

  it('uses the exact sensitive Europe slugs (hyphenated, accent-free)', () => {
    expect(getDestinationImagery('BA').slug).toBe('bosnie-herzegovine');
    expect(getDestinationImagery('MK').slug).toBe('macedoine-du-nord');
    expect(getDestinationImagery('ME').slug).toBe('montenegro');
    expect(getDestinationImagery('GE').slug).toBe('georgie');
    expect(getDestinationImagery('GR').slug).toBe('grece');
  });

  it('uses grece (FR slug) and never greece (EN) in Greece paths', () => {
    const gr = getDestinationImagery('GR');
    expect(gr.slug).toBe('grece');
    expect(gr.heroImage).toContain('/destinations/grece/');
    expect(gr.heroImage).not.toContain('greece');
    expect(gr.cardImage).not.toContain('greece');
    expect(heroImagePath('grece')).not.toContain('greece');
  });

  it('never emits "greece" anywhere in any active destination path', () => {
    for (const code of ACTIVE_CODES) {
      const ident = getDestinationImagery(code);
      expect(ident.heroImage).not.toContain('greece');
      expect(ident.cardImage).not.toContain('greece');
    }
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
