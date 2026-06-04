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
  if (s >= 80) return '#3ddc97';
  if (s >= 60) return '#ffb224';
  if (s >= 40) return '#ff8c42';
  return '#ff3b2f';
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
      background: 'linear-gradient(180deg, #0d0d18, #07070c)',
      border: '1px solid #1f1f30',
    }}>
      <svg viewBox="0 0 800 400" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} preserveAspectRatio="xMidYMid meet">
        <defs>
          <pattern id="wm-grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#1a1a2e" strokeWidth="0.5" opacity="0.5"/>
          </pattern>
          <radialGradient id="glow-safe" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#3ddc97" stopOpacity="0.6"/>
            <stop offset="100%" stopColor="#3ddc97" stopOpacity="0"/>
          </radialGradient>
          <radialGradient id="glow-warn" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ffb224" stopOpacity="0.6"/>
            <stop offset="100%" stopColor="#ffb224" stopOpacity="0"/>
          </radialGradient>
          <radialGradient id="glow-danger" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ff3b2f" stopOpacity="0.7"/>
            <stop offset="100%" stopColor="#ff3b2f" stopOpacity="0"/>
          </radialGradient>
        </defs>

        {/* Grid backdrop */}
        <rect width="800" height="400" fill="url(#wm-grid)"/>

        {/* Simplified continents */}
        <g opacity="0.3" fill="#2a2a42">
          <path d="M 120 100 Q 160 80 200 95 Q 240 110 260 140 Q 250 175 220 190 Q 180 200 150 180 Q 125 155 120 100 Z"/>
          <path d="M 220 220 Q 245 215 260 240 Q 265 280 250 320 Q 235 340 225 335 Q 215 310 215 270 Q 218 240 220 220 Z"/>
          <path d="M 380 110 Q 420 100 440 115 Q 445 135 430 150 Q 405 155 385 145 Q 375 130 380 110 Z"/>
          <path d="M 400 180 Q 440 175 460 200 Q 475 250 460 290 Q 440 315 415 310 Q 395 285 395 240 Q 398 205 400 180 Z"/>
          <path d="M 470 100 Q 550 85 620 105 Q 660 125 670 160 Q 655 190 610 195 Q 560 198 510 180 Q 475 150 470 100 Z"/>
          <path d="M 550 180 Q 575 175 585 195 Q 588 220 575 230 Q 560 225 552 210 Q 548 195 550 180 Z"/>
          <path d="M 610 210 Q 640 215 650 235 Q 645 255 625 260 Q 608 250 605 230 Q 607 218 610 210 Z"/>
          <path d="M 640 290 Q 680 285 700 305 Q 705 325 685 335 Q 655 335 640 320 Q 635 300 640 290 Z"/>
        </g>

        {/* Markers */}
        {markers.map((m, i) => {
          const { x, y } = project(m.coords[0], m.coords[1]);
          const color = scoreColor(m.score);
          const glow = glowId(m.score);
          return (
            <g key={i}>
              <circle cx={x} cy={y} r="28" fill={`url(#${glow})`}>
                <animate attributeName="r" values="20;32;20" dur="3s" repeatCount="indefinite" begin={`${i * 0.4}s`}/>
              </circle>
              <circle cx={x} cy={y} r="5" fill={color} stroke="#07070c" strokeWidth="1.5"/>
              {showScores && (
                <text x={x} y={y - 12} fill={color} fontSize="9" fontFamily="monospace" textAnchor="middle" fontWeight="700" letterSpacing="1">
                  {m.score}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
