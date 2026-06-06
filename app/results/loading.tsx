// Fallback de chargement natif Next.js — affiché instantanément pendant le SSR
// de /results, avant que ResultsContent (client) ne prenne le relais avec son
// overlay animé + barre de progression. Évite tout écran figé à la navigation.
// FRONT-021 : alignement visuel léger sur la direction FRONT-017. Le globe statique
//   « bleu nuit » antérieur lisait comme une surface plus faible que l'overlay premium
//   qui suit. On garde la même copy et le même langage (dark, accent bleu, dot trio)
//   mais on rend la surface visiblement ACTIVE : halo qui respire + sweep de scan +
//   anneau de scan. Volontairement plus léger que l'overlay FRONT-017 (pas d'image
//   asset, pas d'avion en orbite, pas de progress bar déterministe — réservés à
//   ResultsContent). Aucune logique : composant statique. globals.css interdit ->
//   keyframes spécifiques en <style> local ct021-* ; ct-dot-blink réutilisé (global).
export default function ResultsLoading() {
  return (
    <div className="ctv3" style={{ position: 'relative', minHeight: '100vh', background: 'var(--ctv3-ink-900, #09090b)', overflow: 'hidden' }}>
      {/* Couche active de fond : halo radial bleu qui respire — la surface ne lit plus
          comme une page noire/inerte pendant le flash de navigation. */}
      <div aria-hidden style={{ position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none' }}>
        <div style={{
          position: 'absolute', inset: 0,
          background: 'radial-gradient(110% 60% at 50% 18%, rgba(91,141,239,0.12) 0%, rgba(91,141,239,0.04) 34%, transparent 64%)',
          animation: 'ct021-breathe 4.2s ease-in-out infinite',
        }} />
        {/* Sweep de scan horizontal discret — cue « le système prépare le classement ». */}
        <div style={{
          position: 'absolute', top: 0, bottom: 0, left: 0, width: '38%',
          background: 'linear-gradient(90deg, transparent, rgba(91,141,239,0.07) 45%, rgba(91,141,239,0.11) 50%, rgba(91,141,239,0.07) 55%, transparent)',
          filter: 'blur(1px)',
          animation: 'ct021-scan 3.6s cubic-bezier(0.4,0,0.2,1) infinite',
        }} />
      </div>

      <main style={{
        position: 'relative', zIndex: 1,
        maxWidth: 860, margin: '0 auto', padding: '80px 24px',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 28,
      }}>
        {/* Anneau de scan actif (remplace le globe statique « bleu nuit ») — cohérent
            avec l'atmosphère FRONT-017 sans en dupliquer la scène image. */}
        <div style={{ position: 'relative', width: 108, height: 108 }}>
          {/* Halo doux derrière l'anneau */}
          <div aria-hidden style={{
            position: 'absolute', inset: -16, borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(91,141,239,0.20), transparent 70%)',
            animation: 'ct021-breathe 3.2s ease-in-out infinite',
          }} />
          {/* Anneau pointillé externe en rotation */}
          <div aria-hidden style={{
            position: 'absolute', inset: 0, borderRadius: '50%',
            border: '1px dashed rgba(91,141,239,0.28)',
            animation: 'ct-spin-reverse 18s linear infinite',
          }} />
          {/* Arc actif qui tourne — signal de travail en cours */}
          <div aria-hidden style={{
            position: 'absolute', inset: 10, borderRadius: '50%',
            border: '2px solid transparent',
            borderTopColor: 'var(--ctv3-blue)',
            borderRightColor: 'rgba(91,141,239,0.35)',
            animation: 'ct021-spin 1.15s linear infinite',
            boxShadow: '0 0 24px rgba(91,141,239,0.18)',
          }} />
          {/* Cœur — losange ctv3 (langage de marque, pas de globe daté) */}
          <div aria-hidden style={{
            position: 'absolute', top: '50%', left: '50%', width: 14, height: 14,
            marginTop: -7, marginLeft: -7, background: 'var(--ctv3-blue)',
            transform: 'rotate(45deg)', opacity: 0.9,
            animation: 'ct021-breathe 2.4s ease-in-out infinite',
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
          <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginBottom: 12 }}>
            {[0, 1, 2].map((i) => (
              <div key={i} style={{
                width: 6, height: 6, borderRadius: '50%', background: 'var(--ctv3-blue)',
                boxShadow: '0 0 8px rgba(91,141,239,0.7)',
                animation: `ct-dot-blink 1.25s ease-in-out ${i * 0.18}s infinite`,
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

      {/* Keyframes locales (globals.css interdit). ct-dot-blink / ct-spin-reverse globaux. */}
      <style>{`
        @keyframes ct021-spin { to { transform: rotate(360deg); } }
        @keyframes ct021-breathe { 0%, 100% { opacity: 0.55; } 50% { opacity: 1; } }
        @keyframes ct021-scan {
          0%   { left: -38%; opacity: 0; }
          12%  { opacity: 1; }
          88%  { opacity: 1; }
          100% { left: 100%; opacity: 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          .ctv3 [style*="ct021-spin"],
          .ctv3 [style*="ct021-breathe"],
          .ctv3 [style*="ct021-scan"] { animation: none !important; }
        }
      `}</style>
    </div>
  );
}
