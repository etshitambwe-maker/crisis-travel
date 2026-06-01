// Fallback de chargement natif Next.js pour /destination/[country].
// La page est un Server Component qui exécute scoring + synthèse Claude (plusieurs
// secondes sur cold cache) : sans ce loader, la navigation laissait l'écran figé.
// Skeleton calé sur la structure réelle (hero, gauge, sous-scores) pour limiter le saut visuel.
export default function DestinationLoading() {
  const shimmer = {
    background: 'linear-gradient(90deg, #0d0d14 0%, #16161f 50%, #0d0d14 100%)',
    backgroundSize: '200% 100%',
    animation: 'ct-shimmer 1.4s ease-in-out infinite',
    borderRadius: 8,
  } as const;

  return (
    <div style={{ minHeight: '100vh', background: '#07070c' }}>
      {/* Hero skeleton */}
      <div style={{
        width: '100%', minHeight: 220,
        background: 'linear-gradient(135deg, rgba(74,158,255,0.06), #07070c 100%)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: '32px 20px 24px', gap: 16, borderBottom: '1px solid #1f1f30',
      }}>
        <div style={{ ...shimmer, width: 120, height: 80, borderRadius: 6 }} />
        <div style={{ ...shimmer, width: 200, height: 32 }} />
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ ...shimmer, width: 90, height: 26 }} />
          <div style={{ ...shimmer, width: 90, height: 26 }} />
        </div>
      </div>

      <main style={{ maxWidth: 800, margin: '0 auto', padding: '24px 20px 60px' }}>
        {/* Message d'attente prudent */}
        <div style={{
          textAlign: 'center', marginBottom: 28,
          fontFamily: 'var(--font-space-mono), monospace',
          fontSize: 10, letterSpacing: '0.12em', color: '#6b6b85', lineHeight: 1.6,
        }}>
          <div style={{ display: 'flex', gap: 5, justifyContent: 'center', marginBottom: 10 }}>
            {[0, 1, 2].map((i) => (
              <div key={i} style={{
                width: 5, height: 5, borderRadius: '50%', background: '#4a9eff',
                animation: `ct-dot-blink 1.4s ease-in-out ${i * 0.2}s infinite`,
              }} />
            ))}
          </div>
          ANALYSE DE LA DESTINATION EN COURS — quelques instants selon les sources disponibles.
        </div>

        {/* Gauge skeleton */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 28 }}>
          <div style={{ ...shimmer, width: 180, height: 180, borderRadius: '50%' }} />
        </div>

        {/* Sous-scores skeleton (2×2) */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginBottom: 20 }}>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} style={{ ...shimmer, height: 110 }} />
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
