// FRONT-019 — Section pédagogique homepage « Comment ça marche ? ».
// Statique (aucun état, aucun fetch). Récit d'usage en 4 étapes, inséré entre le
// hero et CrisisScoreExplainer pour combler le trou de compréhension primo-visiteur.
// Direction : ctv3 sobre, sans emoji, sans image, sans animation lourde. Le titre
// reprend le pattern « losange rouge + display » de SectionHead (app/page.tsx) pour
// rester cohérent avec les autres sections. Copy honnête imposée (aide à la décision,
// signaux disponibles, à compléter avec les sources officielles) — pas de claim.

const STEPS = [
  {
    num: '01',
    title: 'Définis ton profil',
    desc: 'Vos préférences de voyage : style, sensibilité au budget, contraintes ou dates si vous les avez.',
  },
  {
    num: '02',
    title: 'Analyse des signaux',
    desc: 'Nous mettons en perspective les signaux disponibles : sécurité, contexte économique, praticité et opportunités voyage.',
  },
  {
    num: '03',
    title: 'Compare les destinations',
    desc: 'Les destinations sont classées et expliquées — pas seulement notées — pour une lecture claire du contexte.',
  },
  {
    num: '04',
    title: 'Prépare ton voyage',
    desc: "Un outil d'aide à la décision, à compléter avec les sources officielles avant de réserver ou d'approfondir.",
  },
];

export function HowItWorks() {
  return (
    <div>
      {/* Titre — pattern SectionHead (losange rouge + display), cohérent homepage */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid var(--ctv3-line-soft)',
      }}>
        <h2 style={{
          fontFamily: 'var(--ctv3-display)', fontSize: 20, fontWeight: 800,
          letterSpacing: '-0.02em', color: 'var(--ctv3-paper)',
          display: 'inline-flex', alignItems: 'center', gap: 10,
        }}>
          <span style={{ width: 6, height: 6, background: 'var(--ctv3-red)', transform: 'rotate(45deg)' }} />
          Comment ça marche ?
        </h2>
        <span className="ctv3-mono" style={{
          fontSize: 9.5, letterSpacing: '0.14em', color: 'var(--ctv3-faint)', textTransform: 'uppercase',
        }}>
          En 4 étapes
        </span>
      </div>

      {/* Intro */}
      <p className="ctv3-serif" style={{
        maxWidth: 620, color: 'var(--ctv3-muted)', fontSize: 15.5, lineHeight: 1.6, margin: '0 0 20px',
      }}>
        Crisis Travel vous aide à comparer des destinations à partir de vos préférences de voyage
        et des signaux disponibles sur le contexte local.
      </p>

      {/* 4 cartes-étapes — grille desktop, empilement mobile */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12, marginBottom: 16,
      }}>
        {STEPS.map((s) => (
          <div key={s.num} style={{
            background: 'var(--ctv3-ink-850)', border: '1px solid var(--ctv3-line)',
            borderTop: '2px solid var(--ctv3-line-bright)', padding: '14px 14px 16px',
            display: 'flex', flexDirection: 'column', gap: 8,
          }}>
            <span className="ctv3-mono" style={{
              fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', color: 'var(--ctv3-faint)',
            }}>
              {s.num}
            </span>
            <div style={{
              fontFamily: 'var(--ctv3-display)', fontWeight: 800, fontSize: 15,
              letterSpacing: '-0.01em', color: 'var(--ctv3-paper)', lineHeight: 1.15,
            }}>
              {s.title}
            </div>
            <p className="ctv3-serif" style={{
              fontSize: 13, lineHeight: 1.5, color: 'var(--ctv3-muted)', margin: 0,
            }}>
              {s.desc}
            </p>
          </div>
        ))}
      </div>

      {/* Ligne honnêteté — outil d'aide à la décision, pas de garantie */}
      <p className="ctv3-mono" style={{
        fontSize: 11, lineHeight: 1.6, letterSpacing: '0.02em',
        color: 'var(--ctv3-faint)', margin: 0,
        borderLeft: '2px solid var(--ctv3-line-bright)', paddingLeft: 12,
      }}>
        Le Crisis Score met plusieurs dimensions en perspective pour aider à comparer.
        Il ne prédit pas l&apos;avenir, ne garantit pas la sécurité et ne remplace pas
        les recommandations officielles (MEAE).
      </p>
    </div>
  );
}
