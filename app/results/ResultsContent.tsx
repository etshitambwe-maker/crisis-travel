'use client';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { CountryCard } from '@/components/crisis/CountryCard';
import type { AnalyzeResponse, OpportunityWindow } from '@/types/crisis.types';

export function ResultsContent() {
  const params = useSearchParams();
  const [data, setData] = useState<AnalyzeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const profile = {
      departureCountry: 'FR',
      budget: parseInt(params.get('budget') ?? '1500'),
      duration: parseInt(params.get('duration') ?? '7'),
      period: 'flexible',
      travelType: (params.get('travelType') ?? 'solo') as 'solo' | 'couple' | 'family' | 'nomad',
      mode: (params.get('mode') ?? 'standard') as 'standard' | 'bunker' | 'budget_crisis',
    };

    fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profile }),
    })
      .then((r) => r.json())
      .then((d: AnalyzeResponse) => { setData(d); setLoading(false); })
      .catch(() => { setError("Erreur lors de l'analyse"); setLoading(false); });
  }, [params]);

  return (
    <main style={{ maxWidth: 800, margin: '0 auto', padding: '32px 24px' }}>
      <h1 style={{ fontFamily: 'var(--font-space-mono)', fontSize: '2rem', color: '#fff', marginBottom: 4 }}>
        VOS DESTINATIONS
      </h1>
      <p style={{ color: '#6b7280', fontSize: '0.85rem', marginBottom: 32 }}>
        Analyse basée sur les données mondiales en temps réel
      </p>

      {loading && (
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <div style={{ fontFamily: 'var(--font-space-mono)', color: '#ff4d2e', fontSize: '1rem', marginBottom: 12 }}>
            ⚡ ANALYSE EN COURS...
          </div>
          <p style={{ color: '#6b7280', fontSize: '0.85rem' }}>
            Consultation de 25+ sources officielles en parallèle
          </p>
        </div>
      )}

      {error && (
        <div style={{ background: 'rgba(255,77,46,0.1)', border: '1px solid rgba(255,77,46,0.3)', borderRadius: 8, padding: 16, color: '#ff4d2e' }}>
          {error}
        </div>
      )}

      {data && (
        <>
          <div style={{ marginBottom: 16, fontSize: '0.75rem', color: '#3f3f5a', fontFamily: 'var(--font-space-mono)' }}>
            {data.meta.analyzedCountries} pays analysés en {(data.meta.duration / 1000).toFixed(1)}s
          </div>

          {data.opportunities.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <h2 style={{ fontFamily: 'var(--font-space-mono)', fontSize: '0.85rem', color: '#00e5a0', letterSpacing: '0.1em', marginBottom: 10 }}>
                ✦ FENÊTRES D'OPPORTUNITÉ DÉTECTÉES
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {data.opportunities.map((op: OpportunityWindow, i: number) => (
                  <div key={i} style={{ background: 'rgba(0,229,160,0.05)', border: '1px solid rgba(0,229,160,0.2)', borderRadius: 8, padding: '10px 14px', fontSize: '0.82rem' }}>
                    <span style={{ color: '#00e5a0', fontWeight: 700 }}>{op.country ?? op.countryCode}</span>
                    <span style={{ color: '#6b7280', marginLeft: 8 }}>{op.explanation}</span>
                    {op.estimatedSaving > 0 && (
                      <span style={{ color: '#00e5a0', marginLeft: 8 }}>~{op.estimatedSaving}€ économisés</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <h2 style={{ fontFamily: 'var(--font-space-mono)', fontSize: '0.85rem', color: '#e8e8e8', letterSpacing: '0.1em', marginBottom: 12 }}>
            TOP DESTINATIONS
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {data.topDestinations.map((score) => (
              <CountryCard key={score.countryCode} score={score} />
            ))}
          </div>
        </>
      )}
    </main>
  );
}
