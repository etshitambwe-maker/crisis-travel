import axios from 'axios';
import { withCache, buildCacheKey } from '@/lib/cache/redis';
import { logger } from '@/lib/utils/logger';
import type { ServiceResult } from '@/types/api.types';

// Noms en anglais pour la requête GDELT (doit matcher les articles de presse)
const GDELT_NAMES: Record<string, string> = {
  PT: 'Portugal',      GE: 'Georgia',       AL: 'Albania',
  RS: 'Serbia',        BA: 'Bosnia',        MD: 'Moldova',
  MK: 'North Macedonia', AM: 'Armenia',     TR: 'Turkey',
  ME: 'Montenegro',    XK: 'Kosovo',        GR: 'Greece',
  HR: 'Croatia',       HU: 'Hungary',       MA: 'Morocco',
  TN: 'Tunisia',       EG: 'Egypt',         SN: 'Senegal',
  CI: 'Ivory Coast',   GH: 'Ghana',         KE: 'Kenya',
  TZ: 'Tanzania',      RW: 'Rwanda',        ET: 'Ethiopia',
  ZA: 'South Africa',  MU: 'Mauritius',     MG: 'Madagascar',
  CM: 'Cameroon',      NG: 'Nigeria',       AO: 'Angola',
  TH: 'Thailand',      VN: 'Vietnam',       JP: 'Japan',
  ID: 'Indonesia',     KG: 'Kyrgyzstan',    UZ: 'Uzbekistan',
  KH: 'Cambodia',      LK: 'Sri Lanka',     PH: 'Philippines',
  MY: 'Malaysia',      SG: 'Singapore',     MM: 'Myanmar',
  NP: 'Nepal',         IN: 'India',         KZ: 'Kazakhstan',
  MX: 'Mexico',        CO: 'Colombia',      PE: 'Peru',
  EC: 'Ecuador',       BO: 'Bolivia',       UY: 'Uruguay',
  GT: 'Guatemala',     CR: 'Costa Rica',    PA: 'Panama',
  CU: 'Cuba',          DO: 'Dominican Republic', BR: 'Brazil',
  AR: 'Argentina',     CL: 'Chile',         JO: 'Jordan',
  AE: 'United Arab Emirates', OM: 'Oman',
};

type GdeltResult = { score: number; tone: number; articles: number };

export async function getGdeltScore(
  countryCode: string
): Promise<ServiceResult<GdeltResult>> {
  const name = GDELT_NAMES[countryCode];
  if (!name) {
    return { data: { score: 50, tone: 0, articles: 0 }, source: 'fallback' };
  }

  const key = buildCacheKey('gdelt', countryCode);
  try {
    const { data, fromCache } = await withCache(
      key,
      async () => {
        const t0 = Date.now();
        // Mode artlist : articles sur 7 jours filtrés par pays + thème sécurité/politique
        const query = encodeURIComponent(
          `"${name}" (conflict OR violence OR protest OR attack OR crisis OR war OR instability)`
        );
        const res = await axios.get(
          `https://api.gdeltproject.org/api/v2/doc/doc?query=${query}&mode=tonechart&timespan=7d&format=json`,
          { timeout: 8000 }
        );
        logger.api('GDELT', countryCode, Date.now() - t0, false);

        const timeline: Array<{ date: string; tonavg: number; numarts: number }> =
          res.data?.timeline ?? [];

        if (timeline.length === 0) return { tone: 0, articles: 0 };

        const totalArts = timeline.reduce((s, t) => s + (t.numarts ?? 0), 0);
        const avgTone = totalArts === 0
          ? 0
          : timeline.reduce((s, t) => s + (t.tonavg ?? 0) * (t.numarts ?? 0), 0) / totalArts;

        return { tone: avgTone, articles: totalArts };
      },
      3600 // 1h
    );
    if (fromCache) logger.api('GDELT', countryCode, 0, true);

    // tone va de -100 (très négatif) à +100 (très positif), en pratique -10 à +5
    // On mappe : tone ≥ 0 → score ≥ 65, tone = -5 → 50, tone ≤ -10 → 20
    const score = Math.min(100, Math.max(0, Math.round(60 + data.tone * 4)));

    return { data: { score, tone: data.tone, articles: data.articles }, source: 'live' };
  } catch (error) {
    logger.error('GDELT', error);
    return { data: { score: 50, tone: 0, articles: 0 }, source: 'fallback' };
  }
}
