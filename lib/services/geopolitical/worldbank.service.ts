import axios from 'axios';
import { withCache, buildCacheKey } from '@/lib/cache/redis';
import { normalizeWorldBankIndicator } from '@/lib/utils/normalize';
import { logger } from '@/lib/utils/logger';
import type { ServiceResult } from '@/types/api.types';

const INDICATORS = ['PV.EST', 'RL.EST', 'GE.EST'] as const;

async function fetchIndicator(code: string, indicator: string): Promise<number | null> {
  const res = await axios.get(
    `https://api.worldbank.org/v2/country/${code.toLowerCase()}/indicator/${indicator}`,
    { params: { format: 'json', mrv: 1 }, timeout: 5000 }
  );
  const rows = res.data as [unknown, Array<{ value: number | null }>];
  return rows[1]?.[0]?.value ?? null;
}

export async function getWorldBankScore(
  countryCode: string
): Promise<ServiceResult<{ score: number }>> {
  const key = buildCacheKey('worldbank', countryCode);
  try {
    const { data, fromCache } = await withCache(
      key,
      async () => {
        const t0 = Date.now();
        const values = await Promise.all(INDICATORS.map((ind) => fetchIndicator(countryCode, ind)));
        logger.api('WorldBank', countryCode, Date.now() - t0, false);
        return values.map((v) => normalizeWorldBankIndicator(v));
      },
      86400
    );
    logger.api('WorldBank', countryCode, 0, fromCache);
    const avg = Math.round(data.reduce((a, b) => a + b, 0) / data.length);
    return { data: { score: avg }, source: 'live' };
  } catch (error) {
    logger.error('WorldBank', error);
    return { data: { score: 50 }, source: 'fallback', error: String(error) };
  }
}
