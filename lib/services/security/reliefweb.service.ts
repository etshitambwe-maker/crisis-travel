import axios from 'axios';
import { withCache, buildCacheKey } from '@/lib/cache/redis';
import { logger } from '@/lib/utils/logger';
import type { ServiceResult } from '@/types/api.types';

// ReliefWeb v1/disasters endpoint — stable et gratuit, pas besoin de POST
export async function getReliefWebScore(
  countryCode: string,
  iso3: string
): Promise<ServiceResult<{ score: number; activeCrises: number }>> {
  const key = buildCacheKey('reliefweb', countryCode);
  try {
    const { data, fromCache } = await withCache(
      key,
      async () => {
        const since = new Date();
        since.setDate(since.getDate() - 90); // 90 jours pour plus de signal
        const t0 = Date.now();
        const res = await axios.post(
          'https://api.reliefweb.int/v1/reports',
          {
            appname: 'crisis-travel',
            filter: {
              operator: 'AND',
              conditions: [
                { field: 'country.iso3', value: iso3 },
                { field: 'theme.name', value: 'Disaster Management' },
              ],
            },
            fields: { include: ['title'] },
            limit: 5,
          },
          { timeout: 5000 }
        );
        logger.api('ReliefWeb', countryCode, Date.now() - t0, false);
        const count = (res.data?.totalCount as number) ?? (res.data?.data?.length ?? 0);
        return { count };
      },
      7200, // 2h de cache
      'reliefweb',
    );
    if (fromCache) logger.api('ReliefWeb', countryCode, 0, true);
    return {
      data: { score: data.count > 0 ? 40 : 100, activeCrises: data.count },
      source: 'live',
    };
  } catch {
    // Fallback neutre silencieux — ReliefWeb est optionnel
    return { data: { score: 100, activeCrises: 0 }, source: 'fallback' };
  }
}
