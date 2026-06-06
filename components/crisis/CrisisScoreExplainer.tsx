'use client';

// FRONT-007 : refonte visuelle uniquement — migration vers le système .ctv3.
// FRONT-019 : retrait des emojis (direction CTV3 sans emoji) — remplacés par une
//   pastille sobre de la couleur du pilier. Poids (40/30/20/10), libellés,
//   descriptions et formule sont STRICTEMENT inchangés. Aucun impact scoring.

const PILLARS = [
  {
    key: 'security',
    label: 'Sécurité',
    weight: 40,
    color: 'var(--ctv3-ideal)',
    desc: 'Alertes officielles, criminalité, risque terroriste',
  },
  {
    key: 'geopolitical',
    label: 'Géopolitique',
    weight: 30,
    color: 'var(--ctv3-blue)',
    desc: 'Tensions régionales, stabilité du gouvernement',
  },
  {
    key: 'budget',
    label: 'Budget',
    weight: 20,
    color: 'var(--ctv3-reco)',
    desc: 'Coût de la vie, taux de change, prix des vols',
  },
  {
    key: 'practicality',
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
      padding: '16px 18px',
    }}>
      {/* Eyebrow label — pattern .ctv3 sobre (tiret + texte mono) — FRONT-020 : contraste/taille */}
      <div style={{
        fontFamily: 'var(--ctv3-mono)',
        fontSize: 10, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase',
        color: 'var(--ctv3-red)', marginBottom: 14,
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <span style={{ width: 16, height: 1, background: 'currentColor', opacity: 0.7, display: 'inline-block' }} />
        Comment est calculé le Crisis Score ?
      </div>

      {/* 4 piliers — grille responsive (FRONT-020 : auto-fit -> 2 col mobile / 4 desktop) */}
      <div className="ct-pillars-grid" style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(132px, 1fr))',
        gap: 8,
        marginBottom: 12,
      }}>
        {PILLARS.map((p) => (
          <div key={p.key} style={{
            background: 'var(--ctv3-ink-900)',
            border: '1px solid var(--ctv3-line)',
            borderTop: `2px solid ${p.color}`,
            padding: '11px 11px 10px',
            display: 'flex', flexDirection: 'column', gap: 6,
          }}>
            {/* En-tête carte : pastille + libellé alignés (FRONT-020) */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              {/* Pastille sobre (remplace l'emoji, FRONT-019) — carré tinted couleur pilier */}
              <span aria-hidden style={{
                width: 9, height: 9, background: p.color, opacity: 0.9,
                transform: 'rotate(45deg)', display: 'inline-block', flexShrink: 0,
              }} />
              <div style={{
                fontFamily: 'var(--ctv3-mono)',
                fontSize: 9.5, fontWeight: 700, letterSpacing: '0.1em',
                textTransform: 'uppercase', color: p.color,
              }}>
                {p.label}
              </div>
            </div>
            <div style={{
              fontFamily: 'var(--ctv3-mono)',
              fontSize: 18, fontWeight: 700, color: 'var(--ctv3-paper)', letterSpacing: '-0.02em', lineHeight: 1,
            }}>
              {p.weight}%
            </div>
            <div style={{ fontSize: 10.5, color: 'var(--ctv3-muted)', lineHeight: 1.4 }}>
              {p.desc}
            </div>
          </div>
        ))}
      </div>

      {/* Formule — sous les piliers (FRONT-020 : label de section + respiration) */}
      <div style={{
        padding: '11px 14px',
        background: 'var(--ctv3-ink-900)',
        border: '1px solid var(--ctv3-line)',
      }}>
        <div className="ctv3-mono" style={{
          fontSize: 8.5, letterSpacing: '0.16em', textTransform: 'uppercase',
          color: 'var(--ctv3-faint)', marginBottom: 7,
        }}>
          Formule pondérée
        </div>
        <div style={{
          fontFamily: 'var(--ctv3-mono)',
          fontSize: 10.5, letterSpacing: '0.06em', lineHeight: 1.5,
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
    </div>
  );
}
