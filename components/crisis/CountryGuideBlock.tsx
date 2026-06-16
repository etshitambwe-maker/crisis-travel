'use client';
// ─────────────────────────────────────────────────────────────────────────────
// CountryGuideBlock (PREMIUM-GUIDE-001C)
//
// Bloc premium ADDITIF « Guide pays » sous la narrative. Génération ON-DEMAND
// (clic → POST /api/country-guide), jamais en SSR. Quatre états : idle / loading /
// success (texte de guide via NarrativeRenderer) / échec honnête + Réessayer.
//
// NE réintroduit aucune carte jour/jour ni slot matin/après-midi/soir : le guide est
// un texte continu, comme GuideItinerarySection — mais pour le PAYS, pas l'itinéraire.
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect } from 'react';
import type { CountryGuideApiResponse, CountryGuideRequest } from '@/types/crisis.types';
import { NarrativeRenderer } from './NarrativeRenderer';
import { PdfExportButton } from './PdfExportButton';
import { loadTripContext } from '@/lib/utils/tripContext';

type Status = 'idle' | 'loading' | 'success' | 'error';

export interface CountryGuideBlockProps {
  countryCode: string;
  countryName: string;
  travelType?: 'solo' | 'couple' | 'family' | 'nomad';
  budget?: number;
  duration?: number;
  /** TRAVEL-DATES-001 — Date de départ (YYYY-MM-DD). */
  from?: string;
  /** TRAVEL-DATES-001 — Date de retour (YYYY-MM-DD). */
  to?: string;
}

