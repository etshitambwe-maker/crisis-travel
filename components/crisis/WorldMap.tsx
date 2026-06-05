'use client';

type Marker = { name: string; score: number; coords: [number, number] };

const MARKERS: Marker[] = [
  { name: 'Portugal', score: 88, coords: [-9.14, 38.72] },
  { name: 'Grèce',   score: 82, coords: [23.73, 37.98] },
  { name: 'Maroc',   score: 71, coords: [-6.83, 34.02] },
  { name: 'Japon',   score: 76, coords: [139.65, 35.68] },
  { name: 'Égypte',  score: 42, coords: [31.23, 30.04] },
  { name: 'Thaïlande', score: 74, coords: [100.5, 13.75] },
  { name: 'Mexique', score: 48, coords: [-99.13, 19.43] },
  { name: 'Géorgie', score: 79, coords: [44.83, 41.69] },
  { name: 'Vietnam', score: 77, coords: [105.84, 21.02] },
  { name: 'Albanie', score: 73, coords: [19.82, 41.33] },
];

function scoreColor(s: number) {
  if (s >= 80) return 'var(--ctv3-ideal)';
  if (s >= 60) return 'var(--ctv3-reco)';
  if (s >= 40) return 'var(--ctv3-poss)';
  return 'var(--ctv3-deco)';
}
function glowId(s: number) {
  if (s >= 80) return 'glow-safe';
  if (s < 40) return 'glow-danger';
  return 'glow-warn';
}

function project(lon: number, lat: number) {
  const x = ((lon + 180) / 360) * 800;
  const y = ((90 - lat) / 180) * 400;
  return { x, y };
}

/**
 * `showScores` (FRONT-002): the per-marker score numbers in MARKERS are
 * illustrative, not live scoring output. On the homepage we render the map as
 * an ambient editorial visual with `showScores={false}` so no non-live number
 * is shown. Real scoring lives in /api/analyze → /results (untouched here).
 */
