'use client';
import { useState } from 'react';

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
}

export function PdfExportButton({ countryCode, countryName, profile }: PdfExportButtonProps) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');

  async function handleExport() {
    if (status === 'loading') return;
    setStatus('loading');

    try {
      const res = await fetch(`/api/export-pdf/${countryCode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile: profile ?? {} }),
      });

      if (!res.ok) {
        setStatus('error');
        return;
      }

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
      {status === 'loading' ? 'Génération…' : status === 'error' ? 'Erreur — Réessayer' : '↓ Exporter en PDF'}
    </button>
  );
}
