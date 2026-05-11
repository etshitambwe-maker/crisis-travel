import { NextResponse } from 'next/server';
import { WIKI_NAME } from '@/lib/utils/countryPhoto';

// Cache serveur en mémoire (process lifetime)
const _cache: Record<string, string> = {};

const PICSUM_SEEDS: Record<string, number> = {
  PT: 1018, GE: 167,  AL: 338,  RS: 432,  BA: 271,
  MD: 509,  MK: 684,  AM: 823,  TR: 122,  ME: 447,
  XK: 563,  GR: 28,   HR: 91,   HU: 374,  MA: 175,
  TN: 230,  EG: 314,  SN: 719,  CI: 834,  GH: 612,
  KE: 149,  TZ: 203,  RW: 567,  ET: 741,  ZA: 62,
  MU: 44,   MG: 881,  CM: 729,  CG: 652,  CD: 498,
  NG: 387,  AO: 534,  TH: 13,   VN: 87,   JP: 3,
  ID: 56,   KG: 894,  UZ: 776,  KH: 196,  LK: 77,
  PH: 38,   MY: 142,  SG: 248,  MM: 633,  NP: 21,
  IN: 9,    KZ: 712,  MX: 101,  CO: 243,  PE: 48,
  EC: 319,  BO: 455,  PY: 628,  UY: 537,  GT: 682,
  CR: 159,  PA: 374,  CU: 185,  DO: 72,   BR: 29,
  AR: 64,   CL: 117,  JO: 260,  AE: 188,  OM: 342,
};

interface Props {
  params: Promise<{ code: string }>;
}

export async function GET(_req: Request, { params }: Props): Promise<NextResponse> {
  const { code } = await params;
  const upper = code.toUpperCase();

  if (_cache[upper]) {
    return NextResponse.json({ url: _cache[upper] });
  }

  const wikiName = WIKI_NAME[upper];
  if (wikiName) {
    try {
      const res = await fetch(
        `https://en.wikipedia.org/api/rest_v1/page/summary/${wikiName}`,
        {
          headers: { 'Api-User-Agent': 'CrisisTravel/1.0 (contact@crisis-travel.app)' },
          next: { revalidate: 86400 },
        }
      );
      if (res.ok) {
        const data = await res.json() as { thumbnail?: { source: string }; originalimage?: { source: string } };
        const src = data?.thumbnail?.source ?? data?.originalimage?.source;
        if (src) {
          const absolute = src.startsWith('//') ? `https:${src}` : src;
          const resized = absolute.replace(/\/\d+px-/, '/800px-');
          _cache[upper] = resized;
          return NextResponse.json({ url: resized });
        }
      }
    } catch { /* fall through to picsum */ }
  }

  const seed = PICSUM_SEEDS[upper] ?? 15;
  const fallback = `https://picsum.photos/seed/${seed}/800/450`;
  _cache[upper] = fallback;
  return NextResponse.json({ url: fallback });
}
