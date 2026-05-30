'use client';

interface SubScoreBarItem {
  label: string;
  value: number;
  short?: string;
}

interface Props {
  security: number;
  geopolitical: number;
  budget: number;
  practicality: number;
  compact?: boolean;
}

function scoreColor(v: number): string {
  if (v >= 80) return '#3ddc97';
  if (v >= 60) return '#ffb224';
  if (v >= 40) return '#ff8c42';
  return '#ff3b2f';
}

export function SubscoreBar({ security, geopolitical, budget, practicality, compact = false }: Props) {
  const items: SubScoreBarItem[] = [
    { label: 'SÉCURITÉ',     short: 'SÉC',  value: security },
    { label: 'GÉOPOLITIQUE', short: 'GÉO',  value: geopolitical },
    { label: 'BUDGET',       short: 'BUD',  value: budget },
    { label: 'PRATICITÉ',    short: 'PRAT', value: practicality },
  ];

  if (compact) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4 }}>
        {items.map((item) => {
          const color = scoreColor(item.value);
          return (
            <div key={item.label} style={{ textAlign: 'center' }}>
              <div style={{
                fontFamily: 'var(--ct-mono, var(--font-space-mono), monospace)',
                fontSize: '0.5rem', color: '#3f3f5a', letterSpacing: '0.08em',
                textTransform: 'uppercase', marginBottom: 2,
              }}>
                {item.short ?? item.label}
              </div>
              <div style={{
                fontFamily: 'var(--ct-mono, var(--font-space-mono), monospace)',
                fontSize: '0.72rem', fontWeight: 700, color,
              }}>
                {item.value}
              </div>
              <div style={{ height: 2, background: '#1e1e2e', borderRadius: 1, marginTop: 3 }}>
                <div style={{
                  height: '100%', width: `${item.value}%`, background: color,
                  borderRadius: 1, transition: 'width 0.6s ease',
                }} />
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {items.map((item) => {
        const color = scoreColor(item.value);
        return (
          <div key={item.label} style={{ display: 'grid', gridTemplateColumns: '80px 1fr 32px', alignItems: 'center', gap: 8 }}>
            <span style={{
              fontFamily: 'var(--ct-mono, var(--font-space-mono), monospace)',
              fontSize: '0.58rem', color: '#6b7280', letterSpacing: '0.08em',
              textTransform: 'uppercase',
            }}>
              {item.short ?? item.label}
            </span>
            <div style={{ height: 3, background: '#1e1e2e', borderRadius: 2 }}>
              <div style={{
                height: '100%', width: `${item.value}%`, background: color,
                borderRadius: 2, transition: 'width 0.6s ease',
              }} />
            </div>
            <span style={{
              fontFamily: 'var(--ct-mono, var(--font-space-mono), monospace)',
              fontSize: '0.62rem', fontWeight: 700, color, textAlign: 'right',
            }}>
              {item.value}
            </span>
          </div>
        );
      })}
    </div>
  );
}
