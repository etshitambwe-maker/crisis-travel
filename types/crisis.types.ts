export interface UserProfile {
  departureCountry: string;
  budget: number;
  duration: number;
  period: string;
  travelType: 'solo' | 'couple' | 'family' | 'nomad';
  mode: 'standard' | 'bunker' | 'budget_crisis';
  excludedContinents?: string[];
}

export interface SubScore {
  value: number;
  source: 'live' | 'fallback' | 'partial';
  confidence: 'high' | 'medium' | 'low';
  details: Record<string, number | string>;
}

export interface CrisisScore {
  country: string;
  countryCode: string;
  total: number;
  security: SubScore;
  geopolitical: SubScore;
  budget: SubScore;
  practicality: SubScore;
  status: 'ideal' | 'recommended' | 'possible' | 'discouraged';
  confidence: 'high' | 'medium' | 'low';
  calculatedAt: string;
  opportunities?: string[];
}

export interface OpportunityWindow {
  countryCode: string;
  country: string;
  type: 'currency' | 'security_improved' | 'cheap_flights' | 'jackpot';
  explanation: string;
  estimatedSaving: number;
  score: number;
}

export interface AnalyzeRequest {
  profile: UserProfile;
  targetCountries?: string[];
}

export interface AnalyzeResponse {
  results: CrisisScore[];
  topDestinations: CrisisScore[];
  opportunities: OpportunityWindow[];
  meta: {
    analyzedCountries: number;
    duration: number;
    cacheHitRate: number;
    /** true si le scoring a été interrompu par le budget de temps (GOAL-032) : résultats partiels mais exploitables. */
    partial?: boolean;
  };
}

export function clamp(value: number, min = 0, max = 100): number {
  return Math.min(max, Math.max(min, value));
}

export function getScoreStatus(score: number): CrisisScore['status'] {
  if (score >= 80) return 'ideal';
  if (score >= 60) return 'recommended';
  if (score >= 40) return 'possible';
  return 'discouraged';
}

export function getScoreColor(score: number): string {
  if (score >= 80) return '#00e5a0';
  if (score >= 60) return '#ffd23f';
  if (score >= 40) return '#ff8c42';
  return '#ff4d2e';
}

export function getScoreLabel(score: number): string {
  if (score >= 80) return 'IDÉALE';
  if (score >= 60) return 'RECOMMANDÉE';
  if (score >= 40) return 'POSSIBLE';
  return 'DÉCONSEILLÉE';
}