export function WorldMap({ markers = MARKERS, showScores = true }: { markers?: Marker[]; showScores?: boolean }) {
  return (
    <div style={{
      position: 'relative', width: '100%', aspectRatio: '2/1',
      overflow: 'hidden', borderRadius: 12,
      background: 'radial-gradient(120% 140% at 50% 18%, var(--ctv3-ink-850), var(--ctv3-ink-950) 70%)',
      border: '1px solid var(--ctv3-line)',
    }}>
      <svg viewBox="0 0 800 400" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} preserveAspectRatio="xMidYMid meet">
        <defs>
          {/* Veille grid: fine lines + intersection ticks, faded toward edges via mask */}
          <pattern id="wm-grid" width="50" height="50" patternUnits="userSpaceOnUse">
            <path d="M 50 0 L 0 0 0 50" fill="none" stroke="var(--ctv3-line-soft)" strokeWidth="0.5"/>
            <path d="M 0 0 L 2 0 M 0 0 L 0 2" stroke="var(--ctv3-line)" strokeWidth="0.6" opacity="0.7"/>
          </pattern>
          {/* Radial mask: grid bright at center, dissolves at the edges */}
          <radialGradient id="wm-grid-fade" cx="50%" cy="42%" r="62%">
            <stop offset="0%" stopColor="#fff" stopOpacity="0.5"/>
            <stop offset="60%" stopColor="#fff" stopOpacity="0.22"/>
            <stop offset="100%" stopColor="#fff" stopOpacity="0"/>
          </radialGradient>
          <mask id="wm-grid-mask">
            <rect width="800" height="400" fill="url(#wm-grid-fade)"/>
          </mask>
          {/* Depth vignette */}
          <radialGradient id="wm-vignette" cx="50%" cy="38%" r="75%">
            <stop offset="0%" stopColor="#000" stopOpacity="0"/>
            <stop offset="78%" stopColor="#000" stopOpacity="0"/>
            <stop offset="100%" stopColor="#06060a" stopOpacity="0.85"/>
          </radialGradient>
          {/* Soft sensor-glow blur for marker halos */}
          <filter id="wm-soft" x="-120%" y="-120%" width="340%" height="340%">
            <feGaussianBlur stdDeviation="6"/>
          </filter>
          {/* stopColor uses hex aligned on .ctv3 tokens (var() is unreliable inside
              SVG <stop> depending on render context — documented fallback FRONT-012).
              #46b888=--ctv3-ideal · #d8a83e=--ctv3-reco · #d9742e=--ctv3-poss · #e4332b=--ctv3-deco/red */}
          <radialGradient id="glow-safe" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#46b888" stopOpacity="0.45"/>
            <stop offset="100%" stopColor="#46b888" stopOpacity="0"/>
          </radialGradient>
          <radialGradient id="glow-warn" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#d8a83e" stopOpacity="0.42"/>
            <stop offset="100%" stopColor="#d8a83e" stopOpacity="0"/>
          </radialGradient>
          <radialGradient id="glow-danger" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#e4332b" stopOpacity="0.5"/>
            <stop offset="100%" stopColor="#e4332b" stopOpacity="0"/>
          </radialGradient>
        </defs>

        {/* Grid backdrop (masked to fade at edges) */}
        <rect width="800" height="400" fill="url(#wm-grid)" mask="url(#wm-grid-mask)"/>

        {/* Simplified continents — subtle landmass with faint edge light */}
        <g opacity="0.22" fill="var(--ctv3-ink-700)" stroke="var(--ctv3-line-bright)" strokeWidth="0.6" strokeOpacity="0.5">
          <path d="M 120 100 Q 160 80 200 95 Q 240 110 260 140 Q 250 175 220 190 Q 180 200 150 180 Q 125 155 120 100 Z"/>
          <path d="M 220 220 Q 245 215 260 240 Q 265 280 250 320 Q 235 340 225 335 Q 215 310 215 270 Q 218 240 220 220 Z"/>
          <path d="M 380 110 Q 420 100 440 115 Q 445 135 430 150 Q 405 155 385 145 Q 375 130 380 110 Z"/>
          <path d="M 400 180 Q 440 175 460 200 Q 475 250 460 290 Q 440 315 415 310 Q 395 285 395 240 Q 398 205 400 180 Z"/>
          <path d="M 470 100 Q 550 85 620 105 Q 660 125 670 160 Q 655 190 610 195 Q 560 198 510 180 Q 475 150 470 100 Z"/>
          <path d="M 550 180 Q 575 175 585 195 Q 588 220 575 230 Q 560 225 552 210 Q 548 195 550 180 Z"/>
          <path d="M 610 210 Q 640 215 650 235 Q 645 255 625 260 Q 608 250 605 230 Q 607 218 610 210 Z"/>
          <path d="M 640 290 Q 680 285 700 305 Q 705 325 685 335 Q 655 335 640 320 Q 635 300 640 290 Z"/>
        </g>

        {/* Markers — integrated sensor signals */}
        {markers.map((m, i) => {
          const { x, y } = project(m.coords[0], m.coords[1]);
          const color = scoreColor(m.score);
          const glow = glowId(m.score);
          return (
            <g key={i}>
              {/* Soft blurred halo — breathes via opacity, not radius (less gadgety) */}
              <circle cx={x} cy={y} r="24" fill={`url(#${glow})`} filter="url(#wm-soft)">
                <animate attributeName="opacity" values="0.55;1;0.55" dur="4.5s" repeatCount="indefinite" begin={`${i * 0.5}s`}/>
              </circle>
              {/* Thin outer ring for definition */}
              <circle cx={x} cy={y} r="7" fill="none" stroke={color} strokeWidth="1" strokeOpacity="0.35"/>
              {/* Crisp core */}
              <circle cx={x} cy={y} r="3.2" fill={color} stroke="var(--ctv3-ink-950)" strokeWidth="1"/>
              {showScores && (
                <text x={x} y={y - 12} fill={color} fontSize="9" fontFamily="monospace" textAnchor="middle" fontWeight="700" letterSpacing="1">
                  {m.score}
                </text>
              )}
            </g>
          );
        })}

        {/* Depth vignette on top */}
        <rect width="800" height="400" fill="url(#wm-vignette)" pointerEvents="none"/>
      </svg>
    </div>
  );
}
