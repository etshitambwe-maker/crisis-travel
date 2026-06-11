import { meaeLevelToScore } from '@/lib/utils/normalize';
import type { ServiceResult } from '@/types/api.types';

// Date de la dernière vérification manuelle des niveaux MEAE (France Diplomatie).
// À mettre à jour à chaque révision trimestrielle de la table ci-dessous.
export const MEAE_LAST_UPDATED = '2026-06-10';

// URL officielle : https://www.diplomatie.gouv.fr/fr/conseils-aux-voyageurs/conseils-par-pays-destination/
// Niveaux MEAE (France Diplomatie) — intégrés manuellement, mis à jour chaque trimestre
// 1 = Vigilance normale | 2 = Vigilance renforcée | 3 = Déconseillé sauf raison impérative | 4 = Déconseillé
export const MEAE_LEVELS: Record<string, 1 | 2 | 3 | 4> = {
  // Europe
  PT: 1, GE: 2, AL: 2, RS: 2, BA: 2, MD: 2, MK: 2, AM: 2,
  TR: 2, ME: 1, XK: 2, GR: 1, HR: 1, HU: 1,
  // Afrique
  MA: 2, TN: 2, EG: 3, SN: 2, CI: 2, GH: 2, KE: 3, TZ: 2,
  RW: 2, ET: 4, ZA: 2, MU: 1, MG: 2, CM: 3, CG: 3, CD: 4,
  NG: 4, AO: 3,
  // Asie
  TH: 2, VN: 1, JP: 1, ID: 2, KG: 2, UZ: 2, KH: 2, LK: 2,
  PH: 2, MY: 1, SG: 1, MM: 4, NP: 2, IN: 2, KZ: 2,
  // Amériques
  MX: 3, CO: 3, PE: 2, EC: 3, BO: 2, PY: 2, UY: 1, GT: 3,
  CR: 1, PA: 2, CU: 2, DO: 2, BR: 3, AR: 2, CL: 2,
  // Moyen-Orient
  JO: 2, AE: 1, OM: 2,
};

export async function getMEAEScore(
  countryCode: string,
  _slug: string
): Promise<ServiceResult<{ score: number; level: number }>> {
  const level = MEAE_LEVELS[countryCode] ?? 2;
  return { data: { score: meaeLevelToScore(level), level }, source: 'static' };
}
