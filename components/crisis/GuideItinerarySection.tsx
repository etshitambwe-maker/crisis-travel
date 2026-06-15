'use client';
// ─────────────────────────────────────────────────────────────────────────────
// GuideItinerarySection (GUIDE-V1 — NO CARDS)
//
// Section premium « parcours conseillé » sous forme de TEXTE de guide. Elle remplace
// définitivement l'ancienne section à cartes jour/matin/après-midi/soir. Cette section
// ne connaît QUE deux états visibles :
//   • succès  → narrativeText rendu via NarrativeRenderer (texte guide uniquement) ;
//   • échec   → message honnête + bouton Réessayer.
//
// Elle n'accède JAMAIS à `itinerary.days` pour produire du rendu : même si l'API ou le
// cache renvoient encore un tableau `days` (legacy), il est totalement ignoré à l'écran.
// Aucune DayCard, aucun slot matin/après-midi/soir, aucun « À planifier » ne peut donc
// apparaître ici, par construction.
// ─────────────────────────────────────────────────────────────────────────────
import type { ItineraryResult } from '@/types/crisis.types';
import { PdfExportButton } from './PdfExportButton';
import { NarrativeRenderer } from './NarrativeRenderer';

// Marqueurs de l'ANCIEN fallback déterministe (buildItineraryFallback côté service) :
// un résultat legacy mis en cache AVANT le flag isFallback peut ressortir SANS ce flag.
// On le reconnaît à ces phrases (qui ne vivent que dans l'ancien fallback) pour le traiter
// comme un échec honnête plutôt que de risquer d'afficher quoi que ce soit de trompeur.
const LEGACY_FALLBACK_MARKERS = [
  'Itinéraire temporairement indisponible',
  'À planifier selon vos préférences',
  'Estimation non disponible',
] as const;

/**
 * Vrai si l'itinéraire doit être traité comme un ÉCHEC honnête plutôt que comme un
 * parcours réel. Trois sources, dans cet ordre :
 *   1. flag first-class `isFallback` (générations récentes) ;
 *   2. absence de narrativeText exploitable (GUIDE-V1 : le texte EST le livrable —
 *      sans lui, il n'y a rien de premium à montrer) ;
 *   3. marqueurs de l'ancien fallback présents dans les days legacy (défense en profondeur).
 * Helper PUR : testable, sans état ni effet.
 */
export function isFallbackItinerary(
  it: Pick<ItineraryResult, 'isFallback' | 'days' | 'narrativeText'> | null | undefined,
): boolean {
  if (!it) return true;
  if (it.isFallback) return true;
  const hasNarrative = typeof it.narrativeText === 'string' && it.narrativeText.trim().length > 0;
  if (!hasNarrative) return true;
  const days = Array.isArray(it.days) ? it.days : [];
  return days.some((d) => {
    const haystack = `${d.summary ?? ''} ${d.morning ?? ''} ${d.afternoon ?? ''} ${d.evening ?? ''} ${d.estimatedBudget ?? ''}`;
    return LEGACY_FALLBACK_MARKERS.some((marker) => haystack.includes(marker));
  });
}

// Disclaimers — toujours visibles dans les DEUX états (sécurité non négociable).
function Disclaimers({ itinerary }: { itinerary: ItineraryResult }) {
  return (
    <>
      <div
        data-testid="itinerary-safety-disclaimer"
        style={{
          marginTop: 14, padding: '10px 14px',
          background: 'var(--ctv3-ink-900)', border: '1px solid var(--ctv3-line)',
          borderLeft: '2px solid var(--ctv3-reco)',
        }}
      >
        <p className="ctv3-mono" style={{ fontSize: 10, color: 'var(--ctv3-faint)', lineHeight: 1.55, margin: 0 }}>
          ⚠ {itinerary.safetyDisclaimer}
        </p>
      </div>
      <div
        data-testid="itinerary-official-reminder"
        style={{
          marginTop: 8, padding: '10px 14px',
          background: 'var(--ctv3-ink-900)', border: '1px solid var(--ctv3-line)',
        }}
      >
        <p className="ctv3-mono" style={{ fontSize: 10, color: 'var(--ctv3-faint)', lineHeight: 1.55, margin: 0 }}>
          {itinerary.officialSourceReminder}
        </p>
      </div>
    </>
  );
}

