import { VISA_REQUIREMENTS, FLIGHT_CONNECTIONS } from '@/lib/data/visa-requirements';
import type { SubScore } from '@/types/crisis.types';
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

export function calculatePracticalityScore(countryCode: string): SubScore {
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
  const value = visaScore * 0.40 + flightScore * 0.35 + 65 * 0.25;

  return buildSubScore(value, ['live'], {
    visaType: visa?.type ?? 'unknown',
    visaScore,
    flightScore,
    directFlight: flight?.directFromCDG ? 1 : 0,
    processingDays: visa?.processingDays ?? 0,
    approxDurationH: flight?.approxDurationH ?? 0,
    visaNotes: visa?.notes ?? '',
  });
}
