import axios from 'axios';
import { withCache, buildCacheKey } from '@/lib/cache/redis';
import { meaeLevelToScore } from '@/lib/utils/normalize';
import { logger } from '@/lib/utils/logger';
import type { ServiceResult } from '@/types/api.types';

async function fetchMEAELevel(slug: string): Promise<1 | 2 | 3 | 4> {
  const url = `https://www.diplomatie.gouv.fr/fr/conseils-aux-voyageurs/conseils-par-pays-destination/${slug}/`;
  const response = await axios.get<string>(url, {
    timeout: 5000,
    headers: { 'User-Agent': 'CrisisTravel/1.0' },
  });
  const html = response.data;
  // Chercher "Niveau X" dans le HTML
  const match = html.match(/niveau\s+(\d)/i);
  if (match) {
    const lvl = parseInt(match[1]);
    if (lvl >= 1 && lvl <= 4) return lvl as 1 | 2 | 3 | 4;
  }
  return 1; // défaut : vigilance normale
}

export async function getMEAEScore(
  countryCode: string,
  slug: string
): Promise<ServiceResult<{ score: number; level: number }>> {
  const key = buildCacheKey('meae', countryCode);
  try {
    const { data: level, fromCache } = await withCache(key, () => fetchMEAELevel(slug), 1800);
    logger.api('MEAE', countryCode, 0, fromCache);
    return { data: { score: meaeLevelToScore(level as 1 | 2 | 3 | 4), level }, source: 'live' };
  } catch (error) {
    logger.error('MEAE', error);
    return { data: { score: 70, level: 2 }, source: 'fallback', error: String(error) };
  }
}
