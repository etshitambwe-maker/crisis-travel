'use client';
import { useState, useEffect } from 'react';
import type { CrisisScore } from '@/types/crisis.types';
import { PdfExportButton } from './PdfExportButton';
import { ItineraryBlock } from './ItineraryBlock';
import { loadTripContext } from '@/lib/utils/tripContext';

/**
 * PREMIUM-EXPERIENCE-001 (D) — Actions premium réelles du bloc « Aller plus loin ».
 * ─────────────────────────────────────────────────────────────────────────────
 * Rendu UNIQUEMENT pour un utilisateur premium (en children du PremiumGate unifié
 * de la page destination). Aucun upsell ici : ce composant n'affiche que les vraies
 * actions disponibles, sous la synthèse IA complète :
 *
 *   1. « Préparer mon itinéraire » → affiche ItineraryBlock IN-PLACE, ciblé sur le
 *      pays de la fiche (countryCode/countryName + meaeLevel transmis). L'itinéraire
 *      est généré ON-DEMAND par ItineraryBlock (clic « Générer » → /api/itinerary),
 *      jamais au chargement ni en SSR. Avant ce GOAL, le bouton renvoyait vers une
 *      analyse globale qui ciblait ranked[0] (ex. Portugal) et perdait le pays
 *      consulté — désormais l'itinéraire reste contextualisé à la fiche.
 *   2. « Exporter en PDF » → PdfExportButton inchangé (réutilise scoreSnapshot +
 *      narrative déjà calculés en SSR ; pas de second appel Claude).
 */

interface Props {
  countryCode: string;
  countryName: string;
  scoreSnapshot: CrisisScore;
  narrative: string;
  /** Niveau MEAE de la fiche (1–4) — transmis à l'itinéraire pour les notes de sécurité. */
  meaeLevel?: 1 | 2 | 3 | 4;
  /**
   * TRIP-CONTEXT-001 — Profil SSR (depuis searchParams de la page destination).
   * Utilisé comme source initiale ; le TripContext sessionStorage prend le dessus si présent.
   */
  ssrProfile?: {
    budget?: number;
    duration?: number;
    travelType?: 'solo' | 'couple' | 'family' | 'nomad';
    from?: string;
    to?: string;
  };
}

export function PremiumActions({ countryCode, countryName, scoreSnapshot, narrative, meaeLevel, ssrProfile }: Props) {
  const [showItinerary, setShowItinerary] = useState(false);

  // TRIP-CONTEXT-001 : lit le TripContext depuis sessionStorage (client-only).
  // ssrProfile sert de fallback quand le contexte n'est pas en sessionStorage
  // (ex. accès direct à la fiche destination sans analyse préalable).
  const [tripProfile, setTripProfile] = useState(ssrProfile);

  useEffect(() => {
    const ctx = loadTripContext();
    if (ctx) {
      setTripProfile({
        budget:     ctx.budget,
        duration:   ctx.duration,
        travelType: ctx.travelType,
        from:       ctx.from,
        to:         ctx.to,
      });
    }
  }, []);

  return (
    <div data-testid="premium-actions" style={{ marginTop: 18, paddingTop: 16, borderTop: '1px solid var(--ctv3-line-soft)' }}>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <button
          type="button"
          data-testid="premium-itinerary-btn"
          onClick={() => setShowItinerary((s) => !s)}
          aria-expanded={showItinerary}
          className="ctv3-mono"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 7,
            padding: '11px 16px', cursor: 'pointer',
            background: 'var(--ctv3-blue)', border: 'none', color: '#fff',
            fontSize: 10.5, letterSpacing: '0.12em', fontWeight: 700, textTransform: 'uppercase',
          }}
        >
          Préparer mon itinéraire {showItinerary ? '▲' : '→'}
        </button>

        <PdfExportButton
          countryCode={countryCode}
          countryName={countryName}
          scoreSnapshot={scoreSnapshot}
          narrative={narrative}
          profile={tripProfile}
        />
      </div>

      {/* Itinéraire in-place — ciblé sur le pays de la fiche. Monté seulement après
          clic ; ItineraryBlock reste en état 'idle' (aucun appel réseau) jusqu'à ce
          que l'utilisateur lance la génération depuis son propre bouton. */}
      {showItinerary && (
        <ItineraryBlock
          countryCode={countryCode}
          countryName={countryName}
          travelType={tripProfile?.travelType ?? 'solo'}
          budget={tripProfile?.budget}
          dateFrom={tripProfile?.from}
          dateTo={tripProfile?.to}
          travelers={
            (() => {
              const tt = tripProfile?.travelType;
              return tt === 'couple' || tt === 'family' ? 2 : 1;
            })()
          }
          meaeLevel={meaeLevel}
        />
      )}
    </div>
  );
}
