// Fallback de chargement natif Next.js pour /destination/[country].
// La page est un Server Component qui exécute scoring + synthèse Claude (plusieurs
// secondes sur cold cache) : sans ce loader, la navigation laissait l'écran figé.
// Skeleton calé sur la structure réelle (hero, gauge, sous-scores) pour limiter le saut visuel.
// FRONT-004 : aligné au système ctv3 (tokens, copy neutre).
export default function DestinationLoading() {
  const shimmer = {
    background: 'linear-gradient(90deg, var(--ctv3-ink-850) 0%, var(--ctv3-ink-700) 50%, var(--ctv3-ink-850) 100%)',
    backgroundSize: '200% 100%',
    animation: 'ct-shimmer 1.4s ease-in-out infinite',
  } as const;

  return (
    <div className="ctv3" style={{ minHeight: '100vh', background: 'var(--ctv3-ink-900)' }}>
      {/* Hero skeleton */}
      <div style={{
        width: '100%', minHeight: 300,
        background: 'linear-gradient(135deg, var(--ctv3-ink-850), var(--ctv3-ink-900) 100%)',
        display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
        maxWidth: 820, margin: '0 auto', padding: '0 20px 26px', gap: 14,
        borderBottom: '1px solid var(--ctv3-line-soft)',
      }}>
        <div style={{ ...shimmer, width: 140, height: 14 }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ ...shimmer, width: 48, height: 32 }} />
          <div style={{ ...shimmer, width: 220, height: 44 }} />
        </div>
        <div style={{ ...shimmer, width: 160, height: 26 }} />
      </div>

      <main style={{ maxWidth: 820, margin: '0 auto', padding: '32px 20px 60px' }}>
        {/* Message d'attente — copy neutre */}
        <div className="ctv3-mono" style={{
          textAlign: 'center', marginBottom: 32,
          fontSize: 10, letterSpacing: '0.14em', color: 'var(--ctv3-faint)', lineHeight: 1.6,
          textTransform: 'uppercase',
        }}>
          <div style={{ display: 'flex', gap: 5, justifyContent: 'center', marginBottom: 12 }}>
            {[0, 1, 2].map((i) => (
              <div key={i} style={{
                width: 5, height: 5, borderRadius: '50%', background: 'var(--ctv3-blue)',
                animation: `ct-dot-blink 1.4s ease-in-out ${i * 0.2}s infinite`,
              }} />
            ))}
          </div>
          Préparation de la fiche destination
        </div>

        {/* Gauge skeleton */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 36 }}>
          <div style={{ ...shimmer, width: 180, height: 180, borderRadius: '50%' }} />
        </div>

        {/* Sous-scores skeleton */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12, marginBottom: 24 }}>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} style={{ ...shimmer, height: 120 }} />
          ))}
        </div>

        {/* Sections skeleton */}
        {[0, 1, 2].map((i) => (
          <div key={i} style={{ ...shimmer, height: 64, marginBottom: 12 }} />
        ))}
      </main>
    </div>
  );
}
