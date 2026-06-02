import axios from 'axios';
import { withCache, buildCacheKey } from '@/lib/cache/redis';
import { logger } from '@/lib/utils/logger';
import type { ServiceResult } from '@/types/api.types';

// Mapping code pays → slug Teleport urban area
const TELEPORT_SLUGS: Record<string, string> = {
  PT: 'lisbon',        GR: 'athens',       HR: 'zagreb',
  HU: 'budapest',      TR: 'istanbul',      RS: 'belgrade',
  MA: 'casablanca',    EG: 'cairo',         TN: 'tunis',
  ZA: 'cape-town',     KE: 'nairobi',       NG: 'lagos',
  TH: 'bangkok',       VN: 'ho-chi-minh-city', JP: 'tokyo',
  ID: 'jakarta',       PH: 'manila',        MY: 'kuala-lumpur',
  SG: 'singapore',     IN: 'delhi',         NP: 'kathmandu',
  MX: 'mexico-city',   CO: 'bogota',        PE: 'lima',
  BR: 'sao-paulo',     AR: 'buenos-aires',  CL: 'santiago',
  CR: 'san-jose',      PA: 'panama-city',   DO: 'santo-domingo',
  JO: 'amman',         AE: 'dubai',         KH: 'phnom-penh',
  EC: 'quito',         GT: 'guatemala-city',
};

type TeleportResult = {
  score: number;
  costIndex: number;
  safetyScore: number;
  healthcareScore: number;
};

export async function getTeleportScore(
  countryCode: string
): Promise<ServiceResult<TeleportResult>> {
  const slug = TELEPORT_SLUGS[countryCode];
  if (!slug) {
    return { data: { score: 50, costIndex: 55, safetyScore: 50, healthcareScore: 50 }, source: 'fallback' };
  }

  const key = buildCacheKey('teleport', countryCode);
  try {
    const { data, fromCache } = await withCache(
      key,
      async () => {
        const t0 = Date.now();
        const res = await axios.get(
          `https://api.teleport.org/api/urban_areas/slug:${slug}/scores/`,
          { timeout: 5000, headers: { Accept: 'application/vnd.teleport.v1+json' } }
        );
        logger.api('Teleport', countryCode, Date.now() - t0, false);

        const cats: Array<{ name: string; score_out_of_10: number }> =
          res.data?.categories ?? [];

        const get = (name: string) =>
          (cats.find((c) => c.name.toLowerCase().includes(name))?.score_out_of_10 ?? 5) * 10;

        return {
          costIndex:       get('cost of living'),
          safetyScore:     get('safety'),
          healthcareScore: get('healthcare'),
        };
      },
      86400, // 24h
      'teleport',
    );
    if (fromCache) logger.api('Teleport', countryCode, 0, true);

    // costIndex ici est un score /100 (pas un indice comme Numbeo)
    // Un coût de vie bas = bon pour le voyageur → on inverse
    const costScore = clampScore(100 - data.costIndex);

    return {
      data: {
        score: clampScore(Math.round(costScore * 0.5 + data.safetyScore * 0.3 + data.healthcareScore * 0.2)),
        costIndex: data.costIndex,
        safetyScore: data.safetyScore,
        healthcareScore: data.healthcareScore,
      },
      source: 'live',
    };
  } catch (error) {
    logger.error('Teleport', error);
    return { data: { score: 50, costIndex: 55, safetyScore: 50, healthcareScore: 50 }, source: 'fallback' };
  }
}

function clampScore(v: number): number {
  return Math.min(100, Math.max(0, v));
}
