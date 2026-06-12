import { VISA_REQUIREMENTS, FLIGHT_CONNECTIONS } from '@/lib/data/visa-requirements';
import type { SubScore, UserProfile } from '@/types/crisis.types';
import { clamp } from '@/types/crisis.types';

function buildSubScore(
  value: number,
  sources: Array<'live' | 'fallback'>,
  details: Record<string, number | string>
): SubScore {
  const fallbackCount = sources.filter((s) => s === 'fallback').length;
  return {
    value: clamp(Math.round(value)),
    source: fallbackCount === 0 ? 'live' : fallbackCount === sources.length ? 'fallback' : 'partial',
    confidence: fallbackCount === 0 ? 'high' : fallbackCount <= 1 ? 'medium' : 'low',
    details,
  };
}

/**
 * Modificateur praticité selon le profil voyageur (ANALYZE-PROFILE-001).
 *
 * Déterministe, sans appel réseau : la praticité d'un séjour dépend du profil.
 * Une famille (enfants) est plus sensible aux frictions logistiques — visa
 * complexe, vol long ou indirect, accès santé faible — qu'un solo ou un nomade.
 * On applique donc un malus pondéré par la sévérité réelle de chaque friction
 * (lue dans les `details` déjà calculés), borné pour rester proportionné.
 *
 * Retour : delta en points (négatif = pénalité) à ajouter à la valeur de base.
 * `solo`/`nomad` → 0 (neutre). `couple` → moitié du malus famille.
 */
function profilePracticalityModifier(
  travelType: UserProfile['travelType'] | undefined,
  details: Record<string, number | string>,
): number {
  if (travelType !== 'family' && travelType !== 'couple') return 0;

  const visaScore   = Number(details.visaScore ?? 70);
  const flightScore = Number(details.flightScore ?? 65);
  const directFlight = Number(details.directFlight ?? 0) === 1;

  let penalty = 0;
  // Friction visa : plus le visa est contraignant (score bas), plus le malus.
  if (visaScore < 70) penalty += (70 - visaScore) * 0.12;
  // Friction aérienne : vol mal connecté pénalise davantage avec enfants.
  if (flightScore < 70) penalty += (70 - flightScore) * 0.10;
  // Absence de vol direct depuis CDG : pénalité forfaitaire (escales + enfants).
  if (!directFlight) penalty += 4;

  // Borne le malus pour rester proportionné (max -12 pts famille).
  penalty = Math.min(penalty, 12);

  // Couple : moitié de la sensibilité famille.
  return travelType === 'couple' ? -penalty / 2 : -penalty;
}

export function calculatePracticalityScore(
  countryCode: string,
  profile?: Pick<UserProfile, 'travelType'>,
): SubScore {
  const visa = VISA_REQUIREMENTS[countryCode];
  const flight = FLIGHT_CONNECTIONS[countryCode];

  if (!visa && !flight) {
    return buildSubScore(65, ['fallback'], {
      note: 'Données praticité non disponibles pour ce pays',
    });
  }

  const visaScore = visa?.score ?? 70;
  const flightScore = flight?.score ?? 65;

  // Praticité = Visa 40% · Vols 35% · Santé/infra 25% (base neutre en attendant Teleport)
  const baseValue = visaScore * 0.40 + flightScore * 0.35 + 65 * 0.25;

  const baseDetails = {
    visaType: visa?.type ?? 'unknown',
    visaScore,
    flightScore,
    directFlight: flight?.directFromCDG ? 1 : 0,
    processingDays: visa?.processingDays ?? 0,
    approxDurationH: flight?.approxDurationH ?? 0,
    visaNotes: visa?.notes ?? '',
  };

  // Ajustement profil (ANALYZE-PROFILE-001) : family/couple plus sensibles aux
  // frictions logistiques. solo/nomad/absent → 0 (comportement historique préservé).
  const modifier = profilePracticalityModifier(profile?.travelType, baseDetails);

  return buildSubScore(baseValue + modifier, ['live'], {
    ...baseDetails,
    profileModifier: modifier,
    travelType: profile?.travelType ?? 'unspecified',
  });
}
