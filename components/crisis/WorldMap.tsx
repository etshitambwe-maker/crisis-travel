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
 * FRONT-015 — Cinematic geopolitical-dashboard redesign.
 *
 * Direction (from the reference brief, no image asset, fully coded SVG):
 *   deep navy/near-black atmosphere · luminous dimensional continents ·
 *   global connectivity arcs · discreet HUD language · hot/cold amber+cyan
 *   accents over a preserved score semantic. "Mission control" energy.
 *
 * Hybrid marker colour (locked Gate 1 arbitration): scoreColor()/glowId() and
 * the tier mapping are UNCHANGED — the safe/warning/danger reading is kept.
 * The amber/cyan duo enriches atmosphere, arcs, HUD and marker halos; it never
 * overrides the score meaning.
 *
 * Logic preserved verbatim: Marker type, MARKERS, project(), scoreColor(),
 * glowId(), and the public prop contract { markers, showScores }.
 *
 * `showScores` (FRONT-002): the per-marker score numbers in MARKERS are
 * illustrative, not live scoring output. On the homepage we render the map as
 * an ambient editorial visual with `showScores={false}` so no non-live number
 * is shown. Real scoring lives in /api/analyze → /results (untouched here).
 */

// Connectivity arcs: a curated, non-cluttered set of "travel flows" between
// existing marker coordinates. Each pair indexes into the markers array so the
// arcs always land on real, projected nodes (no invented geography).
const ARC_PAIRS: [number, number][] = [
  [0, 1], // Portugal → Grèce
  [0, 6], // Portugal → Mexique
  [1, 7], // Grèce → Géorgie
  [3, 8], // Japon → Vietnam
  [5, 3], // Thaïlande → Japon
  [9, 4], // Albanie → Égypte
  [2, 5], // Maroc → Thaïlande
];

// Quadratic arc that bows away from the equator-ish midline, giving the
// "great-circle / flight-path" feel without a real geodesic projection.
function arcPath(ax: number, ay: number, bx: number, by: number) {
  const mx = (ax + bx) / 2;
  const my = (ay + by) / 2;
  const dist = Math.hypot(bx - ax, by - ay);
  // Lift the control point upward (toward the top of the frame), proportional
  // to span, so longer routes arc higher — reads as global connectivity.
  const lift = Math.min(dist * 0.32, 70);
  return `M ${ax} ${ay} Q ${mx} ${my - lift} ${bx} ${by}`;
}

