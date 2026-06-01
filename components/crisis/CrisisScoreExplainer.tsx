'use client';

const PILLARS = [
  {
    key: 'security',
    icon: '🛡️',
    label: 'Sécurité',
    weight: 40,
    color: '#3ddc97',
    desc: 'Alertes officielles, criminalité, risque terroriste',
  },
  {
    key: 'geopolitical',
    icon: '🌐',
    label: 'Géopolitique',
    weight: 30,
    color: '#4a9eff',
    desc: 'Tensions régionales, stabilité du gouvernement',
  },
  {
    key: 'budget',
    icon: '💶',
    label: 'Budget',
    weight: 20,
    color: '#ffb224',
    desc: 'Coût de la vie, taux de change, prix des vols',
  },
  {
    key: 'practicality',
    icon: '✈️',
    label: 'Praticité',
    weight: 10,
    color: '#ff8c42',
    desc: 'Visa, connexions aériennes, langue',
  },
];

export function CrisisScoreExplainer() {
  return (
    <div style={{
      background: 'rgba(17,17,28,0.7)',
      border: '1px solid #1f1f30',
      borderRadius: 12,
      padding: '14px 16px',
    }}>
      {/* Label */}
      <div style={{
        fontFamily: 'var(--ct-mono, var(--font-space-mono), monospace)',
        fontSize: 9, letterSpacing: '0.18em', textTransform: 'uppercase',
        color: '#6b6b85', marginBottom: 10,
        display: 'flex', alignItems: 'center', gap: 6,
      }}>
        <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#ff3b2f', display: 'inline-block', boxShadow: '0 0 5px #ff3b2f' }} />
        Comment est calculé le Crisis Score ?
      </div>

      {/* 4 piliers — toujours visibles */}
      <div className="ct-pillars-grid" style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 6,
        marginBottom: 10,
      }}>
        {PILLARS.map((p) => (
          <div key={p.key} style={{
            background: 'rgba(10,10,18,0.6)',
            border: `1px solid ${p.color}30`,
            borderTop: `2px solid ${p.color}`,
            borderRadius: 8,
            padding: '8px 8px 7px',
            display: 'flex', flexDirection: 'column', gap: 4,
          }}>
            <span style={{ fontSize: 16, lineHeight: 1 }}>{p.icon}</span>
            <div style={{
              fontFamily: 'var(--ct-mono, var(--font-space-mono), monospace)',
              fontSize: 9, fontWeight: 700, letterSpacing: '0.1em',
              textTransform: 'uppercase', color: p.color,
            }}>
              {p.label}
            </div>
            <div style={{
              fontFamily: 'var(--ct-mono, var(--font-space-mono), monospace)',
              fontSize: 11, fontWeight: 700, color: '#f0f0f5', letterSpacing: '-0.01em',
            }}>
              {p.weight}%
            </div>
            <div style={{ fontSize: 10, color: '#6b6b85', lineHeight: 1.35 }}>
              {p.desc}
            </div>
          </div>
        ))}
      </div>

      {/* Formule — sous les piliers */}
      <div style={{
        padding: '8px 12px',
        background: 'rgba(10,10,18,0.5)',
        border: '1px solid #1f1f30',
        borderRadius: 7,
        fontFamily: 'var(--ct-mono, var(--font-space-mono), monospace)',
        fontSize: 10, letterSpacing: '0.06em',
        display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap',
      }}>
        <span style={{ color: '#f0f0f5', fontWeight: 700 }}>Crisis Score</span>
        <span style={{ color: '#3f3f5a' }}>=</span>
        <span style={{ color: '#3ddc97' }}>Sécurité ×40%</span>
        <span style={{ color: '#3f3f5a' }}>+</span>
        <span style={{ color: '#4a9eff' }}>Géopolitique ×30%</span>
        <span style={{ color: '#3f3f5a' }}>+</span>
        <span style={{ color: '#ffb224' }}>Budget ×20%</span>
        <span style={{ color: '#3f3f5a' }}>+</span>
        <span style={{ color: '#ff8c42' }}>Praticité ×10%</span>
      </div>
    </div>
  );
}
