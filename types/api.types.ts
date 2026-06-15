export interface ServiceResult<T> {
  data: T;
  source: 'live' | 'fallback' | 'static';
  error?: string;
}

export interface MEAEAlert {
  country: string;
  level: 1 | 2 | 3 | 4;
  description: string;
  updatedAt: string;
}

export interface ACLEDResult {
  countryCode: string;
  incidentCount: number;
  fatalitiesTotal: number;
  lastIncidentDate: string;
}

export interface PerplexityGeoAnalysis {
  stabilityScore: number;
  summary: string;
  mainRisks: string[];
  recentEvents: string[];
  trend: 'improving' | 'stable' | 'deteriorating';
}

/**
 * PREMIUM-GUIDE-001C — Faits terrain frais ramenés par Perplexity (sonar-pro) pour
 * alimenter le guide pays premium. Distinct de PerplexityGeoAnalysis (qui sert le
 * scoring) : ici on veut des faits exploitables par un guide (où se baser, quoi éviter,
 * arnaques, habitudes locales), pas un score. Tous les tableaux peuvent être vides
 * (fallback propre) — le guide Claude dégrade alors vers du conditionnel.
 */
export interface PerplexityCountryFacts {
  /** Villes/quartiers/régions où un voyageur a intérêt à se baser. */
  whereToStay: string[];
  /** Zones ou situations à éviter (sécurité spatiale, contextes). */
  zonesToAvoid: string[];
  /** Arnaques fréquentes connues pour cette destination. */
  commonScams: string[];
  /** Erreurs classiques que font les voyageurs ici. */
  classicMistakes: string[];
  /** Habitudes / codes de comportement locaux utiles à connaître. */
  localCustoms: string[];
  /** Conseils terrain divers, concrets. */
  fieldTips: string[];
}

export interface FrankfurterData {
  currentRate: number;
  historicalRate: number;
  variation: number;
}

export interface NumbeoData {
  city: string;
  country: string;
  costOfLivingIndex: number;
  mealCheap: number;
  hotelAvg: number;
}
