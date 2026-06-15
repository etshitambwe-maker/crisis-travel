/**
 * TRIP-CONTEXT-001 — Persistance du contexte voyage utilisateur.
 *
 * Utilitaire front-only (sessionStorage). Garde le profil saisi dans TravelForm
 * et les snapshots résultats pour que toutes les surfaces premium (itinéraire,
 * guide pays, PDF) reçoivent le vrai profil utilisateur au lieu des hardcodes
 * (budget:1500, duration:7, travelType:'solo').
 *
 * Contraintes :
 * - Aucun backend, aucune dépendance Supabase.
 * - Inaccessible au Server Component (SSR) : passer les params via URL pour ça.
 * - Garde typeof window !== 'undefined' sur toutes les ops.
 * - Fallback sûr si JSON invalide ou sessionStorage absent.
 */

import type { CrisisScore } from '@/types/crisis.types';

const STORAGE_KEY = 'tripContext';

export interface TripContext {
  // Destination — optionnel si "Surprends-moi"
  countryCode?: string;
  countryName?: string;

  // Profil obligatoire (source : TravelForm)
  budget: number;
  duration: number;
  travelType: 'solo' | 'couple' | 'family' | 'nomad';
  mode: 'standard' | 'bunker' | 'budget_crisis';

  // Champs optionnels
  travelers?: number;
  from?: string;   // YYYY-MM-DD
  to?: string;     // YYYY-MM-DD
  departureCountry?: string;
  interests?: string[];

  // Snapshots résultats (écrit après /api/analyze)
  scoreSnapshot?: CrisisScore;
  narrativeSnapshot?: string;

  // Métadonnées
  createdAt: string;
  source: 'form' | 'url';
}

/** Déduit le nombre de voyageurs depuis travelType. */
function inferTravelers(travelType: TripContext['travelType']): number {
  return travelType === 'couple' || travelType === 'family' ? 2 : 1;
}

/** Écrit (ou met à jour) le TripContext dans sessionStorage. */
export function saveTripContext(ctx: TripContext): void {
  if (typeof window === 'undefined') return;
  try {
    // Normalisation : travelers déduit si absent
    const normalized: TripContext = {
      ...ctx,
      travelers: ctx.travelers ?? inferTravelers(ctx.travelType),
      departureCountry: ctx.departureCountry ?? 'FR',
    };
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  } catch {
    // sessionStorage plein ou désactivé — on continue sans crasher
  }
}

/** Lit le TripContext depuis sessionStorage. Retourne null si absent ou corrompu. */
export function loadTripContext(): TripContext | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!isValidTripContext(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** Met à jour des champs du TripContext existant (merge superficiel). */
export function mergeTripContext(partial: Partial<TripContext>): void {
  const existing = loadTripContext();
  if (!existing) return;
  saveTripContext({ ...existing, ...partial });
}

/** Supprime le TripContext de sessionStorage. */
export function clearTripContext(): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // rien
  }
}

/** Garde de type minimale — vérifie les champs obligatoires. */
function isValidTripContext(v: unknown): v is TripContext {
  if (!v || typeof v !== 'object') return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.budget === 'number' &&
    typeof o.duration === 'number' &&
    typeof o.travelType === 'string' &&
    ['solo', 'couple', 'family', 'nomad'].includes(o.travelType as string) &&
    typeof o.mode === 'string' &&
    ['standard', 'bunker', 'budget_crisis'].includes(o.mode as string) &&
    typeof o.createdAt === 'string' &&
    (o.source === 'form' || o.source === 'url')
  );
}

/**
 * Construit un TripContext minimal depuis les URL params de /results.
 * Utilisé en fallback si sessionStorage est absent lors d'une navigation directe.
 * Accepte URLSearchParams ou ReadonlyURLSearchParams (même API .get).
 */
export function tripContextFromParams(params: { get: (key: string) => string | null }): TripContext | null {
  const budget = parseInt(params.get('budget') ?? '', 10);
  const duration = parseInt(params.get('duration') ?? '', 10);
  const travelType = params.get('travelType') as TripContext['travelType'] | null;
  const mode = params.get('mode') as TripContext['mode'] | null;

  if (!budget || !duration || !travelType || !mode) return null;
  if (!['solo', 'couple', 'family', 'nomad'].includes(travelType)) return null;
  if (!['standard', 'bunker', 'budget_crisis'].includes(mode)) return null;

  return {
    budget,
    duration,
    travelType,
    mode,
    from: params.get('from') ?? undefined,
    to: params.get('to') ?? undefined,
    departureCountry: 'FR',
    travelers: inferTravelers(travelType),
    createdAt: new Date().toISOString(),
    source: 'url',
  };
}
