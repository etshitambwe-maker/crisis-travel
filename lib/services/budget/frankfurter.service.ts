import axios from 'axios';
import { withCache, buildCacheKey } from '@/lib/cache/redis';
import { currencyVariationToScore } from '@/lib/utils/normalize';
import { logger } from '@/lib/utils/logger';
import type { ServiceResult } from '@/types/api.types';

const COUNTRY_CURRENCY: Record<string, string> = {
  TH: 'THB', GE: 'GEL', MA: 'MAD', VN: 'VND', MX: 'MXN',
  TR: 'TRY', EG: 'EGP', RS: 'RSD', AL: 'ALL', CO: 'COP',
  JP: 'JPY', ID: 'IDR', PE: 'PEN', TN: 'TND', KG: 'KGS',
  MD: 'MDL', AM: 'AMD', UZ: 'UZS', KH: 'KHR', LK: 'LKR',
  PH: 'PHP', EC: 'USD', BA: 'BAM', MK: 'MKD',
};

export async function getFrankfurterScore(
  countryCode: string
): Promise<ServiceResult<{ score: number; currency: string; variation: number }>> {
  const currency = COUNTRY_CURRENCY[countryCode];
  if (!currency || currency === 'EUR') {
    return { data: { score: 55, currency: 'EUR', variation: 0 }, source: 'fallback' };
  }

  const key = buildCacheKey('frankfurter', countryCode);
  try {
    const { data, fromCache } = await withCache(
      key,
      async () => {
        const yearAgo = new Date();
        yearAgo.setFullYear(yearAgo.getFullYear() - 1);
        const dateStr = yearAgo.toISOString().split('T')[0];
        const t0 = Date.now();
        const [cur, hist] = await Promise.all([
          axios.get('https://api.frankfurter.app/latest', { params: { from: 'EUR', to: currency }, timeout: 5000 }),
          axios.get(`https://api.frankfurter.app/${dateStr}`, { params: { from: 'EUR', to: currency }, timeout: 5000 }),
        ]);
        logger.api('Frankfurter', countryCode, Date.now() - t0, false);
        const current = cur.data.rates[currency] as number;
        const historical = hist.data.rates[currency] as number;
        return { current, historical, variation: ((current - historical) / historical) * 100 };
      },
      3600,
      'frankfurter',
    );
    logger.api('Frankfurter', countryCode, 0, fromCache);
    return {
      data: { score: currencyVariationToScore(data.variation), currency, variation: Math.round(data.variation * 10) / 10 },
      source: 'live',
    };
  } catch (error) {
    logger.error('Frankfurter', error);
    return { data: { score: 50, currency, variation: 0 }, source: 'fallback', error: String(error) };
  }
}
