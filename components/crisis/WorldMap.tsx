'use client';

/**
 * FRONT-016 — Image-based WorldMap.
 *
 * Product decision (supersedes the FRONT-015 coded-SVG dashboard): integrate
 * the real reference image as the primary visual layer rather than recreating
 * it in SVG. Fidelity to the provided image is the priority, so the previous
 * SVG geometry, markers, arcs and HUD were removed — the image already carries
 * all of that, with photographic richness an inline SVG cannot match.
 *
 * The asset lives at public/images/worldmap-dashboard-reference.png and is
 * served statically by Next (no next/image, no dependency). Only light premium
 * framing is layered on top (border, vignette, bottom integration veil) so the
 * map blends into the Crisis Travel dark identity without fighting the image.
 *
 * Props: the public signature stays backward-compatible with the existing
 * call-site `<WorldMap showScores={false}/>` in app/page.tsx (which is NOT
 * modified). The props are accepted but intentionally unused now that the
 * visual is a static image — kept only so the call-site keeps type-checking.
 */
export function WorldMap(_props: { markers?: unknown; showScores?: boolean } = {}) {
  return (
    <div style={{
      position: 'relative', width: '100%', aspectRatio: '16/9',
      overflow: 'hidden', borderRadius: 12,
      background: 'var(--ctv3-ink-950)',
      border: '1px solid var(--ctv3-line)',
      // Subtle outer depth so the panel reads as an integrated Crisis Travel
      // surface rather than a pasted illustration.
      boxShadow: '0 0 0 1px rgba(0,0,0,0.4), inset 0 0 60px rgba(0,0,0,0.5)',
    }}>
      {/* Primary visual layer — the real geopolitical-dashboard reference. */}
      <img
        src="/images/worldmap-dashboard-reference.png"
        alt="Carte mondiale des destinations — tableau de bord géopolitique"
        loading="lazy"
        decoding="async"
        style={{
          position: 'absolute', inset: 0,
          width: '100%', height: '100%',
          objectFit: 'cover', objectPosition: 'center',
          display: 'block',
        }}
      />

      {/* Edge vignette — soft, aligned on the image's own dark borders. */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'radial-gradient(120% 130% at 50% 42%, transparent 62%, rgba(6,6,10,0.55) 100%)',
      }}/>

      {/* Bottom integration veil — lets the panel fade into the page flow. */}
      <div style={{
        position: 'absolute', insetInline: 0, bottom: 0, height: '22%', pointerEvents: 'none',
        background: 'linear-gradient(to top, rgba(6,6,10,0.45), transparent)',
      }}/>
    </div>
  );
}
