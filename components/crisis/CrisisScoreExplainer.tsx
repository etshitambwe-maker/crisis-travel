'use client';

// FRONT-007 : refonte visuelle uniquement — migration vers le système .ctv3.
// Poids (40/30/20/10), libellés, descriptions, emojis et formule sont inchangés.

const PILLARS = [
  {
    key: 'security',
    icon: '🛡️',
    label: 'Sécurité',
    weight: 40,
    color: 'var(--ctv3-ideal)',
    desc: 'Alertes officielles, criminalité, risque terroriste',
  },
  {
    key: 'geopolitical',
    icon: '🌐',
    label: 'Géopolitique',
    weight: 30,
    color: 'var(--ctv3-blue)',
    desc: 'Tensions régionales, stabilité du gouvernement',
  },
  {
    key: 'budget',
    icon: '💶',
    label: 'Budget',
    weight: 20,
    color: 'var(--ctv3-reco)',
    desc: 'Coût de la vie, taux de change, prix des vols',
  },
  {
    key: 'practicality',
    icon: '✈️',
    label: 'Praticité',
    weight: 10,
    color: 'var(--ctv3-poss)',
    desc: 'Visa, connexions aériennes, langue',
  },
];

export function CrisisScoreExplainer() {
  return (
    <div style={{
      background: 'var(--ctv3-ink-850)',
      border: '1px solid var(--ctv3-line)',
      borderTop: '2px solid var(--ctv3-red)',
      padding: '14px 16px',
    }}>
      {/* Eyebrow label — pattern .ctv3 sobre (tiret + texte mono) */}
      <div style={{
        fontFamily: 'var(--ctv3-mono)',
        fontSize: 9, letterSpacing: '0.18em', textTransform: 'uppercase',
        color: 'var(--ctv3-red)', marginBottom: 10,
        display: 'flex', alignItems: 'center', gap: 6,
      }}>
        <span style={{ width: 14, height: 1, background: 'currentColor', opacity: 0.6, display: 'inline-block' }} />
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
            background: 'var(--ctv3-ink-900)',
            border: '1px solid var(--ctv3-line)',
            borderTop: `2px solid ${p.color}`,
            padding: '8px 8px 7px',
            display: 'flex', flexDirection: 'column', gap: 4,
          }}>
            <span style={{ fontSize: 16, lineHeight: 1 }}>{p.icon}</span>
            <div style={{
              fontFamily: 'var(--ctv3-mono)',
              fontSize: 9, fontWeight: 700, letterSpacing: '0.1em',
              textTransform: 'uppercase', color: p.color,
            }}>
              {p.label}
            </div>
            <div style={{
              fontFamily: 'var(--ctv3-mono)',
              fontSize: 11, fontWeight: 700, color: 'var(--ctv3-paper)', letterSpacing: '-0.01em',
            }}>
              {p.weight}%
            </div>
            <div style={{ fontSize: 10, color: 'var(--ctv3-faint)', lineHeight: 1.35 }}>
              {p.desc}
            </div>
          </div>
        ))}
      </div>

      {/* Formule — sous les piliers */}
      <div style={{
        padding: '8px 12px',
        background: 'var(--ctv3-ink-900)',
        border: '1px solid var(--ctv3-line)',
        fontFamily: 'var(--ctv3-mono)',
        fontSize: 10, letterSpacing: '0.06em',
        display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap',
      }}>
        <span style={{ color: 'var(--ctv3-paper)', fontWeight: 700 }}>Crisis Score</span>
        <span style={{ color: 'var(--ctv3-dim)' }}>=</span>
        <span style={{ color: 'var(--ctv3-ideal)' }}>Sécurité ×40%</span>
        <span style={{ color: 'var(--ctv3-dim)' }}>+</span>
        <span style={{ color: 'var(--ctv3-blue)' }}>Géopolitique ×30%</span>
        <span style={{ color: 'var(--ctv3-dim)' }}>+</span>
        <span style={{ color: 'var(--ctv3-reco)' }}>Budget ×20%</span>
        <span style={{ color: 'var(--ctv3-dim)' }}>+</span>
        <span style={{ color: 'var(--ctv3-poss)' }}>Praticité ×10%</span>
      </div>
    </div>
  );
}
