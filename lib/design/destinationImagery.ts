/**
 * FRONT-001 — Destination imagery foundation (stable contract)
 * ────────────────────────────────────────────────────────────────────────
 * Single source of truth for how a destination is visually represented.
 * Built additively on top of the existing, untouchable data:
 *   - TARGET_COUNTRIES (N=18) → countries.ts          [read-only]
 *   - getFlagUrl / COUNTRY_COLORS / WIKI_NAME → countryPhoto.ts
 *
 * The contract per country:
 *   countryCode → flag → heroImage → cardImage → fallbackImage → imageAlt
 *                → tint → accent → region → slug
 *
 * IMAGE SOURCING STRATEGY (decided in FRONT-001):
 *   Curated LOCAL assets only. No source.unsplash.com, no hotlinked /
 *   unstable external photos. heroImage / cardImage point at future local
 *   paths under /public/images/destinations/<slug>/. Those files may not
 *   exist yet — DestinationImage MUST fall back gracefully to the premium
 *   duotone derived from `fallback`. Adding the real .jpg later requires
 *   NO code change: drop the file at the path this registry already emits.
 *
 * This module is data/helpers only — no React, no side effects.
 */

import { TARGET_COUNTRIES, type CountryCode } from '@/lib/utils/countries';
import { getFlagUrl, getCountryColors } from '@/lib/utils/countryPhoto';

/** Premium duotone fallback descriptor (two-stop gradient + accent). */
export interface DuotoneFallback {
  /** Darker base stop (bottom / ink end). */
  from: string;
  /** Brighter stop (top / identity end). */
  to: string;
  /** Accent used for the slot label dot and editorial trim. */
  accent: string;
}

/** The full visual contract for one destination. */
export interface DestinationImagery {
  countryCode: CountryCode;
  /** Human-readable French name (from TARGET_COUNTRIES). */
  name: string;
  /** Kebab-case slug (== meaeSlug); also the local asset folder name. */
  slug: string;
  /** Continent label (from TARGET_COUNTRIES). */
  region: string;
  /** Real flag PNG (flagcdn) — always available. */
  flag: string;
  /** Future curated local hero photo (16/9, full-bleed). May not exist yet. */
  heroImage: string;
  /** Future curated local card photo (smaller, list/grid). May not exist yet. */
  cardImage: string;
  /** Premium duotone fallback, always renderable with zero network. */
  fallback: DuotoneFallback;
  /** Accessible alt text. */
  imageAlt: string;
  /** Two-stop tint (kept for callers wanting just the gradient pair). */
  tint: [string, string];
  /** Identity accent color. */
  accent: string;
}

/** Base folder for curated local destination photography. */
export const DESTINATION_IMAGE_BASE = '/images/destinations';

/**
 * Continent → fallback accent. Gives the duotone a coherent regional
 * identity even before per-country photography exists. Tuned to the v3
 * palette (--ctv3-* tokens).
 */
const REGION_ACCENT: Record<string, string> = {
  Europe: '#5b8def',
  Africa: '#d9742e',
  Asia: '#46b888',
  Americas: '#d8a83e',
  MiddleEast: '#e4332b',
};

const DEFAULT_ACCENT = '#a1a1aa';

/** Local hero asset path for a slug (file may not exist — fallback handles it). */
export function heroImagePath(slug: string): string {
  return `${DESTINATION_IMAGE_BASE}/${slug}/hero.jpg`;
}

/** Local card asset path for a slug (file may not exist — fallback handles it). */
export function cardImagePath(slug: string): string {
  return `${DESTINATION_IMAGE_BASE}/${slug}/card.jpg`;
}

/**
 * Build the duotone fallback from the country's flag-derived colors.
 * COUNTRY_COLORS gives a [primary, secondary] flag pair; we darken toward
 * ink for the bottom stop so text stays legible without a heavy scrim.
 */
function buildFallback(code: string, accent: string): DuotoneFallback {
  const [primary] = getCountryColors(code);
  return {
    // brighter identity stop (top), softened so it reads as editorial duotone
    to: primary,
    // ink end (bottom) — keeps the slot grounded, never pure black
    from: '#0e0e12',
    accent,
  };
}

/** Compute the full imagery contract for a single TARGET_COUNTRIES entry. */
function build(entry: (typeof TARGET_COUNTRIES)[number]): DestinationImagery {
  const accent = REGION_ACCENT[entry.continent] ?? DEFAULT_ACCENT;
  const fallback = buildFallback(entry.code, accent);
  return {
    countryCode: entry.code,
    name: entry.name,
    slug: entry.meaeSlug,
    region: entry.continent,
    flag: getFlagUrl(entry.code),
    heroImage: heroImagePath(entry.meaeSlug),
    cardImage: cardImagePath(entry.meaeSlug),
    fallback,
    imageAlt: entry.name,
    tint: [fallback.to, fallback.from],
    accent,
  };
}

/** Registry keyed by ISO-2 country code, covering all 18 TARGET_COUNTRIES. */
export const DESTINATION_IMAGERY: Record<string, DestinationImagery> =
  Object.fromEntries(TARGET_COUNTRIES.map((c) => [c.code, build(c)]));

/** Ordered list (same order as TARGET_COUNTRIES) — handy for galleries. */
export const DESTINATION_IMAGERY_LIST: DestinationImagery[] =
  TARGET_COUNTRIES.map(build);

/**
 * Resolve the imagery contract for any code. Unknown / off-coverage codes
 * get a neutral but still-renderable fallback (no throw, no broken image).
 */
export function getDestinationImagery(code: string): DestinationImagery {
  const upper = (code || '').toUpperCase();
  const found = DESTINATION_IMAGERY[upper];
  if (found) return found;
  return {
    countryCode: upper as CountryCode,
    name: upper || 'Destination',
    slug: upper.toLowerCase() || 'unknown',
    region: '',
    flag: upper ? getFlagUrl(upper) : '',
    heroImage: '',
    cardImage: '',
    fallback: { from: '#0e0e12', to: '#1a1a2a', accent: DEFAULT_ACCENT },
    imageAlt: upper || 'Destination',
    tint: ['#1a1a2a', '#0e0e12'],
    accent: DEFAULT_ACCENT,
  };
}

/** CSS background string for the duotone fallback (no photo case). */
export function duotoneBackground(fb: DuotoneFallback): string {
  return [
    `radial-gradient(120% 80% at 70% 28%, ${fb.to}, transparent 60%)`,
    `radial-gradient(140% 100% at 20% 95%, ${fb.from}, ${fb.from})`,
    `repeating-linear-gradient(0deg, rgba(255,255,255,.014) 0 1px, transparent 1px 38px)`,
    `repeating-linear-gradient(90deg, rgba(255,255,255,.014) 0 1px, transparent 1px 38px)`,
  ].join(', ');
}
