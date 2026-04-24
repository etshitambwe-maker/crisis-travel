'use client';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { CountryCard } from '@/components/crisis/CountryCard';
import type { AnalyzeResponse, OpportunityWindow } from '@/types/crisis.types';

const CONTINENT_LABELS: Record<string, string> = {
  Europe: '🌍 Europe',
  Africa: '🌍 Afrique',
  Asia: '🌏 Asie',
  Americas: '🌎 Amériques',
  MiddleEast: '🕌 Moyen-Orient',
};

const PRIORITY_LABELS: Record<string, { title: string; subtitle: string }> = {
  securite:   { title: 'DESTINATIONS LES PLUS SÛRES',      subtitle: 'Classées par score de sécurité décroissant' },
  budget:     { title: 'MEILLEURES OPPORTUNITÉS BUDGET',    subtitle: 'Où ton argent vaut le plus en ce moment' },
  decouverte: { title: 'DESTINATIONS HORS DES SENTIERS',    subtitle: 'Pays authentiques, moins touristiques' },
  tout:       { title: 'VOS DESTINATIONS',                   subtitle: 'Le meilleur équilibre sécurité / budget / expérience' },
};

const SORT_LABELS: Record<string, string> = {
  security: 'triées par sécurité',
  budget:   'triées par budget',
  score:    'triées par CrisisScore',
};

export function ResultsContent() {
  const params = useSearchParams();
  const [data, setData] = useState<AnalyzeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);

  const continent = params.get('continent') ?? undefined;
  const priority  = params.get('priority') ?? 'tout';
  const airport   = params.get('airport') ?? 'CDG';
  const sortByParam = params.get('mode') === 'bunker' ? 'security' : params.get('mode') === 'budget_crisis' ? 'budget' : 'score';

  // Timer affiché pendant le chargement
  useEffect(() => {
    if (!loading) return;
    const iv = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(iv);
  }, [loading]);

  useEffect(() => {
    const profile = {
      departureCountry: 'FR',
      budget: parseInt(params.get('budget') ?? '1500'),
      duration: parseInt(params.get('duration') ?? '7'),
      period: 'flexible',
      travelType: (params.get('travelType') ?? 'solo') as 'solo' | 'couple' | 'family' | 'nomad',
      mode: (params.get('mode') ?? 'standard') as 'standard' | 'bunker' | 'budget_crisis',
      continent,
      priority,
      sortBy: sortByParam as 'score' | 'security' | 'budget',
    };

    setLoading(true);
    setElapsed(0);

    fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profile }),
    })
      .then((r) => r.json())
      .then((d: AnalyzeResponse) => { setData(d); setLoading(false); })
      .catch(() => { setError("Erreur lors de l'analyse"); setLoading(false); });
  }, [params]); // eslint-disable-line react-hooks/exhaustive-deps

  const labels = PRIORITY_LABELS[priority] ?? PRIORITY_LABELS.tout;
  const pageTitle = continent
    ? `ANALYSE ${CONTINENT_LABELS[continent]?.toUpperCase() ?? continent.toUpperCase()}`
    : labels.title;
  const pageSubtitle = continent
    ? `${data?.meta.analyzedCountries ?? '...'} pays analysés — ${SORT_LABELS[sortByParam] ?? ''} — depuis ${airport}`
    : `${labels.subtitle} — Depuis ${airport}`;

  return (
    <main style={{ maxWidth: 800, margin: '0 auto', padding: '32px 24px' }}>
      <h1 style={{ fontFamily: 'var(--font-space-mono)', fontSize: '1.8rem', color: '#fff', marginBottom: 4 }}>
        {pageTitle}
      </h1>
      <p style={{ color: '#6b7280', fontSize: '0.85rem', marginBottom: 28 }}>
        {pageSubtitle}
      </p>

      {/* ── Chargement avec indicateur de progression ── */}
      {loading && (
        <div style={{ padding: '40px 0' }}>
          <div style={{ fontFamily: 'var(--font-space-mono)', color: '#ff4d2e', fontSize: '0.9rem', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ animation: 'pulse 1s infinite' }}>⚡</span>
            <span>ANALYSE EN COURS... {elapsed}s</span>
          </div>
          {/* Progress bar */}
          <div style={{ height: 3, background: '#1e1e2e', borderRadius: 2, marginBottom: 14, overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width: '100%',
              background: 'linear-gradient(90deg, #ff4d2e 0%, #ff8c42 50%, #ff4d2e 100%)',
              backgroundSize: '200% 100%',
              animation: 'shimmer 2s infinite linear',
              borderRadius: 2,
            }} />
          </div>
          <style>{`
            @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
            @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
          `}</style>
          <p style={{ color: '#3f3f5a', fontSize: '0.78rem', fontFamily: 'var(--font-space-mono)' }}>
            {continent
              ? `Consultation des sources officielles pour ${CONTINENT_LABELS[continent] ?? continent}...`
              : 'Consultation de 25+ sources officielles en parallèle...'}
          </p>
          {/* Rotating status messages */}
          <p style={{ color: '#6b7280', fontSize: '0.72rem', marginTop: 6 }}>
            {elapsed < 5  ? '↳ MEAE France · US State Dept · ACLED...'
            : elapsed < 15 ? '↳ World Bank · Frankfurter · ReliefWeb...'
            : elapsed < 25 ? '↳ Calcul des CrisisScores...'
            : '↳ Finalisation de l\'analyse...'}
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
          {/* Meta */}
          <div style={{ marginBottom: 20, fontSize: '0.7rem', color: '#3f3f5a', fontFamily: 'var(--font-space-mono)' }}>
            {data.meta.analyzedCountries} pays analysés en {(data.meta.duration / 1000).toFixed(1)}s
            {continent && <span style={{ marginLeft: 8, color: '#6b7280' }}>· Région : {CONTINENT_LABELS[continent] ?? continent}</span>}
          </div>

          {/* Opportunités */}
          {data.opportunities.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <h2 style={{ fontFamily: 'var(--font-space-mono)', fontSize: '0.78rem', color: '#00e5a0', letterSpacing: '0.1em', marginBottom: 10 }}>
                ✦ FENÊTRES D&apos;OPPORTUNITÉ DÉTECTÉES
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

          {/* Liste des destinations */}
          <h2 style={{ fontFamily: 'var(--font-space-mono)', fontSize: '0.78rem', color: '#e8e8e8', letterSpacing: '0.1em', marginBottom: 12 }}>
            {data.results.length > 5 ? 'TOUTES LES DESTINATIONS' : 'TOP DESTINATIONS'}
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {(continent ? data.results : data.topDestinations).map((score) => (
              <CountryCard key={score.countryCode} score={score} />
            ))}
          </div>

          {/* Si scan mondial, rappel des 5 meilleures */}
          {!continent && data.results.length > 5 && (
            <p style={{ marginTop: 16, fontSize: '0.7rem', color: '#3f3f5a', textAlign: 'center', fontFamily: 'var(--font-space-mono)' }}>
              {data.results.length - 5} autres destinations analysées · Lance une analyse par région pour tout voir
            </p>
          )}
        </>
      )}
    </main>
  );
}
