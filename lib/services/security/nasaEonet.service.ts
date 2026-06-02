import axios from 'axios';
import { withCache, buildCacheKey } from '@/lib/cache/redis';
import { logger } from '@/lib/utils/logger';
import type { ServiceResult } from '@/types/api.types';

// Bounding boxes approximatifs [minLon, minLat, maxLon, maxLat]
const COUNTRY_BBOX: Record<string, [number, number, number, number]> = {
  PT: [-9.5, 36.9, -6.2, 42.2],   GE: [39.9, 41.0, 46.7, 43.6],
  AL: [19.3, 39.6, 21.1, 42.7],   RS: [18.8, 42.2, 23.0, 46.2],
  BA: [15.7, 42.5, 19.6, 45.3],   TR: [25.7, 35.8, 44.8, 42.1],
  MA: [-13.2, 27.7, -1.0, 35.9],  TN: [7.5, 30.2, 11.6, 37.5],
  EG: [24.7, 22.0, 37.1, 31.7],   SN: [-17.5, 12.3, -11.4, 15.0],
  KE: [33.9, -4.7, 41.9, 5.0],    TZ: [29.3, -11.7, 40.4, -1.0],
  TH: [97.3, 5.6, 105.6, 20.5],   VN: [102.1, 8.4, 109.5, 23.4],
  JP: [122.9, 24.0, 153.9, 45.5], ID: [95.0, -11.0, 141.0, 6.0],
  PH: [116.9, 4.6, 126.6, 21.1],  MY: [99.6, 0.8, 119.3, 7.4],
  MM: [92.2, 9.8, 101.2, 28.5],   NP: [80.1, 26.4, 88.2, 30.4],
  IN: [68.1, 6.7, 97.4, 35.7],    MX: [-118.4, 14.5, -86.7, 32.7],
  CO: [-79.0, -4.3, -66.8, 12.5], BR: [-73.9, -33.7, -34.7, 5.3],
  PE: [-81.3, -18.3, -68.7, -0.1],CL: [-75.7, -55.9, -66.4, -17.5],
  EC: [-80.9, -5.0, -75.2, 1.5],  AR: [-73.6, -55.0, -53.6, -21.8],
  JO: [34.9, 29.2, 39.3, 33.4],   AE: [51.5, 22.6, 56.4, 26.1],
  ZA: [16.3, -34.8, 33.0, -22.1], ET: [33.0, 3.4, 48.0, 15.0],
};

type EonetResult = { score: number; activeEvents: number; categories: string[] };

export async function getNasaEonetScore(
  countryCode: string
): Promise<ServiceResult<EonetResult>> {
  const bbox = COUNTRY_BBOX[countryCode];
  if (!bbox) {
    return { data: { score: 85, activeEvents: 0, categories: [] }, source: 'fallback' };
  }

  const key = buildCacheKey('eonet', countryCode);
  try {
    const { data, fromCache } = await withCache(
      key,
      async () => {
        const t0 = Date.now();
        const res = await axios.get('https://eonet.gsfc.nasa.gov/api/v3/events', {
          params: {
            status: 'open',
            days: 30,
            bbox: bbox.join(','),
            limit: 20,
          },
          timeout: 5000,
        });
        logger.api('NASA EONET', countryCode, Date.now() - t0, false);

        const events: Array<{ categories: Array<{ title: string }> }> =
          res.data?.events ?? [];

        // Catégories à impact voyageur
        const HIGH_IMPACT = ['Severe Storms', 'Floods', 'Volcanoes', 'Wildfires'];
        const MED_IMPACT  = ['Earthquakes', 'Drought', 'Dust and Haze', 'Snow'];

        let riskScore = 0;
        const categories: string[] = [];

        for (const event of events) {
          for (const cat of event.categories) {
            if (!categories.includes(cat.title)) categories.push(cat.title);
            if (HIGH_IMPACT.includes(cat.title)) riskScore += 15;
            else if (MED_IMPACT.includes(cat.title)) riskScore += 7;
            else riskScore += 3;
          }
        }

        return { riskScore: Math.min(riskScore, 80), activeEvents: events.length, categories };
      },
      7200 // 2h
    );
    if (fromCache) logger.api('NASA EONET', countryCode, 0, true);

    const score = Math.max(0, 100 - data.riskScore);
    return {
      data: { score, activeEvents: data.activeEvents, categories: data.categories },
      source: 'live',
    };
  } catch (error) {
    logger.error('NASA EONET', error);
    return { data: { score: 85, activeEvents: 0, categories: [] }, source: 'fallback' };
  }
}
