'use client';
import { useEffect, useState } from 'react';
import { getScoreColor, getScoreLabel } from '@/types/crisis.types';

interface Props {
  score: number;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  animate?: boolean;
}

const SIZES = { sm: 72, md: 110, lg: 180 };

export function CrisisScoreGauge({ score, size = 'md', showLabel = true, animate = true }: Props) {
  const [displayed, setDisplayed] = useState(animate ? 0 : score);
  const px = SIZES[size];
  const stroke = Math.max(8, px * 0.065);
  const r = (px - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const color = getScoreColor(score);
  const offset = circ - (displayed / 100) * circ;

  useEffect(() => {
    if (!animate) { setDisplayed(score); return; }
    const start = performance.now();
    const duration = 1100;
    let raf: number;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      const eased = p < 0.5 ? 2 * p * p : -1 + (4 - 2 * p) * p;
      setDisplayed(Math.round(score * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [score, animate]);

  const fontSize = { sm: '1rem', md: '1.5rem', lg: '2.5rem' }[size];
  const subFontSize = { sm: '0.55rem', md: '0.65rem', lg: '0.85rem' }[size];
  const labelSize = { sm: '0.5rem', md: '0.6rem', lg: '0.75rem' }[size];
  const numTicks = size === 'lg' ? 60 : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <div style={{ position: 'relative', width: px, height: px }}>
        <svg width={px} height={px} style={{ transform: 'rotate(-90deg)' }}>
          {/* Tick marks (lg only) */}
          {numTicks > 0 && (
            <g style={{ transform: 'rotate(90deg)', transformOrigin: `${px / 2}px ${px / 2}px` }}>
              {Array.from({ length: numTicks }).map((_, i) => {
                const angle = (i / numTicks) * Math.PI * 2 - Math.PI / 2;
                const active = i / numTicks <= displayed / 100;
                const x1 = px / 2 + Math.cos(angle) * (r + stroke / 2 + 4);
                const y1 = px / 2 + Math.sin(angle) * (r + stroke / 2 + 4);
                const x2 = px / 2 + Math.cos(angle) * (r + stroke / 2 + (i % 5 === 0 ? 9 : 6));
                const y2 = px / 2 + Math.sin(angle) * (r + stroke / 2 + (i % 5 === 0 ? 9 : 6));
                return (
                  <line key={i} x1={x1} y1={y1} x2={x2} y2={y2}
                    stroke={active ? color : '#1f1f30'}
                    strokeWidth={i % 5 === 0 ? 1.5 : 1}
                    opacity={active ? 0.9 : 0.5}
                  />
                );
              })}
            </g>
          )}

          {/* Track */}
          <circle cx={px / 2} cy={px / 2} r={r} fill="none" stroke="#1f1f30" strokeWidth={stroke}/>
          {/* Fill */}
          <circle
            cx={px / 2} cy={px / 2} r={r} fill="none"
            stroke={color} strokeWidth={stroke} strokeLinecap="round"
            strokeDasharray={circ} strokeDashoffset={offset}
            style={{
              transition: animate ? 'stroke-dashoffset 1s cubic-bezier(0.2,0.8,0.2,1)' : 'none',
              filter: `drop-shadow(0 0 ${size === 'lg' ? 10 : 6}px ${color}aa)`,
            }}
          />
        </svg>

        {/* Center text */}
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'var(--ct-mono, var(--font-space-mono), monospace)', lineHeight: 1,
        }}>
          {size === 'lg' && (
            <div style={{ fontSize: 9, letterSpacing: '0.2em', color: '#6b6b85', marginBottom: 10, textTransform: 'uppercase' }}>
              SCORE GLOBAL
            </div>
          )}
          <span style={{ fontSize, fontWeight: 700, color, letterSpacing: '-0.04em' }}>
            {displayed}
          </span>
          <span style={{ fontSize: subFontSize, color: '#6b6b85', marginTop: 2, letterSpacing: '0.12em' }}>/100</span>
          {size === 'lg' && (
            <div style={{
              fontSize: 10, letterSpacing: '0.18em', color, fontWeight: 700, marginTop: 12,
              padding: '3px 10px', border: `1px solid ${color}55`, borderRadius: 4, background: `${color}15`,
            }}>
              {getScoreLabel(score)}
            </div>
          )}
        </div>
      </div>

      {showLabel && size !== 'lg' && (
        <span style={{ fontSize: labelSize, letterSpacing: '0.12em', color, fontWeight: 700 }}>
          {getScoreLabel(score)}
        </span>
      )}
    </div>
  );
}
