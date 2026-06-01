'use client';
import { useState } from 'react';

const SUB_SCORES = [
  {
    key: 'security',
    icon: '🛡️',
    label: 'Sécurité',
    weight: 40,
    color: '#3ddc97',
    desc: 'Alertes officielles MEAE, criminalité, risque terroriste, stabilité locale.',
    example: 'Islande : 96 · Mexique (Guerrero) : 18',
  },
  {
    key: 'geopolitical',
    icon: '🌐',
    label: 'Géopolitique',
    weight: 30,
    color: '#4a9eff',
    desc: 'Tensions régionales, conflits proches, stabilité institutionnelle du gouvernement.',
    example: 'Portugal : 88 · Ukraine : 5',
  },
  {
    key: 'budget',
    icon: '💶',
    label: 'Budget',
    weight: 20,
    color: '#ffb224',
    desc: 'Coût de la vie, taux de change favorable à l\'euro, prix des vols et hébergements.',
    example: 'Vietnam : 81 · Norvège : 34',
  },
  {
    key: 'practicality',
    icon: '✈️',
    label: 'Praticité',
    weight: 10,
    color: '#ff8c42',
    desc: 'Visa requis ou non, connexions aériennes depuis la France, barrière de la langue.',
    example: 'Espagne : 94 · Îles Féroé : 51',
  },
];

export function CrisisScoreExplainer() {
  const [open, setOpen] = useState(false);

  return (
    <div style={{
      background: 'rgba(17,17,28,0.6)',
      border: '1px solid #1f1f30',
      borderRadius: 12,
      overflow: 'hidden',
    }}>
      {/* Header — toujours visible */}
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 16px', background: 'none', border: 'none', cursor: 'pointer',
          textAlign: 'left', gap: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
          <span style={{
            width: 28, height: 28, borderRadius: 7, background: 'rgba(255,59,47,0.12)',
            border: '1px solid rgba(255,59,47,0.25)', display: 'grid', placeItems: 'center',
            fontSize: 13, flexShrink: 0,
          }}>⚡</span>
          <div style={{ minWidth: 0 }}>
            <div style={{
              fontFamily: 'var(--ct-mono, var(--font-space-mono), monospace)',
              fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase',
              fontWeight: 700, color: '#f0f0f5',
            }}>
              Comment fonctionne le Crisis Score ?
            </div>
            <div style={{ fontSize: 11.5, color: '#9898b0', marginTop: 2, lineHeight: 1.4 }}>
              Un score de 0 à 100 qui analyse 4 critères en temps réel pour chaque pays
            </div>
          </div>
        </div>
        <span style={{
          fontFamily: 'var(--ct-mono, var(--font-space-mono), monospace)',
          fontSize: 9, color: '#6b6b85', flexShrink: 0,
          transition: 'transform 0.2s',
          transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
          display: 'inline-block',
        }}>▼</span>
      </button>

      {/* Contenu dépliable */}
      {open && (
        <div style={{ padding: '0 16px 16px', borderTop: '1px solid #1f1f30' }}>

          {/* Formule synthétique */}
          <div style={{
            margin: '12px 0 14px',
            padding: '10px 14px',
            background: 'rgba(10,10,18,0.6)',
            border: '1px solid #1f1f30',
            borderRadius: 8,
            fontFamily: 'var(--ct-mono, var(--font-space-mono), monospace)',
            fontSize: 10, letterSpacing: '0.08em', color: '#9898b0',
            lineHeight: 1.8,
          }}>
            <span style={{ color: '#f0f0f5', fontWeight: 700 }}>Crisis Score</span>
            {' = '}
            <span style={{ color: '#3ddc97' }}>Sécurité × 40%</span>
            {' + '}
            <span style={{ color: '#4a9eff' }}>Géopolitique × 30%</span>
            {' + '}
            <span style={{ color: '#ffb224' }}>Budget × 20%</span>
            {' + '}
            <span style={{ color: '#ff8c42' }}>Praticité × 10%</span>
          </div>

          {/* 4 critères */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {SUB_SCORES.map((s) => (
              <div key={s.key} style={{
                display: 'flex', gap: 10, alignItems: 'flex-start',
                padding: '9px 12px',
                background: 'rgba(10,10,18,0.4)',
                border: `1px solid ${s.color}22`,
                borderLeft: `3px solid ${s.color}`,
                borderRadius: 8,
              }}>
                <span style={{ fontSize: 14, flexShrink: 0, marginTop: 1 }}>{s.icon}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                    <span style={{
                      fontFamily: 'var(--ct-mono, var(--font-space-mono), monospace)',
                      fontSize: 9.5, fontWeight: 700, letterSpacing: '0.12em',
                      textTransform: 'uppercase', color: s.color,
                    }}>
                      {s.label}
                    </span>
                    <span style={{
                      fontFamily: 'var(--ct-mono, var(--font-space-mono), monospace)',
                      fontSize: 8, color: s.color, opacity: 0.7,
                      background: `${s.color}15`,
                      padding: '1px 5px', borderRadius: 3,
                    }}>
                      {s.weight}%
                    </span>
                  </div>
                  <div style={{ fontSize: 11.5, color: '#9898b0', lineHeight: 1.45, marginBottom: 4 }}>
                    {s.desc}
                  </div>
                  <div style={{
                    fontFamily: 'var(--ct-mono, var(--font-space-mono), monospace)',
                    fontSize: 9, color: '#6b6b85', letterSpacing: '0.04em',
                  }}>
                    ex : {s.example}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Légende des niveaux */}
          <div style={{
            marginTop: 12, paddingTop: 10, borderTop: '1px solid #1f1f30',
            display: 'flex', gap: 10, flexWrap: 'wrap',
          }}>
            {[
              { range: '80–100', label: 'Idéale', color: '#3ddc97' },
              { range: '65–79',  label: 'Recommandée', color: '#ffb224' },
              { range: '45–64',  label: 'Possible', color: '#ff8c42' },
              { range: '0–44',   label: 'Déconseillée', color: '#ff3b2f' },
            ].map((l) => (
              <span key={l.range} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <span style={{
                  width: 7, height: 7, borderRadius: 2,
                  background: l.color, display: 'inline-block', flexShrink: 0,
                }} />
                <span style={{
                  fontFamily: 'var(--ct-mono, var(--font-space-mono), monospace)',
                  fontSize: 9, color: '#9898b0', letterSpacing: '0.06em',
                }}>
                  <span style={{ color: l.color }}>{l.range}</span> {l.label}
                </span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
