'use client';
import { useState } from 'react';
import type { ItineraryApiResponse, ItineraryRequest, ItineraryResult } from '@/types/crisis.types';
import { PdfExportButton } from './PdfExportButton';
import { NarrativeRenderer } from './NarrativeRenderer';
import { AuthModal } from '@/components/auth/AuthModal';

// ── Types ─────────────────────────────────────────────────────────────────────

type ItineraryStatus =
  | 'idle'
  | 'loading'
  | 'success'
  | 'error_401'
  | 'error_402'
  | 'error_400'
  | 'error_500';

export interface ItineraryBlockProps {
  /** Top destination from results */
  countryCode?: string;
  countryName?: string;
  /** Search params context */
  dateFrom?: string;
  dateTo?: string;
  budget?: number;
  travelers?: number;
  travelType?: 'solo' | 'couple' | 'family' | 'nomad';
  meaeLevel?: 1 | 2 | 3 | 4;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildRequest(props: ItineraryBlockProps): ItineraryRequest {
  const req: ItineraryRequest = {
    countryCode: props.countryCode,
    countryName: props.countryName,
    travelers: props.travelers ?? 1,
    travelType: props.travelType ?? 'solo',
    preferences: [],
  };
  if (props.budget && props.budget > 0) req.budget = props.budget;
  if (props.dateFrom) req.from = props.dateFrom;
  if (props.dateTo) req.to = props.dateTo;
  if (props.meaeLevel) {
    req.riskContext = { meaeLevel: props.meaeLevel, source: 'static' };
  }
  return req;
}

// Marqueurs de l'ANCIEN fallback déterministe (buildItineraryFallback côté service).
// Un résultat « legacy » mis en cache AVANT le flag isFallback peut ressortir SANS ce
// flag : on le reconnaît à ces phrases, qui ne vivent QUE dans le fallback du service.
// Doit rester rigoureusement synchronisé avec buildItineraryFallback.
const LEGACY_FALLBACK_MARKERS = [
  'Itinéraire temporairement indisponible',
  'À planifier selon vos préférences',
  'Estimation non disponible',
] as const;

/**
 * Vrai si l'itinéraire doit être traité comme un REPLI honnête plutôt que comme un
 * itinéraire premium réel. Deux sources de vérité, dans cet ordre :
 *   1. le flag first-class `isFallback` (générations récentes) ;
 *   2. à défaut, la présence des marqueurs de l'ancien fallback dans les jours — protège
 *      contre les résultats legacy cachés avant l'introduction du flag (PREMIUM-GUIDE-001B
 *      stabilisation). Sans cette détection, un legacy retombait dans la branche
 *      « itinéraire réel » et affichait les fausses cartes « À planifier… ».
 * Helper PUR (aucun état, aucun effet) : testable et réutilisable.
 */
export function isFallbackItinerary(
  it: Pick<ItineraryResult, 'isFallback' | 'days'> | null | undefined,
): boolean {
  if (!it) return false;
  if (it.isFallback) return true;
  const days = Array.isArray(it.days) ? it.days : [];
  return days.some((d) => {
    const haystack = `${d.summary ?? ''} ${d.morning ?? ''} ${d.afternoon ?? ''} ${d.evening ?? ''} ${d.estimatedBudget ?? ''}`;
    return LEGACY_FALLBACK_MARKERS.some((marker) => haystack.includes(marker));
  });
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function ItinerarySkeleton() {
  return (
    <div aria-busy="true" aria-label="Génération de l'itinéraire en cours">
      <style>{`
        @keyframes itinerary-pulse { 0%,100%{opacity:0.4} 50%{opacity:0.8} }
        .itin-skel { animation: itinerary-pulse 1.6s ease-in-out infinite; background: var(--ctv3-ink-750); border-radius: 3px; }
      `}</style>
      <div style={{ marginBottom: 14 }}>
        <div className="ctv3-mono" style={{ fontSize: 10, letterSpacing: '0.18em', color: 'var(--ctv3-muted)', textTransform: 'uppercase', marginBottom: 4 }}>
          Génération en cours…
        </div>
        <div className="ctv3-mono" style={{ fontSize: 9.5, color: 'var(--ctv3-dim)', letterSpacing: '0.04em' }}>
          Génération de votre suggestion d&apos;itinéraire — cela peut prendre quelques secondes.
        </div>
      </div>
      {[1, 2, 3].map((i) => (
        <div key={i} style={{ border: '1px solid var(--ctv3-line)', padding: '14px 16px', marginBottom: 10 }}>
          <div className="itin-skel" style={{ height: 12, width: '40%', marginBottom: 10 }} />
          <div className="itin-skel" style={{ height: 9, width: '80%', marginBottom: 6 }} />
          <div className="itin-skel" style={{ height: 9, width: '65%' }} />
        </div>
      ))}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function ItineraryBlock(props: ItineraryBlockProps) {
  const [status, setStatus] = useState<ItineraryStatus>('idle');
  const [result, setResult] = useState<ItineraryApiResponse | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showAuth, setShowAuth] = useState(false);

  const destination = props.countryName ?? props.countryCode ?? 'cette destination';
  const hasDestination = Boolean(props.countryCode || props.countryName);

  // Source de vérité UNIQUE pour décider repli vs itinéraire réel (PREMIUM-GUIDE-001B
  // stabilisation) : flag isFallback OU marqueurs legacy détectés. Les deux branches de
  // rendu (repli honnête / itinéraire réel) sont strictement exclusives sur cette valeur,
  // donc les fausses cartes « À planifier… » ne peuvent JAMAIS s'afficher comme un parcours.
  const isFallbackResult = isFallbackItinerary(result?.itinerary);

  async function generate() {
    if (status === 'loading') return;
    setStatus('loading');
    setResult(null);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/itinerary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildRequest(props)),
      });

      let json: Record<string, unknown> | null = null;
      try { json = await res.json(); } catch { json = null; }

      if (res.ok && json) {
        setResult(json as unknown as ItineraryApiResponse);
        setStatus('success');
        return;
      }

      if (res.status === 401) { setStatus('error_401'); return; }
      if (res.status === 402) { setStatus('error_402'); return; }
      if (res.status === 400) {
        setErrorMsg((json?.error as string) ?? 'Paramètres invalides.');
        setStatus('error_400');
        return;
      }
      setErrorMsg((json?.error as string) ?? 'Impossible de générer l\'itinéraire pour le moment.');
      setStatus('error_500');
    } catch {
      setErrorMsg('Impossible de contacter le serveur. Vérifiez votre connexion.');
      setStatus('error_500');
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div
      data-testid="itinerary-block"
      // MARQUEUR DE BUILD (PREMIUM-GUIDE-001B stabilisation) : preuve in-DOM que le code
      // de stabilisation est réellement servi. Si la page affiche encore les vieilles
      // cartes « À planifier » MAIS que cet attribut vaut bien « 001B-stab2 », c'est un
      // bug de rendu à corriger. S'il est ABSENT ou différent, c'est un build/déploiement
      // périmé — on teste le mauvais déploiement, pas le code. À inspecter dans DevTools
      // (élément racine du bloc) ou via Playwright. Bumper à chaque passe de stabilisation.
      data-itinerary-build="guide-v1"
      style={{
        border: '1px solid var(--ctv3-line)',
        borderTop: '2px solid var(--ctv3-blue)',
        background: 'var(--ctv3-ink-850)',
        padding: '20px 20px 18px',
        marginTop: 24,
      }}
    >
      {/* Header */}
      <div style={{ marginBottom: 16 }}>
        <span className="ctv3-mono" style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          fontSize: 10, letterSpacing: '0.22em', textTransform: 'uppercase',
          color: 'var(--ctv3-blue)',
        }}>
          <span style={{ width: 14, height: 1, background: 'currentColor', opacity: 0.6 }} />
          Premium · Itinéraire IA
        </span>
        <h2 style={{
          fontFamily: 'var(--ctv3-display)', fontWeight: 800, fontSize: 19,
          letterSpacing: '-0.02em', color: 'var(--ctv3-paper)', margin: '8px 0 4px',
        }}>
          Suggestion d&apos;itinéraire {hasDestination ? `· ${destination}` : ''}
        </h2>
        <p className="ctv3-serif" style={{ fontSize: 13.5, color: 'var(--ctv3-muted)', lineHeight: 1.45, marginBottom: 0 }}>
          Itinéraire indicatif généré par IA. À vérifier avec les sources officielles avant le départ.
        </p>
      </div>

      {/* ── Idle state — generate button ── */}
      {status === 'idle' && (
        <button
          data-testid="itinerary-generate-btn"
          onClick={generate}
          disabled={!hasDestination}
          style={{
            padding: '11px 22px', cursor: hasDestination ? 'pointer' : 'not-allowed',
            background: hasDestination ? 'var(--ctv3-blue)' : 'var(--ctv3-ink-750)',
            border: 'none', color: '#fff',
            fontFamily: 'var(--ctv3-mono)', fontSize: 11, letterSpacing: '0.12em',
            fontWeight: 700, textTransform: 'uppercase',
            opacity: hasDestination ? 1 : 0.5,
            width: '100%', maxWidth: 320,
          }}
        >
          Générer mon itinéraire →
        </button>
      )}

      {/* ── Loading ── */}
      {status === 'loading' && <ItinerarySkeleton />}

      {/* ── Error 401 — connexion requise ── */}
      {status === 'error_401' && (
        <div data-testid="itinerary-error-401" style={{ background: 'var(--ctv3-ink-900)', border: '1px solid var(--ctv3-line)', padding: '14px 16px' }}>
          <p className="ctv3-mono" style={{ fontSize: 12, color: 'var(--ctv3-muted)', marginBottom: 10 }}>
            Connexion requise pour générer un itinéraire.
          </p>
          <button
            type="button"
            data-testid="itinerary-login-btn"
            onClick={() => setShowAuth(true)}
            className="ctv3-mono"
            style={{
              display: 'inline-block', padding: '9px 16px', cursor: 'pointer',
              background: 'var(--ctv3-ink-750)',
              border: '1px solid var(--ctv3-line-bright)', color: 'var(--ctv3-paper)',
              fontSize: 10, letterSpacing: '0.1em', fontWeight: 700, textTransform: 'uppercase',
            }}
          >
            Se connecter →
          </button>
          {/* Local AuthModal — returns the user to this destination after login. */}
          <AuthModal isOpen={showAuth} onClose={() => setShowAuth(false)} />
        </div>
      )}

      {/* ── Error 402 — premium requis ── */}
      {status === 'error_402' && (
        <div data-testid="itinerary-error-402" style={{ background: 'var(--ctv3-ink-900)', border: '1px solid var(--ctv3-line-bright)', padding: '14px 16px' }}>
          <div className="ctv3-mono" style={{ fontSize: 10, letterSpacing: '0.14em', color: 'var(--ctv3-reco)', textTransform: 'uppercase', marginBottom: 6 }}>
            Fonctionnalité Premium
          </div>
          <p className="ctv3-mono" style={{ fontSize: 12, color: 'var(--ctv3-muted)', marginBottom: 10 }}>
            La génération d&apos;itinéraire est réservée aux abonnés Premium.
          </p>
          <a
            href="/pricing"
            className="ctv3-mono"
            style={{
              display: 'inline-block', padding: '9px 16px', textDecoration: 'none',
              background: 'var(--ctv3-reco)', color: 'var(--ctv3-ink-950)',
              fontSize: 10, letterSpacing: '0.12em', fontWeight: 700, textTransform: 'uppercase',
            }}
          >
            Passer à Premium →
          </a>
        </div>
      )}

      {/* ── Error 400 / 500 ── */}
      {(status === 'error_400' || status === 'error_500') && (
        <div data-testid="itinerary-error-generic" style={{ background: 'var(--ctv3-red-soft)', border: '1px solid var(--ctv3-red)', padding: '14px 16px' }}>
          <p className="ctv3-mono" style={{ fontSize: 12, color: 'var(--ctv3-red-2)', marginBottom: 10 }}>
            {errorMsg ?? 'Impossible de générer l\'itinéraire pour le moment.'}
          </p>
          <button
            data-testid="itinerary-retry-btn"
            onClick={() => setStatus('idle')}
            className="ctv3-mono"
            style={{
              padding: '8px 14px', cursor: 'pointer', background: 'none',
              border: '1px solid var(--ctv3-red)', color: 'var(--ctv3-red-2)',
              fontSize: 10, letterSpacing: '0.1em', fontWeight: 700, textTransform: 'uppercase',
            }}
          >
            Réessayer
          </button>
        </div>
      )}

      {/* ── Success — repli honnête (PREMIUM-GUIDE-001B-timeout) ──────────────────
          Si la génération Claude a échoué/time-out, le service renvoie un repli
          déterministe marqué `isFallback`. On NE l'affiche PAS comme un itinéraire
          (fini les fausses cartes génériques qui se faisaient passer pour un parcours) :
          on montre un message honnête + un bouton Réessayer. Disclaimers conservés. */}
      {status === 'success' && result && isFallbackResult && (
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
              La génération complète de votre itinéraire a pris trop de temps et n&apos;a pas pu aboutir cette fois-ci.
            </p>
            <p className="ctv3-serif" style={{ fontSize: 13, color: 'var(--ctv3-muted)', lineHeight: 1.5, margin: '0 0 14px' }}>
              Ce n&apos;est pas un itinéraire définitif. Relancez la génération — elle aboutit généralement à la seconde tentative.
            </p>
            <button
              data-testid="itinerary-fallback-retry"
              onClick={generate}
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

          {/* Disclaimers — toujours visibles, y compris en repli */}
          <div
            data-testid="itinerary-safety-disclaimer"
            style={{
              marginTop: 14, padding: '10px 14px',
              background: 'var(--ctv3-ink-900)', border: '1px solid var(--ctv3-line)',
              borderLeft: '2px solid var(--ctv3-reco)',
            }}
          >
            <p className="ctv3-mono" style={{ fontSize: 10, color: 'var(--ctv3-faint)', lineHeight: 1.55, margin: 0 }}>
              ⚠ {result.itinerary.safetyDisclaimer}
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
              {result.itinerary.officialSourceReminder}
            </p>
          </div>
        </div>
      )}

      {/* ── Success — itinéraire réel ── */}
      {status === 'success' && result && !isFallbackResult && (
        <div data-testid="itinerary-result">
          {/* Meta strip */}
          <div
            className="ctv3-mono"
            style={{
              display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16, rowGap: 6,
              fontSize: 10, letterSpacing: '0.1em', color: 'var(--ctv3-faint)', textTransform: 'uppercase',
            }}
          >
            <span>{result.itinerary.durationDays} jour{result.itinerary.durationDays > 1 ? 's' : ''}</span>
            {result.itinerary.budget.amount > 0 && (
              <>
                <span style={{ width: 12, height: 1, background: 'var(--ctv3-line)', alignSelf: 'center' }} />
                <span>Budget : {result.itinerary.budget.amount} {result.itinerary.budget.currency}</span>
              </>
            )}
            <span style={{ width: 12, height: 1, background: 'var(--ctv3-line)', alignSelf: 'center' }} />
            <span style={{ color: 'var(--ctv3-faint)' }}>Données officielles statiques intégrées</span>
          </div>

          {/* ── Rendu principal : TEXTE DE GUIDE (GUIDE-V1) ───────────────────
              L'itinéraire premium est UNIQUEMENT un texte de guide narratif rendu
              en paragraphes aérés (NarrativeRenderer). Plus AUCUNE carte jour/jour,
              plus de matin/après-midi/soir : ce format poussait le modèle à remplir
              des cases avec du vide. Un résultat sans texte exploitable est traité en
              amont comme un fallback honnête (isFallbackResult) — cette branche n'est
              donc atteinte qu'avec un narrativeText substantiel. Garde défensive : si
              narrativeText venait à manquer ici, on n'affiche RIEN plutôt que des
              cartes (les disclaimers ci-dessous restent visibles). */}
          {result.itinerary.narrativeText && (
            <div data-testid="itinerary-narrative">
              <NarrativeRenderer narrative={result.itinerary.narrativeText} />
            </div>
          )}

          {/* Safety disclaimer — always visible, non-suppressible */}
          <div
            data-testid="itinerary-safety-disclaimer"
            style={{
              marginTop: 14, padding: '10px 14px',
              background: 'var(--ctv3-ink-900)', border: '1px solid var(--ctv3-line)',
              borderLeft: '2px solid var(--ctv3-reco)',
            }}
          >
            <p className="ctv3-mono" style={{ fontSize: 10, color: 'var(--ctv3-faint)', lineHeight: 1.55, margin: 0 }}>
              ⚠ {result.itinerary.safetyDisclaimer}
            </p>
          </div>

          {/* Official source reminder — always visible, non-suppressible */}
          <div
            data-testid="itinerary-official-reminder"
            style={{
              marginTop: 8, padding: '10px 14px',
              background: 'var(--ctv3-ink-900)', border: '1px solid var(--ctv3-line)',
            }}
          >
            <p className="ctv3-mono" style={{ fontSize: 10, color: 'var(--ctv3-faint)', lineHeight: 1.55, margin: 0 }}>
              {result.itinerary.officialSourceReminder}
            </p>
          </div>

          {/* PDF export — uses already-generated itinerary, no extra Claude call */}
          <div
            data-testid="itinerary-pdf-export"
            style={{ marginTop: 14 }}
          >
            <PdfExportButton
              countryCode={props.countryCode ?? ''}
              countryName={props.countryName ?? props.countryCode ?? ''}
              profile={{
                budget:     props.budget,
                travelType: props.travelType,
                from:       props.dateFrom,
                to:         props.dateTo,
              }}
              itinerary={result.itinerary}
            />
          </div>

          {/* Regenerate */}
          <button
            onClick={generate}
            className="ctv3-mono"
            style={{
              marginTop: 10, padding: '9px 16px', cursor: 'pointer',
              background: 'none', border: '1px solid var(--ctv3-line)',
              color: 'var(--ctv3-muted)', fontSize: 10, letterSpacing: '0.1em',
              fontWeight: 700, textTransform: 'uppercase',
            }}
          >
            Regénérer l&apos;itinéraire
          </button>
        </div>
      )}

      {/* Footer note — visible sauf en success où safetyDisclaimer prend le relais */}
      {status !== 'success' && (
        <p className="ctv3-mono" style={{
          fontSize: 9.5, color: 'var(--ctv3-dim)', marginTop: 14, lineHeight: 1.5,
          letterSpacing: '0.02em', borderTop: '1px solid var(--ctv3-line)', paddingTop: 10,
        }}>
          Suggestion d&apos;itinéraire générée par IA à titre indicatif uniquement. Adaptez toujours votre trajet selon les recommandations locales et officielles.
        </p>
      )}
    </div>
  );
}
