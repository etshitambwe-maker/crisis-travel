import axios from 'axios';
import { withCache, buildCacheKey } from '@/lib/cache/redis';
import { acledIncidentsToScore } from '@/lib/utils/normalize';
import { logger } from '@/lib/utils/logger';
import type { ServiceResult } from '@/types/api.types';

function getLast30DayRange() {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 30);
  return {
    start: start.toISOString().split('T')[0],
    end: end.toISOString().split('T')[0],
  };
}

export async function getACLEDScore(
  countryCode: string,
  acledName: string
): Promise<ServiceResult<{ score: number; incidents: number; fatalities: number }>> {
  if (!process.env.ACLED_ACCESS_KEY || !process.env.ACLED_EMAIL) {
    logger.warn('ACLED', 'Clés manquantes — score neutre');
    return { data: { score: 50, incidents: 0, fatalities: 0 }, source: 'fallback' };
  }

  const key = buildCacheKey('acled', countryCode);
  try {
    const { data, fromCache } = await withCache(
      key,
      async () => {
        const { start, end } = getLast30DayRange();
        const t0 = Date.now();
        const res = await axios.get('https://api.acleddata.com/acled/read', {
          params: {
            key: process.env.ACLED_ACCESS_KEY,
            email: process.env.ACLED_EMAIL,
            country: acledName,
            event_date: `${start}|${end}`,
            event_date_where: 'BETWEEN',
            event_type: 'Battles|Explosions/Remote violence|Violence against civilians',
            fields: 'event_date,event_type,fatalities',
            limit: 500,
          },
          timeout: 5000,
        });
        logger.api('ACLED', countryCode, Date.now() - t0, false);
        const incidents = (res.data.data ?? []) as Array<{ fatalities: number }>;
        return {
          count: incidents.length,
          fatalities: incidents.reduce((s, i) => s + (i.fatalities ?? 0), 0),
        };
      },
      21600
    );
    logger.api('ACLED', countryCode, 0, fromCache);
    return {
      data: { score: acledIncidentsToScore(data.count, data.fatalities), incidents: data.count, fatalities: data.fatalities },
      source: 'live',
    };
  } catch (error) {
    logger.error('ACLED', error);
    return { data: { score: 50, incidents: 0, fatalities: 0 }, source: 'fallback', error: String(error) };
  }
}
