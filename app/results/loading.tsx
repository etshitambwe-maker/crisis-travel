// Fallback de chargement natif Next.js — affiché instantanément pendant le SSR
// de /results, avant que ResultsContent (client) ne prenne le relais avec son
// overlay animé + barre de progression. Évite tout écran figé à la navigation.
export default function ResultsLoading() {
  return (
    <div className="ctv3" style={{ minHeight: '100vh', background: 'var(--ctv3-ink-900, #09090b)' }}>
      <main style={{
        maxWidth: 860, margin: '0 auto', padding: '80px 24px',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 28,
      }}>
        {/* Globe statique (même langage visuel que l'overlay ResultsContent) */}
        <div style={{ position: 'relative', width: 100, height: 100 }}>
          <div style={{
            position: 'absolute', inset: -8, borderRadius: '50%',
            border: '1px dashed rgba(91,141,239,0.2)',
            animation: 'ct-spin-reverse 20s linear infinite',
          }} />
          <div style={{
            width: 100, height: 100, borderRadius: '50%',
            background: 'radial-gradient(circle at 35% 35%, #1a3a6e, #0a1a3a 60%, #060e1f)',
            border: '1.5px solid rgba(91,141,239,0.35)',
            animation: 'ct-globe-pulse 3s ease-in-out infinite',
            boxShadow: '0 0 40px rgba(91,141,239,0.15), inset 0 0 30px rgba(0,0,0,0.5)',
          }} />
        </div>

        <div style={{ textAlign: 'center' }}>
          <div
            className="ctv3-mono"
            style={{
              fontSize: 13, letterSpacing: '0.2em', textTransform: 'uppercase',
              fontWeight: 700, color: 'var(--ctv3-paper)', marginBottom: 10,
            }}
          >
            Préparation de l&apos;analyse
          </div>
          <div style={{ display: 'flex', gap: 5, justifyContent: 'center', marginBottom: 12 }}>
            {[0, 1, 2].map((i) => (
              <div key={i} style={{
                width: 5, height: 5, borderRadius: '50%', background: 'var(--ctv3-blue)',
                animation: `ct-dot-blink 1.4s ease-in-out ${i * 0.2}s infinite`,
              }} />
            ))}
          </div>
          <div
            className="ctv3-mono"
            style={{ fontSize: 10, letterSpacing: '0.1em', color: 'var(--ctv3-faint)', maxWidth: 320, lineHeight: 1.6 }}
          >
            Le classement se construit à partir des signaux disponibles.
          </div>
        </div>
      </main>
    </div>
  );
}
