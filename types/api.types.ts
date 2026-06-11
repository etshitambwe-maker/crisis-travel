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
