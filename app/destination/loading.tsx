// Fallback de chargement natif Next.js pour /destination/[country].
// La page est un Server Component qui exécute scoring + synthèse Claude (plusieurs
// secondes sur cold cache) : sans ce loader, la navigation laissait l'écran figé.
// Skeleton calé sur la structure réelle (hero, gauge, sous-scores) pour limiter le saut visuel.
// FRONT-004 : aligné au système ctv3 (tokens, copy neutre).
// FRONT-018 : restyle « loader visiblement actif ». Le fond #09090b lisait comme une
//   page noire/bug pendant l'attente. On garde la structure skeleton mais on ajoute une
//   couche active premium (scan/glow discret, shimmer renforcé, halo de gauge, titre +
//   sous-texte lisibles) pour signaler clairement « préparation en cours », sans tomber
//   dans le cinématique de FRONT-017 (scan du monde). globals.css interdit -> keyframes
//   spécifiques injectées via <style> local ct018-* ; ct-shimmer / ct-dot-blink réutilisés.
export default function DestinationLoading() {
  const shimmer = {
    background:
      'linear-gradient(90deg, var(--ctv3-ink-800) 0%, var(--ctv3-ink-700) 45%, var(--ctv3-line) 50%, var(--ctv3-ink-700) 55%, var(--ctv3-ink-800) 100%)',
    backgroundSize: '200% 100%',
    animation: 'ct-shimmer 1.25s ease-in-out infinite',
    border: '1px solid var(--ctv3-line-soft)',
  } as const;

  return (
    <div className="ctv3" style={{ position: 'relative', minHeight: '100vh', background: 'var(--ctv3-ink-900)', overflow: 'hidden' }}>
      {/* ── Couche active globale : halo radial qui respire + sweep de scan vertical ── */}
      {/* Discret, derrière le skeleton, pour que le fond ne lise plus comme « noir mort ». */}
      <div aria-hidden style={{ position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none' }}>
        <div
          style={{
            position: 'absolute', inset: 0,
            background:
              'radial-gradient(120% 70% at 50% 0%, rgba(91,141,239,0.10) 0%, rgba(91,141,239,0.035) 32%, transparent 62%)',
            animation: 'ct018-breathe 4.2s ease-in-out infinite',
          }}
        />
        <div
          style={{
            position: 'absolute', left: 0, right: 0, height: 180,
            background: 'linear-gradient(180deg, transparent, rgba(91,141,239,0.07) 45%, rgba(91,141,239,0.12) 50%, rgba(91,141,239,0.07) 55%, transparent)',
            filter: 'blur(2px)',
            animation: 'ct018-scan 3.4s cubic-bezier(0.4,0,0.2,1) infinite',
          }}
        />
      </div>

      {/* Hero skeleton */}
      <div style={{
        position: 'relative', zIndex: 1,
        width: '100%', minHeight: 300,
        background: 'linear-gradient(135deg, var(--ctv3-ink-800), var(--ctv3-ink-900) 100%)',
        display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
        maxWidth: 820, margin: '0 auto', padding: '0 20px 26px', gap: 14,
        borderBottom: '1px solid var(--ctv3-line)',
      }}>
        <div style={{ ...shimmer, width: 140, height: 14 }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ ...shimmer, width: 48, height: 32 }} />
          <div style={{ ...shimmer, width: 220, height: 44 }} />
        </div>
        <div style={{ ...shimmer, width: 160, height: 26 }} />
      </div>

      <main style={{ position: 'relative', zIndex: 1, maxWidth: 820, margin: '0 auto', padding: '32px 20px 60px' }}>
        {/* Bandeau d'attente — titre + sous-texte lisibles, statut actif explicite */}
        <div style={{
          textAlign: 'center', marginBottom: 36,
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
        }}>
          {/* Statut : trio de dots + libellé mono, contraste renforcé */}
          <div className="ctv3-mono" style={{
            display: 'inline-flex', alignItems: 'center', gap: 9,
            padding: '7px 14px',
            border: '1px solid var(--ctv3-line-bright)',
            background: 'var(--ctv3-ink-850)',
            fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase',
            color: 'var(--ctv3-paper)',
          }}>
            <span style={{ display: 'inline-flex', gap: 5 }}>
              {[0, 1, 2].map((i) => (
                <span key={i} style={{
                  width: 6, height: 6, borderRadius: '50%', background: 'var(--ctv3-blue)',
                  boxShadow: '0 0 8px rgba(91,141,239,0.7)',
                  animation: `ct-dot-blink 1.25s ease-in-out ${i * 0.18}s infinite`,
                }} />
              ))}
            </span>
            Analyse en cours
          </div>

          {/* Titre — promu en vrai heading lisible (était une micro-caption) */}
          <h1 style={{
            fontFamily: 'var(--ctv3-display)', fontWeight: 900,
            fontSize: 'clamp(22px, 4.5vw, 30px)', letterSpacing: '-0.03em',
            color: 'var(--ctv3-paper)', lineHeight: 1.1, margin: 0,
          }}>
            Préparation de la fiche destination
          </h1>

          {/* Sous-texte — rassurant, explicite */}
          <p className="ctv3-serif" style={{
            color: 'var(--ctv3-muted)', fontSize: 14.5, lineHeight: 1.55,
            maxWidth: 420, margin: 0,
          }}>
            Nous croisons les signaux disponibles pour construire une recommandation lisible.
          </p>

          {/* Barre de progression indéterminée — signal d'activité supplémentaire */}
          <div style={{
            width: 'min(280px, 70vw)', height: 3, marginTop: 4,
            background: 'var(--ctv3-ink-750)', overflow: 'hidden', borderRadius: 2,
          }}>
            <div style={{
              height: '100%', width: '40%',
              background: 'linear-gradient(90deg, transparent, var(--ctv3-blue), transparent)',
              animation: 'ct018-progress 1.6s ease-in-out infinite',
            }} />
          </div>
        </div>

        {/* Gauge skeleton — halo actif autour de l'anneau */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 36 }}>
          <div style={{ position: 'relative', width: 180, height: 180 }}>
            <div aria-hidden style={{
              position: 'absolute', inset: -14, borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(91,141,239,0.16), transparent 70%)',
              animation: 'ct018-breathe 3.2s ease-in-out infinite',
            }} />
            <div style={{
              ...shimmer,
              position: 'relative', width: 180, height: 180, borderRadius: '50%',
            }} />
          </div>
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

      {/* Keyframes locales (globals.css interdit). ct-shimmer / ct-dot-blink déjà globaux. */}
      <style>{`
        @keyframes ct018-scan {
          0%   { top: -180px; opacity: 0; }
          12%  { opacity: 1; }
          88%  { opacity: 1; }
          100% { top: 100%; opacity: 0; }
        }
        @keyframes ct018-breathe {
          0%, 100% { opacity: 0.55; }
          50%      { opacity: 1; }
        }
        @keyframes ct018-progress {
          0%   { transform: translateX(-120%); }
          100% { transform: translateX(320%); }
        }
        @media (prefers-reduced-motion: reduce) {
          .ctv3 [style*="ct018-scan"],
          .ctv3 [style*="ct018-breathe"],
          .ctv3 [style*="ct018-progress"] { animation: none !important; }
        }
      `}</style>
    </div>
  );
}
