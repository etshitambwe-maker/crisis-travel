'use client';
import { useState } from 'react';
import type { CrisisScore, ItineraryResult } from '@/types/crisis.types';

interface PdfExportButtonProps {
  countryCode: string;
  countryName: string;
  profile?: {
    budget?:     number;
    duration?:   number;
    travelType?: 'solo' | 'couple' | 'family' | 'nomad';
    from?:       string;
    to?:         string;
  };
  /** When provided, sent as-is to avoid a second Claude call server-side. */
  itinerary?: ItineraryResult;
  /**
   * Already-computed CrisisScore from the destination page (SSR).
   * When provided together with narrative, triggers export-only destination-report
   * mode server-side — no server-side scoring or Claude call is made.
   */
  scoreSnapshot?: CrisisScore;
  /** Already-generated Claude narrative from the destination page (SSR). */
  narrative?: string;
}

type ExportStatus = 'idle' | 'loading' | 'error' | 'error_401' | 'error_402';

export function PdfExportButton({ countryCode, countryName, profile, itinerary, scoreSnapshot, narrative }: PdfExportButtonProps) {
  const [status, setStatus] = useState<ExportStatus>('idle');

  async function handleExport() {
    if (status === 'loading') return;
    setStatus('loading');

    try {
      const body: Record<string, unknown> = { profile: profile ?? {} };
      if (itinerary)      body.itinerary      = itinerary;
      if (scoreSnapshot)  body.scoreSnapshot  = scoreSnapshot;
      if (narrative)      body.narrative      = narrative;

      const res = await fetch(`/api/export-pdf/${countryCode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.status === 401) { setStatus('error_401'); return; }
      if (res.status === 402) { setStatus('error_402'); return; }
      if (!res.ok) { setStatus('error'); return; }

      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `crisis-travel-${countryName.toLowerCase().replace(/\s+/g, '-')}-${new Date().toISOString().slice(0, 10)}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setStatus('idle');
    } catch {
      setStatus('error');
    }
  }

  if (status === 'error_401') {
    return (
      <div data-testid="pdf-export-error-401" style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span className="ctv3-mono" style={{ fontSize: 10, color: 'var(--ctv3-muted)' }}>
          Connexion requise pour exporter.
        </span>
        <a
          href="/login"
          className="ctv3-mono"
          style={{
            padding: '8px 14px', textDecoration: 'none',
            border: '1px solid var(--ctv3-line-bright)',
            color: 'var(--ctv3-paper)', background: 'var(--ctv3-ink-750)',
            fontSize: 10, letterSpacing: '0.1em', fontWeight: 700, textTransform: 'uppercase',
          }}
        >
          Se connecter →
        </a>
      </div>
    );
  }

  if (status === 'error_402') {
    return (
      <div data-testid="pdf-export-error-402" style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span className="ctv3-mono" style={{ fontSize: 10, color: 'var(--ctv3-reco)' }}>
          Export PDF réservé aux abonnés Premium.
        </span>
        <a
          href="/pricing"
          className="ctv3-mono"
          style={{
            padding: '8px 14px', textDecoration: 'none',
            background: 'var(--ctv3-reco)', color: 'var(--ctv3-ink-950)',
            fontSize: 10, letterSpacing: '0.12em', fontWeight: 700, textTransform: 'uppercase',
          }}
        >
          Passer à Premium →
        </a>
      </div>
    );
  }

  return (
    <button
      data-testid="pdf-export-btn"
      onClick={handleExport}
      disabled={status === 'loading'}
      className="ctv3-mono"
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 7,
        padding: '11px 16px', border: '1px solid var(--ctv3-blue)', color: 'var(--ctv3-blue)',
        fontSize: 10.5, letterSpacing: '0.12em', fontWeight: 700,
        textTransform: 'uppercase', background: 'none', cursor: status === 'loading' ? 'wait' : 'pointer',
        opacity: status === 'loading' ? 0.6 : 1,
      }}
    >
      {status === 'loading'
        ? 'Génération…'
        : status === 'error'
          ? 'Erreur — Réessayer'
          : '↓ Exporter en PDF'}
    </button>
  );
}
