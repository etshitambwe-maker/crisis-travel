import { meaeLevelToScore } from '@/lib/utils/normalize';
import type { ServiceResult } from '@/types/api.types';

// Niveaux State Dept maintenus manuellement — mise à jour trimestrielle
const STATE_DEPT_LEVELS: Record<string, 1 | 2 | 3 | 4> = {
  TH: 1, JP: 1, PT: 1, VN: 1, KH: 1, ID: 2, PH: 2,
  GE: 2, MA: 2, MX: 2, TR: 2, EG: 2, TN: 2, CO: 2,
  AL: 1, RS: 1, BA: 2, KG: 2, MD: 2, AM: 2, UZ: 2,
  MK: 1, EC: 3, LK: 2, PE: 2,
};

export async function getStateDeptScore(
  countryCode: string
): Promise<ServiceResult<{ score: number; level: number }>> {
  const level = STATE_DEPT_LEVELS[countryCode] ?? 2;
  return { data: { score: meaeLevelToScore(level), level }, source: 'live' };
}
