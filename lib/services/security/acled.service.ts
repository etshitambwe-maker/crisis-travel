import axios from 'axios';
import { withCache, buildCacheKey } from '@/lib/cache/redis';
import { logger } from '@/lib/utils/logger';
import type { ServiceResult } from '@/types/api.types';

// Scores statiques par pays — basés sur l'historique des conflits UCDP
// 100 = aucun conflit | 50 = niveau moyen | 0 = zone de guerre active
const CONFLICT_STATIC: Record<string, number> = {
  PT: 95, GE: 60, AL: 75, RS: 70, BA: 72, MD: 65, MK: 78, AM: 55,
  TR: 58, ME: 82, XK: 65, GR: 85, HR: 88, HU: 90,
  MA: 78, TN: 72, EG: 55, SN: 68, CI: 62, GH: 80, KE: 50, TZ: 65,
  RW: 70, ET: 20, ZA: 45, MU: 95, MG: 58, CM: 35, CG: 48, CD: 15,
  NG: 18, AO: 55,
  TH: 65, VN: 88, JP: 98, ID: 68, KG: 72, UZ: 80, KH: 75, LK: 70,
  PH: 50, MY: 82, SG: 99, MM: 10, NP: 72, IN: 55, KZ: 78,
  MX: 35, CO: 40, PE: 62, EC: 45, BO: 65, PY: 75, UY: 88, GT: 42,
  CR: 85, PA: 72, CU: 70, DO: 65, BR: 48, AR: 70, CL: 68,
  JO: 72, AE: 92, OM: 88,
};

// ISO-2 → nom pays tel qu'utilisé par l'API UCDP
const UCDP_COUNTRY_MAP: Record<string, string> = {
  PT: 'Portugal', GE: 'Georgia', AL: 'Albania', RS: 'Serbia',
  BA: 'Bosnia and Herzegovina', MD: 'Moldova', MK: 'North Macedonia',
  AM: 'Armenia', TR: 'Turkey', ME: 'Montenegro', XK: 'Kosovo',
  GR: 'Greece', HR: 'Croatia', HU: 'Hungary',
  MA: 'Morocco', TN: 'Tunisia', EG: 'Egypt', SN: 'Senegal', CI: 'Ivory Coast',
  GH: 'Ghana', KE: 'Kenya', TZ: 'Tanzania', RW: 'Rwanda', ET: 'Ethiopia',
  ZA: 'South Africa', MU: 'Mauritius', MG: 'Madagascar', CM: 'Cameroon',
  CG: 'Republic of Congo', CD: 'DR Congo', NG: 'Nigeria', AO: 'Angola',
  TH: 'Thailand', VN: 'Vietnam', JP: 'Japan', ID: 'Indonesia', KG: 'Kyrgyzstan',
  UZ: 'Uzbekistan', KH: 'Cambodia', LK: 'Sri Lanka', PH: 'Philippines',
  MY: 'Malaysia', SG: 'Singapore', MM: 'Myanmar', NP: 'Nepal',
  IN: 'India', KZ: 'Kazakhstan',
  MX: 'Mexico', CO: 'Colombia', PE: 'Peru', EC: 'Ecuador', BO: 'Bolivia',
  PY: 'Paraguay', UY: 'Uruguay', GT: 'Guatemala', CR: 'Costa Rica',
  PA: 'Panama', CU: 'Cuba', DO: 'Dominican Republic', BR: 'Brazil',
  AR: 'Argentina', CL: 'Chile',
  JO: 'Jordan', AE: 'United Arab Emirates', OM: 'Oman',
};

function conflictToScore(incidents: number, fatalities: number): number {
  if (incidents === 0) return 95;
  if (fatalities >= 200) return 10;
  if (fatalities >= 50) return 30;
  if (fatalities >= 10) return 55;
  if (fatalities >= 1) return 75;
  // Incidents sans morts déclarés
  if (incidents >= 20) return 65;
  if (incidents >= 5) return 78;
  return 88;
}

export async function getACLEDScore(
  countryCode: string,
  _acledName: string
): Promise<ServiceResult<{ score: number; incidents: number; fatalities: number }>> {
  const countryName = UCDP_COUNTRY_MAP[countryCode];
  if (!countryName) {
    const score = CONFLICT_STATIC[countryCode] ?? 50;
    return { data: { score, incidents: 0, fatalities: 0 }, source: 'fallback' };
  }

  const key = buildCacheKey('ucdp', countryCode);
  try {
    const { data, fromCache } = await withCache(
      key,
      async () => {
        const year = new Date().getFullYear();
        const today = new Date().toISOString().split('T')[0];
        const t0 = Date.now();

        const res = await axios.get('https://ucdpapi.pcr.uu.se/api/gedevents/23.1', {
          params: { pagesize: 200, Country: countryName, StartDate: `${year}-01-01`, EndDate: today },
          timeout: 6000,
        });

        logger.api('UCDP', countryCode, Date.now() - t0, false);

        const events = (res.data.Result ?? []) as Array<{
          deaths_a?: number; deaths_b?: number;
          deaths_civilians?: number; deaths_unknown?: number;
        }>;

        const totalFatalities = events.reduce(
          (s, e) => s + (e.deaths_a ?? 0) + (e.deaths_b ?? 0) + (e.deaths_civilians ?? 0) + (e.deaths_unknown ?? 0),
          0
        );
        return { count: events.length, fatalities: totalFatalities };
      },
      21600,
      'ucdp',
    );

    if (fromCache) logger.api('UCDP', countryCode, 0, true);
    return {
      data: { score: conflictToScore(data.count, data.fatalities), incidents: data.count, fatalities: data.fatalities },
      source: 'live',
    };
  } catch {
    const score = CONFLICT_STATIC[countryCode] ?? 50;
    logger.warn('UCDP', `API error, using static score (${score}) for ${countryCode}`);
    return { data: { score, incidents: 0, fatalities: 0 }, source: 'fallback' };
  }
}
