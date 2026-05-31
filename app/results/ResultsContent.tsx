'use client';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { CountryCard } from '@/components/crisis/CountryCard';
import { TravelPackMiniBlock } from '@/components/crisis/TravelPackMiniBlock';
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

function SectionHead({ num, label, meta }: { num: string; label: string; meta: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      marginBottom: 14, paddingBottom: 10, borderBottom: '1px solid #1f1f30',
    }}>
      <div style={{
        fontFamily: 'var(--ct-mono, var(--font-space-mono), monospace)',
        fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase',
        fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 8, color: '#f0f0f5',
      }}>
        <span style={{ width: 8, height: 8, background: '#3ddc97', transform: 'rotate(45deg)', display: 'inline-block' }} />
        <span style={{ color: '#6b6b85', fontWeight: 500 }}>{num} /</span>
        {label}
      </div>
      <span style={{ fontFamily: 'var(--ct-mono, var(--font-space-mono), monospace)', fontSize: 9.5, letterSpacing: '0.12em', color: '#6b6b85', textTransform: 'uppercase' }}>
        {meta}
      </span>
    </div>
  );
}

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
  const dateFrom  = params.get('from') ?? '';
  const dateTo    = params.get('to')   ?? '';

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
  const dateLabel = dateFrom
    ? ` · Du ${new Date(dateFrom).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })} au ${dateTo ? new Date(dateTo).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }) : '?'}`
    : '';
  const pageSubtitle = continent
    ? `${data?.meta.analyzedCountries ?? '...'} pays analysés — ${SORT_LABELS[sortByParam] ?? ''} — depuis ${airport}${dateLabel}`
    : `${labels.subtitle} — Depuis ${airport}${dateLabel}`;

  return (
    <main style={{ maxWidth: 800, margin: '0 auto', padding: '0 20px 60px', position: 'relative' }}>
      {/* Hero résultats */}
      <section style={{ padding: '28px 0 24px', position: 'relative' }}>
        <div style={{
          display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12,
          fontFamily: 'var(--ct-mono, var(--font-space-mono), monospace)',
          fontSize: 9.5, letterSpacing: '0.18em', color: '#6b6b85', textTransform: 'uppercase',
        }}>
          <span>RÉSULTATS</span>
          <span style={{ width: 20, height: 1, background: '#2e2e45' }} />
          <span>{data ? `${data.results.length} / ${data.meta.analyzedCountries} CORRESPONDANCES` : '...'}</span>
          <span style={{ width: 20, height: 1, background: '#2e2e45' }} />
          {data && <span style={{ color: '#3ddc97' }}>● ANALYSE {(data.meta.duration / 1000).toFixed(1)}S</span>}
        </div>
        <h1 style={{
          fontFamily: 'var(--font-space-mono), monospace',
          fontSize: 'clamp(32px, 8vw, 44px)', lineHeight: 0.92,
          letterSpacing: '-0.03em', margin: '0 0 14px', fontWeight: 700, color: '#f0f0f5',
        }}>
          {pageTitle}
        </h1>
        <p style={{ maxWidth: 400, color: '#9898b0', fontSize: 14, lineHeight: 1.5, margin: 0 }}>
          {pageSubtitle}
        </p>
      </section>

      {/* ── Overlay d'analyse — globe + avion ── */}
      {loading && (
        <div className="ct-overlay">
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 32 }}>

            {/* Globe avec avion en orbite */}
            <div style={{ position: 'relative', width: 120, height: 120 }}>
              {/* Halo externe */}
              <div style={{
                position: 'absolute', inset: -16,
                borderRadius: '50%',
                border: '1px solid rgba(74,158,255,0.12)',
              }} />
              <div style={{
                position: 'absolute', inset: -8,
                borderRadius: '50%',
                border: '1px dashed rgba(74,158,255,0.2)',
                animation: 'ct-spin-reverse 20s linear infinite',
              }} />

              {/* Globe */}
              <div style={{
                width: 120, height: 120, borderRadius: '50%',
                background: 'radial-gradient(circle at 35% 35%, #1a3a6e, #0a1a3a 60%, #060e1f)',
                border: '1.5px solid rgba(74,158,255,0.35)',
                animation: 'ct-globe-pulse 3s ease-in-out infinite',
                position: 'relative', overflow: 'hidden',
                boxShadow: '0 0 40px rgba(74,158,255,0.15), inset 0 0 30px rgba(0,0,0,0.5)',
              }}>
                {/* Méridiens simulés */}
                <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'repeating-linear-gradient(0deg, transparent, transparent 18px, rgba(74,158,255,0.07) 18px, rgba(74,158,255,0.07) 19px)' }} />
                <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'repeating-linear-gradient(90deg, transparent, transparent 18px, rgba(74,158,255,0.07) 18px, rgba(74,158,255,0.07) 19px)' }} />
                {/* Brillance */}
                <div style={{ position: 'absolute', top: 12, left: 18, width: 28, height: 20, borderRadius: '50%', background: 'rgba(255,255,255,0.06)', filter: 'blur(4px)' }} />
              </div>

              {/* Avion en orbite */}
              <div style={{
                position: 'absolute',
                top: '50%', left: '50%',
                marginTop: -8, marginLeft: -8,
                width: 16, height: 16,
                animation: 'ct-plane-orbit 4s linear infinite',
                transformOrigin: '8px 8px',
                fontSize: 14,
                lineHeight: '16px',
                textAlign: 'center',
                filter: 'drop-shadow(0 0 4px rgba(255,255,255,0.6))',
              }}>
                ✈️
              </div>
            </div>

            {/* Texte */}
            <div style={{ textAlign: 'center' }}>
              <div style={{
                fontFamily: 'var(--ct-mono, var(--font-space-mono), monospace)',
                fontSize: 13, letterSpacing: '0.2em', textTransform: 'uppercase',
                fontWeight: 700, color: '#f0f0f5', marginBottom: 8,
              }}>
                ANALYSE EN COURS
              </div>
              {/* Points clignotants */}
              <div style={{ display: 'flex', gap: 5, justifyContent: 'center', marginBottom: 12 }}>
                {[0, 1, 2].map((i) => (
                  <div key={i} style={{
                    width: 5, height: 5, borderRadius: '50%', background: '#4a9eff',
                    animation: `ct-dot-blink 1.4s ease-in-out ${i * 0.2}s infinite`,
                  }} />
                ))}
              </div>
              <div style={{
                fontFamily: 'var(--ct-mono, var(--font-space-mono), monospace)',
                fontSize: 10, letterSpacing: '0.12em', color: '#6b6b85',
              }}>
                {elapsed < 8 ? 'Consultation des sources officielles...' :
                 elapsed < 18 ? 'Calcul des CrisisScores...' :
                 elapsed < 28 ? 'Synthèse par intelligence artificielle...' :
                 'Finalisation de l\'analyse...'}
              </div>
              <div style={{
                marginTop: 8,
                fontFamily: 'var(--ct-mono, var(--font-space-mono), monospace)',
                fontSize: 9, color: '#3f3f5a', letterSpacing: '0.1em',
              }}>
                {elapsed}s · jusqu&apos;à 45s selon le cache
              </div>
            </div>

          </div>
        </div>
      )}

      {error && (
        <div style={{ background: 'rgba(255,77,46,0.1)', border: '1px solid rgba(255,77,46,0.3)', borderRadius: 8, padding: 16, color: '#ff4d2e' }}>
          {error}
        </div>
      )}

      {data && (
        <>
          {/* Opportunités */}
          {data.opportunities.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <SectionHead num="02" label="FENÊTRES D'OPPORTUNITÉ" meta={`${data.opportunities.length} DÉTECTÉES`} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {data.opportunities.map((op: OpportunityWindow, i: number) => (
                  <div key={i} style={{
                    background: 'linear-gradient(135deg, rgba(61,220,151,0.06), rgba(61,220,151,0.02))',
                    border: '1px solid rgba(61,220,151,0.2)', borderRadius: 12, padding: '12px 16px',
                  }}>
                    <span style={{ fontFamily: 'var(--ct-mono, var(--font-space-mono), monospace)', fontWeight: 700, color: '#3ddc97', fontSize: 13 }}>
                      {op.country ?? op.countryCode}
                    </span>
                    <span style={{ color: '#9898b0', marginLeft: 8, fontSize: 13 }}>{op.explanation}</span>
                    {op.estimatedSaving > 0 && (
                      <span style={{ color: '#3ddc97', marginLeft: 8, fontFamily: 'var(--ct-mono, var(--font-space-mono), monospace)', fontSize: 12 }}>
                        ~{op.estimatedSaving}€ économisés
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Liste des destinations */}
          <SectionHead num={data.opportunities.length > 0 ? '03' : '02'} label={data.results.length > 5 ? 'TOUTES LES DESTINATIONS' : 'TOP DESTINATIONS'} meta={`TRI SCORE ↓`} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {(continent ? data.results : data.topDestinations).map((score) => (
              <CountryCard key={score.countryCode} score={score} />
            ))}
          </div>

          {!continent && data.results.length > 5 && (
            <p style={{ marginTop: 16, fontSize: '0.7rem', color: '#6b6b85', textAlign: 'center', fontFamily: 'var(--ct-mono, var(--font-space-mono), monospace)', letterSpacing: '0.08em' }}>
              {data.results.length - 5} AUTRES DESTINATIONS ANALYSÉES · Lance une analyse par région pour tout voir
            </p>
          )}

          {/* Pack Voyage affiliation — contextualisé sur la meilleure destination (top 1),
              avec dégradation gracieuse vers le bloc générique si la liste est vide.
              CTA tracés via /api/affiliate/click (country_code + country_name renseignés). */}
          {(() => {
            const top = (continent ? data.results : data.topDestinations)[0];
            return <TravelPackMiniBlock countryCode={top?.countryCode} countryName={top?.country} />;
          })()}
        </>
      )}
    </main>
  );
}
