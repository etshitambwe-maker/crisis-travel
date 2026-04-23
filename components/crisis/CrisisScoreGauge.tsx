'use client';
import { useEffect, useState } from 'react';
import { getScoreColor, getScoreLabel } from '@/types/crisis.types';

interface Props {
  score: number;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

const SIZES = { sm: 72, md: 110, lg: 160 };

export function CrisisScoreGauge({ score, size = 'md', showLabel = true }: Props) {
  const [animated, setAnimated] = useState(0);
  const px = SIZES[size];
  const r = px * 0.38;
  const circ = 2 * Math.PI * r;
  const color = getScoreColor(score);
  const offset = circ - (animated / 100) * circ;

  useEffect(() => {
    const t = setTimeout(() => setAnimated(score), 80);
    return () => clearTimeout(t);
  }, [score]);

  const fontSize = { sm: '1rem', md: '1.5rem', lg: '2.2rem' }[size];
  const subFontSize = { sm: '0.6rem', md: '0.7rem', lg: '0.9rem' }[size];

  return (
    <div className="flex flex-col items-center" style={{ gap: 4 }}>
      <div style={{ position: 'relative', width: px, height: px }}>
        <svg width={px} height={px} style={{ transform: 'rotate(-90deg)' }}>
          <circle cx={px / 2} cy={px / 2} r={r} fill="none" stroke="#1e1e2e" strokeWidth={px * 0.09} />
          <circle
            cx={px / 2} cy={px / 2} r={r} fill="none"
            stroke={color} strokeWidth={px * 0.09}
            strokeDasharray={circ}
            strokeDashoffset={offset}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 0.9s ease-in-out' }}
          />
        </svg>
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{ fontFamily: 'var(--font-space-mono)', fontSize, fontWeight: 700, color, lineHeight: 1 }}>
            {animated}
          </span>
          <span style={{ fontSize: subFontSize, color: '#6b7280' }}>/100</span>
        </div>
      </div>
      {showLabel && (
        <span style={{ fontSize: '0.65rem', letterSpacing: '0.12em', color, fontWeight: 700 }}>
          {getScoreLabel(score)}
        </span>
      )}
    </div>
  );
}
