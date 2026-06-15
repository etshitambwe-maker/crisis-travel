'use client';
import { useState } from 'react';
import type { ItineraryApiResponse, ItineraryRequest } from '@/types/crisis.types';
import { AuthModal } from '@/components/auth/AuthModal';
import { GuideItinerarySection, isFallbackItinerary } from './GuideItinerarySection';

// Ré-export pour compatibilité des imports existants (la source de vérité vit désormais
// dans GuideItinerarySection, au plus près du rendu qu'elle gouverne).
export { isFallbackItinerary };

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
  /** Durée en jours — transmise au service quand dateFrom/dateTo sont absents. */
  duration?: number;
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
  if (props.duration && props.duration > 0) req.duration = props.duration;
  if (props.meaeLevel) {
    req.riskContext = { meaeLevel: props.meaeLevel, source: 'static' };
  }
  return req;
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
      // MARQUEUR DE BUILD : preuve in-DOM du code réellement servi. « guide-v1-no-cards »
      // = la section premium est un TEXTE de guide, sans aucune carte jour/jour. Si l'écran
      // montre encore des cartes mais que ce marqueur vaut bien « guide-v1-no-cards », c'est
      // un bug de rendu ; s'il est absent/différent, c'est un build/déploiement périmé.
      // À inspecter dans DevTools (élément racine du bloc) ou via Playwright.
      data-itinerary-build="guide-v1-no-cards"
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
          Premium · Parcours guide
        </span>
        <h2 style={{
          fontFamily: 'var(--ctv3-display)', fontWeight: 800, fontSize: 19,
          letterSpacing: '-0.02em', color: 'var(--ctv3-paper)', margin: '8px 0 4px',
        }}>
          Parcours conseillé {hasDestination ? `· ${destination}` : ''}
        </h2>
        <p className="ctv3-serif" style={{ fontSize: 13.5, color: 'var(--ctv3-muted)', lineHeight: 1.45, marginBottom: 0 }}>
          Parcours indicatif généré par IA, sous forme de guide. À vérifier avec les sources officielles avant le départ.
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
          Générer mon parcours →
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

      {/* ── Success — section parcours guide (GUIDE-V1 NO CARDS) ──────────────────
          GuideItinerarySection ne rend QUE deux états : texte de guide (succès) ou
          message honnête + Réessayer (échec). Elle ignore totalement `itinerary.days` :
          aucune carte jour/matin/après-midi/soir ne peut apparaître, par construction. */}
      {status === 'success' && result && (
        <GuideItinerarySection
          itinerary={result.itinerary}
          onRetry={generate}
          pdf={{
            countryCode: props.countryCode ?? '',
            countryName: props.countryName ?? props.countryCode ?? '',
            profile: {
              budget:     props.budget,
              duration:   props.duration,
              travelType: props.travelType,
              from:       props.dateFrom,
              to:         props.dateTo,
            },
          }}
        />
      )}

      {/* Footer note — visible sauf en success où safetyDisclaimer prend le relais */}
      {status !== 'success' && (
        <p className="ctv3-mono" style={{
          fontSize: 9.5, color: 'var(--ctv3-dim)', marginTop: 14, lineHeight: 1.5,
          letterSpacing: '0.02em', borderTop: '1px solid var(--ctv3-line)', paddingTop: 10,
        }}>
          Parcours conseillé généré par IA à titre indicatif uniquement. Adaptez toujours votre trajet selon les recommandations locales et officielles.
        </p>
      )}
    </div>
  );
}