export function WorldMap({ markers = MARKERS, showScores = true }: { markers?: Marker[]; showScores?: boolean }) {
  return (
    <div style={{
      position: 'relative', width: '100%', aspectRatio: '2/1',
      overflow: 'hidden', borderRadius: 12,
      // Layered atmosphere: warm horizon glow high-left, cool depth low-right,
      // over a near-black navy base — cinematic, not a single flat wash.
      background:
        'radial-gradient(120% 90% at 22% 8%, rgba(217,116,46,0.10), transparent 46%),' +
        'radial-gradient(130% 120% at 82% 96%, rgba(91,141,239,0.12), transparent 52%),' +
        'radial-gradient(120% 140% at 50% 16%, var(--ctv3-ink-850), var(--ctv3-ink-950) 72%)',
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
            <stop offset="74%" stopColor="#000" stopOpacity="0"/>
            <stop offset="100%" stopColor="#06060a" stopOpacity="0.88"/>
          </radialGradient>
          {/* Soft sensor-glow blur for marker halos */}
          <filter id="wm-soft" x="-120%" y="-120%" width="340%" height="340%">
            <feGaussianBlur stdDeviation="6"/>
          </filter>
          {/* Continent coastline glow — gives landmasses dimension/luminescence */}
          <filter id="wm-coast" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="2.4"/>
          </filter>

          {/* Continent body gradient: a dimensional slate that catches a faint
              cool light at top, deepening to navy below — premium, not flat. */}
          <linearGradient id="wm-land" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#33333f"/>
            <stop offset="55%" stopColor="#262630"/>
            <stop offset="100%" stopColor="#1b1b23"/>
          </linearGradient>

          {/* Hot/cold connectivity gradient — cyan origin → amber destination.
              The amber/cyan duo from the reference, applied to flows not scores. */}
          <linearGradient id="wm-arc" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#5b8def" stopOpacity="0"/>
            <stop offset="22%" stopColor="#5b8def" stopOpacity="0.7"/>
            <stop offset="78%" stopColor="#d9742e" stopOpacity="0.7"/>
            <stop offset="100%" stopColor="#d9742e" stopOpacity="0"/>
          </linearGradient>

          {/* stopColor uses hex aligned on .ctv3 tokens (var() is unreliable inside
              SVG <stop> depending on render context — documented fallback FRONT-012).
              #46b888=--ctv3-ideal · #d8a83e=--ctv3-reco · #d9742e=--ctv3-poss · #e4332b=--ctv3-deco/red */}
          {/* FIX-2: halos calmed one notch so the map reads before the signals. */}
          <radialGradient id="glow-safe" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#46b888" stopOpacity="0.38"/>
            <stop offset="100%" stopColor="#46b888" stopOpacity="0"/>
          </radialGradient>
          <radialGradient id="glow-warn" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#d8a83e" stopOpacity="0.35"/>
            <stop offset="100%" stopColor="#d8a83e" stopOpacity="0"/>
          </radialGradient>
          <radialGradient id="glow-danger" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#e4332b" stopOpacity="0.42"/>
            <stop offset="100%" stopColor="#e4332b" stopOpacity="0"/>
          </radialGradient>
          {/* Cool ambient ring shared by every hub — the "cold" half of the
              hot/cold duo, layered UNDER the score-coloured core so the safe/
              warn/danger reading is never lost (hybrid arbitration). */}
          <radialGradient id="wm-hub-cool" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#5b8def" stopOpacity="0"/>
            <stop offset="62%" stopColor="#5b8def" stopOpacity="0.32"/>
            <stop offset="100%" stopColor="#5b8def" stopOpacity="0"/>
          </radialGradient>
        </defs>

        {/* Grid backdrop (masked to fade at edges) */}
        <rect width="800" height="400" fill="url(#wm-grid)" mask="url(#wm-grid-mask)"/>

        {/* World continents — low-poly silhouette, georeferenced to project()'s
            equirectangular frame (x=(lon+180)/360*800, y=(90-lat)/180*400) so
            landmasses sit under their real markers. Recognisable, not detailed.
            FRONT-015: a blurred coastline-glow pass below + a dimensional
            gradient body above gives luminous, premium landmasses while the
            SAME path geometry as FRONT-012-FIX keeps continents recognisable. */}
        {/* Coastline luminescence (blurred underlay) */}
        <g filter="url(#wm-coast)" fill="none" stroke="#5b6a82" strokeWidth="1.4" strokeOpacity="0.5" strokeLinejoin="round">
          <use href="#wm-continents"/>
        </g>
        {/* Continent bodies (sharp, dimensional gradient + warm rim light) */}
        <g id="wm-continents" fill="url(#wm-land)" stroke="#5a5466" strokeWidth="0.9" strokeOpacity="0.9" strokeLinejoin="round" opacity="0.92">
          {/* North America */}
          <path d="M 33 56 L 92 44 L 175 50 L 250 60 L 278 84 L 250 104 L 262 120 L 232 132 L 220 150 L 200 150 L 196 166 L 178 150 L 160 120 L 120 104 L 96 92 L 60 78 Z"/>
          {/* Central America bridge */}
          <path d="M 196 166 L 212 162 L 226 178 L 240 192 L 232 200 L 218 188 L 206 176 Z"/>
          {/* South America */}
          <path d="M 240 192 L 268 184 L 290 196 L 304 224 L 322 218 L 314 250 L 296 286 L 272 312 L 252 322 L 246 300 L 256 268 L 246 232 L 236 208 Z"/>
          {/* Europe */}
          <path d="M 374 116 L 392 100 L 404 86 L 420 70 L 438 64 L 448 78 L 436 92 L 452 96 L 470 88 L 492 84 L 500 104 L 478 116 L 456 124 L 432 128 L 410 128 L 390 126 L 378 124 Z"/>
          {/* Africa */}
          <path d="M 364 168 L 392 150 L 422 124 L 446 132 L 470 150 L 500 158 L 514 176 L 500 196 L 480 220 L 466 252 L 444 276 L 428 262 L 420 230 L 404 204 L 384 188 L 370 180 Z"/>
          {/* Asia */}
          <path d="M 492 84 L 533 67 L 590 58 L 650 56 L 720 52 L 778 49 L 760 78 L 712 88 L 690 104 L 712 116 L 690 128 L 650 122 L 633 140 L 660 156 L 633 173 L 612 162 L 600 180 L 573 186 L 558 164 L 540 150 L 558 130 L 540 114 L 512 108 L 498 100 Z"/>
          {/* SE Asia / Indonesia islets */}
          <path d="M 612 188 L 640 184 L 668 192 L 690 200 L 672 212 L 644 206 L 620 200 Z"/>
          {/* Oceania / Australia */}
          <path d="M 655 249 L 690 238 L 728 244 L 740 262 L 730 280 L 707 284 L 684 276 L 662 264 Z"/>
        </g>

        {/* Connectivity arcs — global travel flows between real marker nodes.
            Hot/cold cyan→amber gradient; a faint static base + an animated
            travelling dash that reads as a moving signal. Capped at ARC_PAIRS
            so the map stays analytical, never cluttered. */}
        <g fill="none" strokeLinecap="round">
          {ARC_PAIRS.map(([ai, bi], i) => {
            const a = markers[ai];
            const b = markers[bi];
            if (!a || !b) return null;
            const pa = project(a.coords[0], a.coords[1]);
            const pb = project(b.coords[0], b.coords[1]);
            const d = arcPath(pa.x, pa.y, pb.x, pb.y);
            return (
              <g key={`arc-${i}`}>
                {/* Static route — present enough to read as connectivity at full
                    homepage width, still elegant (hot/cold cyan→amber). */}
                <path d={d} stroke="url(#wm-arc)" strokeWidth="1.3" strokeOpacity="0.85"/>
                {/* Travelling signal pulse — denser dash so a moving dot is
                    always visible somewhere along the route. */}
                <path d={d} stroke="url(#wm-arc)" strokeWidth="2.2" strokeDasharray="10 70" strokeOpacity="1">
                  <animate attributeName="stroke-dashoffset" from="80" to="0" dur={`${5 + (i % 3)}s`} repeatCount="indefinite" begin={`${i * 0.7}s`}/>
                </path>
              </g>
            );
          })}
        </g>

        {/* Markers — integrated sensor signals (hybrid colour: score-coloured
            core kept verbatim, wrapped in a cool ambient ring for the hot/cold
            atmosphere). */}
        {markers.map((m, i) => {
          const { x, y } = project(m.coords[0], m.coords[1]);
          const color = scoreColor(m.score);
          const glow = glowId(m.score);
          return (
            <g key={i}>
              {/* Cool ambient ring — the "cold" half of the duo, under the core */}
              <circle cx={x} cy={y} r="13" fill="url(#wm-hub-cool)"/>
              {/* Soft blurred halo — score-coloured. Breathes via opacity. */}
              <circle cx={x} cy={y} r="18" fill={`url(#${glow})`} filter="url(#wm-soft)">
                <animate attributeName="opacity" values="0.45;0.85;0.45" dur="4.5s" repeatCount="indefinite" begin={`${i * 0.5}s`}/>
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

        {/* ── HUD layer — discreet "mission control" framing. Corner reticles +
            a coordinate scale + a small radar widget. Low opacity, periphery
            only, so it reinforces the geopolitical-data feel without clutter. */}
        <g stroke="var(--ctv3-line-bright)" fill="none" opacity="0.6" pointerEvents="none">
          {/* Corner reticles */}
          <path d="M 14 14 H 40 M 14 14 V 40" strokeWidth="1"/>
          <path d="M 786 14 H 760 M 786 14 V 40" strokeWidth="1"/>
          <path d="M 14 386 H 40 M 14 386 V 360" strokeWidth="1"/>
          <path d="M 786 386 H 760 M 786 386 V 360" strokeWidth="1"/>
          {/* Top coordinate ticks */}
          <g strokeWidth="0.8" opacity="0.7">
            <path d="M 200 14 V 20 M 400 14 V 22 M 600 14 V 20"/>
          </g>
        </g>
        {/* Coordinate labels — mono, faint, evoke a tracking console */}
        <g fill="var(--ctv3-faint)" fontFamily="monospace" fontSize="7" letterSpacing="1.5" opacity="0.75" pointerEvents="none">
          <text x="48" y="28">LON/LAT · LIVE</text>
          <text x="752" y="28" textAnchor="end">GEO·INTEL</text>
          <text x="400" y="30" textAnchor="middle">0°</text>
        </g>
        {/* Small radar widget bottom-left — purely decorative HUD accent */}
        <g transform="translate(46 350)" pointerEvents="none">
          <circle r="20" fill="none" stroke="var(--ctv3-line-bright)" strokeWidth="0.8" opacity="0.55"/>
          <circle r="12" fill="none" stroke="var(--ctv3-line-bright)" strokeWidth="0.6" opacity="0.4"/>
          <line x1="-20" y1="0" x2="20" y2="0" stroke="var(--ctv3-line-bright)" strokeWidth="0.5" opacity="0.35"/>
          <line x1="0" y1="-20" x2="0" y2="20" stroke="var(--ctv3-line-bright)" strokeWidth="0.5" opacity="0.35"/>
          {/* Sweeping radar arm */}
          <line x1="0" y1="0" x2="0" y2="-20" stroke="#5b8def" strokeWidth="1" strokeOpacity="0.7">
            <animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="6s" repeatCount="indefinite"/>
          </line>
          <circle r="1.6" fill="#5b8def" fillOpacity="0.8"/>
        </g>

        {/* Depth vignette on top */}
        <rect width="800" height="400" fill="url(#wm-vignette)" pointerEvents="none"/>
      </svg>
    </div>
  );
}
