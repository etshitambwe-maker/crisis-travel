import axios from 'axios';
import { withCache, buildCacheKey } from '@/lib/cache/redis';
import { costOfLivingToScore } from '@/lib/utils/normalize';
import { logger } from '@/lib/utils/logger';
import type { ServiceResult } from '@/types/api.types';

// Données statiques de fallback (indice Numbeo, base NYC=100)
const NUMBEO_STATIC: Record<string, { index: number; mealCheap: number; hotelAvg: number }> = {
  TH: { index: 42, mealCheap: 2.5, hotelAvg: 25 },
  GE: { index: 35, mealCheap: 3, hotelAvg: 30 },
  MA: { index: 38, mealCheap: 3.5, hotelAvg: 40 },
  PT: { index: 57, mealCheap: 10, hotelAvg: 80 },
  JP: { index: 71, mealCheap: 8, hotelAvg: 70 },
  VN: { index: 36, mealCheap: 2, hotelAvg: 20 },
  TR: { index: 33, mealCheap: 3, hotelAvg: 35 },
  AL: { index: 37, mealCheap: 4, hotelAvg: 35 },
  RS: { index: 40, mealCheap: 5, hotelAvg: 45 },
  MX: { index: 44, mealCheap: 3, hotelAvg: 40 },
  CO: { index: 39, mealCheap: 3, hotelAvg: 35 },
  EG: { index: 28, mealCheap: 2, hotelAvg: 25 },
  TN: { index: 34, mealCheap: 3, hotelAvg: 30 },
  ID: { index: 38, mealCheap: 2, hotelAvg: 25 },
  KG: { index: 30, mealCheap: 2, hotelAvg: 20 },
  MD: { index: 32, mealCheap: 3, hotelAvg: 25 },
  KH: { index: 35, mealCheap: 2, hotelAvg: 20 },
  LK: { index: 36, mealCheap: 2.5, hotelAvg: 25 },
  PH: { index: 40, mealCheap: 2, hotelAvg: 30 },
  PE: { index: 38, mealCheap: 3, hotelAvg: 35 },
  BA: { index: 41, mealCheap: 5, hotelAvg: 45 },
  MK: { index: 39, mealCheap: 4, hotelAvg: 40 },
  AM: { index: 38, mealCheap: 4, hotelAvg: 35 },
  UZ: { index: 28, mealCheap: 2, hotelAvg: 20 },
  EC: { index: 40, mealCheap: 3, hotelAvg: 40 },
};

export async function getNumbeoScore(
  countryCode: string
): Promise<ServiceResult<{ score: number; index: number; mealCheap: number; hotelAvg: number }>> {
  const fallback = NUMBEO_STATIC[countryCode] ?? { index: 55, mealCheap: 8, hotelAvg: 60 };

  if (!process.env.NUMBEO_API_KEY) {
    return {
      data: { score: costOfLivingToScore(fallback.index), ...fallback },
      source: 'fallback',
    };
  }

  const key = buildCacheKey('numbeo', countryCode);
  try {
    const { data, fromCache } = await withCache(
      key,
      async () => {
        const t0 = Date.now();
        const res = await axios.get('https://www.numbeo.com/api/country_prices', {
          params: { api_key: process.env.NUMBEO_API_KEY, country: countryCode, currency: 'EUR' },
          timeout: 5000,
        });
        logger.api('Numbeo', countryCode, Date.now() - t0, false);
        return res.data as { costOfLivingIndex: number; mealCheap?: number; hotelAvg?: number };
      },
      86400,
      'numbeo',
    );
    logger.api('Numbeo', countryCode, 0, fromCache);
    const index = data.costOfLivingIndex ?? fallback.index;
    return {
      data: {
        score: costOfLivingToScore(index),
        index,
        mealCheap: data.mealCheap ?? fallback.mealCheap,
        hotelAvg: data.hotelAvg ?? fallback.hotelAvg,
      },
      source: 'live',
    };
  } catch (error) {
    logger.error('Numbeo', error);
    return {
      data: { score: costOfLivingToScore(fallback.index), ...fallback },
      source: 'fallback',
      error: String(error),
    };
  }
}