export interface GuideItinerarySectionProps {
  itinerary: ItineraryResult;
  onRetry: () => void;
  pdf: {
    countryCode: string;
    countryName: string;
    profile: { budget?: number; duration?: number; travelType?: 'solo' | 'couple' | 'family' | 'nomad'; from?: string; to?: string };
  };
}

export function GuideItinerarySection({ itinerary, onRetry, pdf }: GuideItinerarySectionProps) {
  // ── État ÉCHEC — message honnête + Réessayer (jamais de carte, jamais de faux parcours) ──
  if (isFallbackItinerary(itinerary)) {
    return (
      <div data-testid="itinerary-result-fallback">
        <div
          style={{
            background: 'var(--ctv3-ink-900)', border: '1px solid var(--ctv3-line-bright)',
            borderLeft: '2px solid var(--ctv3-reco)', padding: '16px 18px',
          }}
        >
          <div className="ctv3-mono" style={{ fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--ctv3-reco)', marginBottom: 8 }}>
            Génération incomplète
          </div>
          <p className="ctv3-serif" style={{ fontSize: 14, color: 'var(--ctv3-paper)', lineHeight: 1.55, margin: '0 0 6px' }}>
            La génération complète de votre parcours a pris trop de temps ou n&apos;a pas pu aboutir.
          </p>
          <p className="ctv3-serif" style={{ fontSize: 13, color: 'var(--ctv3-muted)', lineHeight: 1.5, margin: '0 0 14px' }}>
            Ce n&apos;est pas un parcours définitif. Relancez la génération — elle aboutit généralement à la seconde tentative.
          </p>
          <button
            data-testid="itinerary-fallback-retry"
            onClick={onRetry}
            className="ctv3-mono"
            style={{
              padding: '10px 18px', cursor: 'pointer',
              background: 'var(--ctv3-blue)', border: 'none', color: '#fff',
              fontSize: 11, letterSpacing: '0.12em', fontWeight: 700, textTransform: 'uppercase',
            }}
          >
            Réessayer →
          </button>
        </div>
        <Disclaimers itinerary={itinerary} />
      </div>
    );
  }

  // ── État SUCCÈS — texte de guide UNIQUEMENT (narrativeText), puis disclaimers/PDF ──
  // `days` est délibérément ignoré ici : aucune carte ne peut être rendue.
  return (
    <div data-testid="itinerary-result">
      {/* Meta strip — durée / budget (aucune notion de jour détaillé) */}
      <div
        className="ctv3-mono"
        style={{
          display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16, rowGap: 6,
          fontSize: 10, letterSpacing: '0.1em', color: 'var(--ctv3-faint)', textTransform: 'uppercase',
        }}
      >
        <span>{itinerary.durationDays} jour{itinerary.durationDays > 1 ? 's' : ''}</span>
        {itinerary.budget.amount > 0 && (
          <>
            <span style={{ width: 12, height: 1, background: 'var(--ctv3-line)', alignSelf: 'center' }} />
            <span>Budget : {itinerary.budget.amount} {itinerary.budget.currency}</span>
          </>
        )}
        <span style={{ width: 12, height: 1, background: 'var(--ctv3-line)', alignSelf: 'center' }} />
        <span style={{ color: 'var(--ctv3-faint)' }}>Données officielles statiques intégrées</span>
      </div>

      {/* Texte de guide — le seul contenu de parcours rendu */}
      <div data-testid="itinerary-narrative">
        <NarrativeRenderer narrative={itinerary.narrativeText as string} />
      </div>

      <Disclaimers itinerary={itinerary} />

      {/* Export PDF — réutilise l'itinéraire déjà généré, aucun appel Claude supplémentaire */}
      <div data-testid="itinerary-pdf-export" style={{ marginTop: 14 }}>
        <PdfExportButton
          countryCode={pdf.countryCode}
          countryName={pdf.countryName}
          profile={pdf.profile}
          itinerary={itinerary}
        />
      </div>

      {/* Regénérer */}
      <button
        onClick={onRetry}
        className="ctv3-mono"
        style={{
          marginTop: 10, padding: '9px 16px', cursor: 'pointer',
          background: 'none', border: '1px solid var(--ctv3-line)',
          color: 'var(--ctv3-muted)', fontSize: 10, letterSpacing: '0.1em',
          fontWeight: 700, textTransform: 'uppercase',
        }}
      >
        Regénérer le parcours
      </button>
    </div>
  );
}
