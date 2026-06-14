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
  /**
   * PREMIUM-GUIDE-001A — Risques terrain actuels remontés par Perplexity (champ
   * `mainRisks`), conservés ici au lieu d'être jetés par le scoring. Champ
   * first-class optionnel (et non enfoui dans `geopolitical.details`, typé
   * `Record<string, number | string>` qui ne peut pas porter de `string[]`).
   * Alimente le bloc « guide » premium ; absent/[] si Perplexity n'est pas live.
   */
  liveRisks?: string[];
  /**
   * PREMIUM-GUIDE-001A — Événements récents à surveiller remontés par Perplexity
   * (champ `recentEvents`). Même logique que `liveRisks`.
   */
  recentEvents?: string[];
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
    /** Quota analyses — absent si non connecté ou Supabase indisponible (ne jamais inventer côté client). */
    quota?: {
      remaining: number;
      used: number;
      limit: number;
      isPremium: boolean;
    };
  };
}

// ── Itinerary types (ITINERARY-002) ─────────────────────────────────────────

export type BudgetLevel = 'low' | 'medium' | 'high' | 'luxury';

export interface ItineraryBudget {
  amount: number;
  currency: string;
  level: BudgetLevel;
}

export interface ItineraryDay {
  day: number;
  title: string;
  summary: string;
  morning: string;
  afternoon: string;
  evening: string;
  estimatedBudget: string;
  safetyNote: string;
}

export interface ItineraryResult {
  countryCode: string;
  countryName: string;
  cityOrRegion?: string;
  durationDays: number;
  budget: ItineraryBudget;
  days: ItineraryDay[];
  globalAdvice: string[];
  safetyDisclaimer: string;
  officialSourceReminder: string;
  generatedAt: string;
  /**
   * PREMIUM-GUIDE-001B — Texte de guide narratif (le voyageur lit un parcours
   * conseillé comme si un guide humain lui parlait : fil conducteur, organisation
   * des premiers jours, rythme, étapes à ne pas charger, points de vigilance,
   * conseil final). Devient le rendu PRINCIPAL de l'itinéraire ; le tableau `days`
   * structuré reste la source d'autorité (PDF, compatibilité, fallback) et passe en
   * détail secondaire repliable. Champ first-class OPTIONNEL : son absence reste
   * compatible — `ItineraryBlock` retombe alors sur l'ancien rendu jour/jour, sans
   * crash. S'appuie sur les `days` déjà générés : AUCUN appel API supplémentaire.
   */
  narrativeText?: string;
  /**
   * PREMIUM-GUIDE-001B-timeout — `true` UNIQUEMENT pour le repli déterministe
   * (buildItineraryFallback), produit quand la génération Claude échoue ou time-out.
   * Permet à ItineraryBlock d'afficher un état honnête (« la génération a pris trop
   * de temps » + Réessayer) AU LIEU des fausses cartes « À planifier selon vos
   * préférences » qui se faisaient passer pour un itinéraire premium. Champ
   * optionnel : absent (ou false) = vrai itinéraire généré. Le PDF l'ignore (Zod strip).
   */
  isFallback?: boolean;
}

export interface ItineraryRiskContext {
  meaeLevel: 1 | 2 | 3 | 4;
  source: 'static' | 'live';
  lastUpdated?: string;
}

export interface ItineraryRequest {
  countryCode?: string;
  countryName?: string;
  cityOrRegion?: string;
  from?: string;
  to?: string;
  budget?: number;
  currency?: string;
  travelers?: number;
  travelType?: 'solo' | 'couple' | 'family' | 'nomad';
  preferences?: string[];
  riskContext?: ItineraryRiskContext;
}

export interface ItineraryApiResponse {
  itinerary: ItineraryResult;
  meta: {
    premiumOnly: true;
    source: 'ai';
    officialDataMode: 'static';
  };
}

// ── Helpers ─────────────────────────────────────────────────────────────────

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
