'use client';
import { useState, useRef, useEffect } from 'react';

interface ScoreTooltipProps {
  children: React.ReactNode;
  security?: number;
  geopolitical?: number;
  budget?: number;
  practicality?: number;
  total?: number;
}

const BARS = [
  { label: 'Sécurité',     key: 'security',    weight: 40, color: '#3ddc97' },
  { label: 'Géopolitique', key: 'geopolitical', weight: 30, color: '#4a9eff' },
  { label: 'Budget',       key: 'budget',       weight: 20, color: '#ffb224' },
  { label: 'Praticité',    key: 'practicality', weight: 10, color: '#c084fc' },
];

export function ScoreTooltip({
  children, security, geopolitical, budget, practicality, total,
}: ScoreTooltipProps) {
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function handleOutside(e: MouseEvent | TouchEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setVisible(false);
    }
    if (visible) {
      document.addEventListener('mousedown', handleOutside);
      document.addEventListener('touchstart', handleOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('touchstart', handleOutside);
    };
  }, [visible]);

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  const vals: Record<string, number | undefined> = { security, geopolitical, budget, practicality };

  return (
    <div
      ref={ref}
      style={{ position: 'relative', display: 'inline-block' }}
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onTouchStart={(e) => {
        e.preventDefault(); // prevent ghost click
        if (timerRef.current) clearTimeout(timerRef.current);
        setVisible((v) => {
          if (!v) timerRef.current = setTimeout(() => setVisible(false), 2500);
          return !v;
        });
      }}
    >
      <div style={{ cursor: 'help' }}>{children}</div>

      {visible && (
        <div style={{
          position: 'absolute', bottom: 'calc(100% + 8px)', left: '50%',
          transform: 'translateX(-50%)',
          background: '#11111c', border: '1px solid #2a2a3e',
          borderRadius: 10, padding: '12px 14px', width: 240, zIndex: 200,
          boxShadow: '0 8px 32px rgba(0,0,0,0.7)',
          pointerEvents: 'none',
        }}>
          {/* Flèche bas */}
          <div style={{
            position: 'absolute', bottom: -6, left: '50%',
            transform: 'translateX(-50%) rotate(45deg)',
            width: 10, height: 10, background: '#11111c',
            border: '1px solid #2a2a3e', borderTop: 'none', borderLeft: 'none',
          }} />

          <div style={{
            fontFamily: 'var(--ct-mono, monospace)', fontSize: 9,
            letterSpacing: '0.18em', color: '#6b6b85', textTransform: 'uppercase',
            marginBottom: 10, paddingBottom: 8, borderBottom: '1px solid #1f1f30',
          }}>
            COMMENT EST CALCULÉ CE SCORE ?
          </div>

          {BARS.map((b) => {
            const v = vals[b.key];
            return (
              <div key={b.key} style={{ marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                  <span style={{
                    fontFamily: 'var(--ct-mono, monospace)', fontSize: 9,
                    color: '#9898b0', letterSpacing: '0.08em',
                  }}>
                    {b.label}{' '}
                    <span style={{ color: '#6b6b85' }}>×{b.weight}%</span>
                  </span>
                  {v !== undefined && (
                    <span style={{
                      fontFamily: 'var(--ct-mono, monospace)', fontSize: 9,
                      color: b.color, fontWeight: 700,
                    }}>
                      {v}/100
                    </span>
                  )}
                </div>
                <div style={{ height: 3, background: '#1f1f30', borderRadius: 2 }}>
                  <div style={{
                    height: '100%', borderRadius: 2, background: b.color,
                    width: `${b.weight}%`, opacity: 0.6,
                  }} />
                </div>
              </div>
            );
          })}

          <div style={{
            marginTop: 10, paddingTop: 8, borderTop: '1px solid #1f1f30',
            fontFamily: 'var(--ct-mono, monospace)', fontSize: 8,
            color: '#6b6b85', letterSpacing: '0.06em', lineHeight: 1.5,
          }}>
            Plus le score est élevé, plus la destination est recommandée pour un voyageur français.
          </div>

          {total !== undefined && (
            <div style={{
              marginTop: 6, fontFamily: 'var(--ct-mono, monospace)', fontSize: 10,
              color: '#f0f0f5', fontWeight: 700, letterSpacing: '0.04em', textAlign: 'center',
            }}>
              SCORE FINAL : {total}/100
            </div>
          )}
        </div>
      )}
    </div>
  );
}