export function CountryGuideBlock(props: CountryGuideBlockProps) {
  const [status, setStatus] = useState<Status>('idle');
  const [guide, setGuide] = useState<CountryGuideApiResponse['guide'] | null>(null);

  // TRIP-CONTEXT-001 : le TripContext côté client prime sur les props SSR.
  // Les props (travelType, budget, duration, from, to) sont déjà enrichies par la page SSR
  // depuis les searchParams ; ici on les surcharge avec le sessionStorage si dispo,
  // ce qui couvre aussi la génération déclenchée après un retour depuis /results.
  const [effectiveTravelType, setEffectiveTravelType] = useState(props.travelType);
  const [effectiveBudget, setEffectiveBudget]         = useState(props.budget);
  const [effectiveDuration, setEffectiveDuration]     = useState(props.duration);
  const [effectiveFrom, setEffectiveFrom]             = useState(props.from);  // TRAVEL-DATES-001
  const [effectiveTo, setEffectiveTo]                 = useState(props.to);    // TRAVEL-DATES-001

  useEffect(() => {
    const ctx = loadTripContext();
    if (ctx) {
      setEffectiveTravelType(ctx.travelType);
      if (ctx.budget)    setEffectiveBudget(ctx.budget);
      if (ctx.duration)  setEffectiveDuration(ctx.duration);
      if (ctx.from)      setEffectiveFrom(ctx.from);   // TRAVEL-DATES-001
      if (ctx.to)        setEffectiveTo(ctx.to);       // TRAVEL-DATES-001
    }
  }, []);

  async function generate() {
    if (status === 'loading') return;
    setStatus('loading');
    setGuide(null);
    try {
      const body: CountryGuideRequest = {
        countryCode: props.countryCode,
        countryName: props.countryName,
        travelType: effectiveTravelType,
        budget:     effectiveBudget,
        duration:   effectiveDuration,
        from:       effectiveFrom,  // TRAVEL-DATES-001
        to:         effectiveTo,    // TRAVEL-DATES-001
      };
      const res = await fetch('/api/country-guide', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      let json: CountryGuideApiResponse | null = null;
      try { json = (await res.json()) as CountryGuideApiResponse; } catch { json = null; }

      if (res.ok && json?.guide && !json.guide.isFallback && json.guide.guideText) {
        setGuide(json.guide);
        setStatus('success');
        return;
      }
      // Tout le reste (fallback honnête, 4xx/5xx, JSON nul) → état échec honnête.
      setStatus('error');
    } catch {
      setStatus('error');
    }
  }

  return (
    <div
      data-testid="country-guide-block"
      data-country-guide-build="guide-v1"
      style={{
        border: '1px solid var(--ctv3-line)',
        borderTop: '2px solid var(--ctv3-blue)',
        background: 'var(--ctv3-ink-850)',
        padding: '20px 20px 18px',
        marginTop: 18,
      }}
    >
      <div style={{ marginBottom: 14 }}>
        <span className="ctv3-mono" style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          fontSize: 10, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'var(--ctv3-blue)',
        }}>
          <span style={{ width: 14, height: 1, background: 'currentColor', opacity: 0.6 }} />
          Premium · Guide pays
        </span>
        <h2 style={{
          fontFamily: 'var(--ctv3-display)', fontWeight: 800, fontSize: 19,
          letterSpacing: '-0.02em', color: 'var(--ctv3-paper)', margin: '8px 0 4px',
        }}>
          Guide terrain · {props.countryName}
        </h2>
        <p className="ctv3-serif" style={{ fontSize: 13.5, color: 'var(--ctv3-muted)', lineHeight: 1.45, margin: 0 }}>
          Un brief de guide avant le départ : où se baser, quoi éviter, arnaques et erreurs classiques. Généré par IA, à vérifier avec les sources officielles.
        </p>
      </div>

      {status === 'idle' && (
        <button
          data-testid="country-guide-generate-btn"
          onClick={generate}
          className="ctv3-mono"
          style={{
            padding: '11px 22px', cursor: 'pointer', background: 'var(--ctv3-blue)',
            border: 'none', color: '#fff', fontSize: 11, letterSpacing: '0.12em',
            fontWeight: 700, textTransform: 'uppercase', width: '100%', maxWidth: 320,
          }}
        >
          Générer le guide pays →
        </button>
      )}

      {status === 'loading' && (
        <div data-testid="country-guide-loading" aria-busy="true" className="ctv3-mono"
          style={{ fontSize: 11, letterSpacing: '0.1em', color: 'var(--ctv3-muted)', textTransform: 'uppercase', padding: '8px 0' }}>
          Génération du guide en cours… cela peut prendre quelques secondes.
        </div>
      )}

      {status === 'error' && (
        <div data-testid="country-guide-fallback" style={{
          background: 'var(--ctv3-ink-900)', border: '1px solid var(--ctv3-line-bright)',
          borderLeft: '2px solid var(--ctv3-reco)', padding: '16px 18px',
        }}>
          <div className="ctv3-mono" style={{ fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--ctv3-reco)', marginBottom: 8 }}>
            Génération incomplète
          </div>
          <p className="ctv3-serif" style={{ fontSize: 14, color: 'var(--ctv3-paper)', lineHeight: 1.55, margin: '0 0 14px' }}>
            La génération du guide a pris trop de temps ou n&apos;a pas pu aboutir. Relance — elle aboutit généralement à la seconde tentative.
          </p>
          <button
            data-testid="country-guide-retry-btn"
            onClick={generate}
            className="ctv3-mono"
            style={{
              padding: '10px 18px', cursor: 'pointer', background: 'var(--ctv3-blue)',
              border: 'none', color: '#fff', fontSize: 11, letterSpacing: '0.12em', fontWeight: 700, textTransform: 'uppercase',
            }}
          >
            Réessayer →
          </button>
        </div>
      )}

      {status === 'success' && guide && !guide.isFallback && (
        <div data-testid="country-guide-result">
          <NarrativeRenderer narrative={guide.guideText} />

          {/* COUNTRY-GUIDE-PDF-001 — export du guide DÉJÀ généré (aucun re-appel IA).
              Le guide en mémoire est passé tel quel à PdfExportButton (mode export-only). */}
          <div data-testid="country-guide-pdf-export" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', marginTop: 14 }}>
            <PdfExportButton
              countryCode={props.countryCode}
              countryName={props.countryName}
              profile={{ travelType: effectiveTravelType, budget: effectiveBudget, duration: effectiveDuration }}
              countryGuide={guide}
            />
            <button
              onClick={generate}
              className="ctv3-mono"
              style={{
                padding: '9px 16px', cursor: 'pointer', background: 'none',
                border: '1px solid var(--ctv3-line)', color: 'var(--ctv3-muted)',
                fontSize: 10, letterSpacing: '0.1em', fontWeight: 700, textTransform: 'uppercase',
              }}
            >
              Regénérer le guide
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
