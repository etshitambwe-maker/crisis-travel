import { Header } from '@/components/layout/Header';
import { TickerBanner } from '@/components/crisis/TickerBanner';
import { SmartSearchHub } from '@/components/crisis/SmartSearchHub';
import { WorldMap } from '@/components/crisis/WorldMap';
import { OpportunityCards } from '@/components/crisis/HomeClientSections';
import { CrisisScoreExplainer } from '@/components/crisis/CrisisScoreExplainer';

export default function HomePage() {
  return (
    <div style={{
      minHeight: '100vh',
      overflowX: 'hidden',
      background: `
        radial-gradient(1200px 600px at 50% -200px, rgba(255,59,47,0.08), transparent 60%),
        radial-gradient(800px 400px at 100% 80%, rgba(74,158,255,0.04), transparent 60%),
        #07070c
      `,
    }}>
      <Header />
      <TickerBanner />

      <main style={{ maxWidth: 800, margin: '0 auto', padding: '0 20px 80px' }}>

        {/* ── HERO ───────────────────────────────────── */}
        <section style={{ padding: '32px 0 28px', position: 'relative' }}>
          {/* Background radials */}
          <div style={{
            position: 'absolute', inset: 0, pointerEvents: 'none',
            background: `
              radial-gradient(300px 200px at 80% 0%, rgba(255,59,47,0.12), transparent 70%),
              radial-gradient(250px 180px at 0% 40%, rgba(74,158,255,0.06), transparent 70%)
            `,
          }} />

          {/* Meta line */}
          <div style={{
            display: 'flex', gap: 10, alignItems: 'center', marginBottom: 18,
            fontFamily: 'var(--ct-mono, var(--font-space-mono), monospace)',
            fontSize: 9.5, letterSpacing: '0.18em', color: '#6b6b85', textTransform: 'uppercase',
            position: 'relative',
          }}>
            <span>v4.2</span>
            <span style={{ width: 20, height: 1, background: '#2e2e45' }} />
            <span>{new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase()} · UTC</span>
            <span style={{ width: 20, height: 1, background: '#2e2e45' }} />
            <span style={{ color: '#3ddc97' }}>● SYS NOMINAL</span>
          </div>

          {/* H1 */}
          <h1 className="ct-hero-h1" style={{
            fontFamily: 'var(--font-space-mono), monospace',
            fontSize: 'clamp(36px, 10vw, 52px)',
            lineHeight: 0.92, letterSpacing: '-0.03em',
            margin: '0 0 18px', fontWeight: 700, position: 'relative',
            color: '#f0f0f5', wordBreak: 'break-word',
          }}>
            VOYAGEZ<br/>
            <span style={{
              color: '#ff3b2f', display: 'inline-block', position: 'relative',
            }}>
              INTELLIGENT
              <span style={{
                position: 'absolute', left: 0, bottom: 2, right: 0,
                height: 4, background: '#ff3b2f', opacity: 0.2, filter: 'blur(8px)',
              }} />
            </span>
            <br/>
            OÙ LE MONDE<br/>VACILLE.
          </h1>

          <p style={{
            maxWidth: 320, color: '#9898b0', fontSize: 14.5, lineHeight: 1.5, margin: 0, position: 'relative',
          }}>
            Intelligence géopolitique + économique temps réel.{' '}
            <strong style={{ color: '#f0f0f5', fontWeight: 600 }}>Analyse 196 pays</strong> en 3 secondes à partir de vos contraintes de sécurité, budget et dates.
          </p>

          {/* Stats 2×2 */}
          <div className="ct-stats-grid" style={{
            marginTop: 22,
            display: 'grid', gridTemplateColumns: '1fr 1fr',
            border: '1px solid #1f1f30', borderRadius: 12, overflow: 'hidden',
            background: 'rgba(17,17,28,0.5)', backdropFilter: 'blur(12px)',
            position: 'relative',
          }}>
            {[
              { label: 'MEAE ALERTES ACTIVES', value: '47', sub: '+3 CES 7 JOURS', down: true },
              { label: 'DESTINATIONS STABLES', value: '134', sub: 'SUR 196 ANALYSÉS', up: true },
              { label: 'FX FAVORABLE EUR', value: '28', sub: 'DEVISES SUIVIES 180', up: true },
              { label: 'DERNIÈRE MAJ', value: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }), sub: 'SYNC AUTO 30S' },
            ].map((s, i) => (
              <div key={i} style={{
                padding: '12px 14px',
                borderRight: i % 2 === 0 ? '1px solid #1f1f30' : 'none',
                borderBottom: i < 2 ? '1px solid #1f1f30' : 'none',
              }}>
                <div style={{
                  fontFamily: 'var(--ct-mono, var(--font-space-mono), monospace)',
                  fontSize: 8.5, letterSpacing: '0.18em', color: '#6b6b85',
                  textTransform: 'uppercase', marginBottom: 4,
                  display: 'flex', alignItems: 'center', gap: 5,
                }}>
                  <span style={{ width: 4, height: 4, borderRadius: '50%', background: '#3ddc97', boxShadow: '0 0 4px #3ddc97', display: 'inline-block' }} />
                  {s.label}
                </div>
                <div style={{
                  fontFamily: 'var(--ct-mono, var(--font-space-mono), monospace)',
                  fontSize: 16, fontWeight: 700, letterSpacing: '-0.02em',
                  color: s.down ? '#ff3b2f' : s.up ? '#3ddc97' : '#f0f0f5',
                }}>
                  {s.value}
                </div>
                <div style={{
                  fontFamily: 'var(--ct-mono, var(--font-space-mono), monospace)',
                  fontSize: 9, color: '#6b6b85', marginTop: 2, letterSpacing: '0.05em',
                }}>
                  {s.sub}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── CRISIS SCORE EXPLAINER ─────────────────── */}
        <section style={{ marginBottom: 28 }}>
          <CrisisScoreExplainer />
        </section>

        {/* ── SEARCH HUB ─────────────────────────────── */}
        <section style={{ marginBottom: 28 }}>
          <SectionHead num="01" label="RECHERCHE & PARAMÈTRES" meta="REQUIS" color="#ff3b2f" />
          <SmartSearchHub />
        </section>

        {/* ── CARTE MONDIALE ─────────────────────────── */}
        <section style={{ marginBottom: 28 }}>
          <SectionHead num="02" label="CARTE MONDIALE" meta="LIVE · 196 PAYS" color="#3ddc97" />
          <WorldMap />
          <div style={{
            display: 'flex', gap: 10, marginTop: 10,
            fontFamily: 'var(--ct-mono, var(--font-space-mono), monospace)',
            fontSize: 9.5, letterSpacing: '0.14em', color: '#6b6b85', textTransform: 'uppercase',
          }}>
            {[
              { color: '#3ddc97', label: 'IDÉALE' },
              { color: '#ffb224', label: 'RECO' },
              { color: '#ff8c42', label: 'POSS' },
              { color: '#ff3b2f', label: 'DÉCO' },
            ].map((l) => (
              <span key={l.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: l.color, display: 'inline-block' }} />
                {l.label}
              </span>
            ))}
          </div>
        </section>

        {/* ── FENÊTRES OPTIMALES ─────────────────────── */}
        <section style={{ marginBottom: 28 }}>
          <SectionHead num="03" label="FENÊTRES OPTIMALES" meta="3 DÉTECTÉES" color="#3ddc97" />
          <OpportunityCards />
        </section>

        {/* Sources */}
        <footer style={{
          paddingTop: 24, marginTop: 8, borderTop: '1px solid #1f1f30',
          textAlign: 'center',
          fontFamily: 'var(--ct-mono, var(--font-space-mono), monospace)',
          fontSize: 9, letterSpacing: '0.18em', color: '#6b6b85', textTransform: 'uppercase',
        }}>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginBottom: 8 }}>
            {['MEAE', 'SKYSCANNER', 'BOOKING', 'ECB', 'CLAUDE AI'].map((s, i, a) => (
              <span key={s}>
                {s}
                {i < a.length - 1 && <span style={{ marginLeft: 10, color: '#2e2e45' }}>·</span>}
              </span>
            ))}
          </div>
          <div>v4.2.1 · BUILD {new Date().toISOString().slice(0,10).replace(/-/g,'')} · © CRISIS TRAVEL</div>
        </footer>

      </main>
    </div>
  );
}

/* ── Sub-components ────────────────────────────────── */

function SectionHead({ num, label, meta, color = '#ff3b2f' }: { num: string; label: string; meta: string; color?: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      marginBottom: 14, paddingBottom: 10, borderBottom: '1px solid #1f1f30',
    }}>
      <div style={{
        fontFamily: 'var(--ct-mono, var(--font-space-mono), monospace)',
        fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase',
        fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 8,
        color: '#f0f0f5',
      }}>
        <span style={{ width: 8, height: 8, background: color, transform: 'rotate(45deg)', display: 'inline-block' }} />
        <span style={{ color: '#6b6b85', fontWeight: 500 }}>{num} /</span>
        {label}
      </div>
      <span style={{
        fontFamily: 'var(--ct-mono, var(--font-space-mono), monospace)',
        fontSize: 9.5, letterSpacing: '0.12em', color: '#6b6b85', textTransform: 'uppercase',
      }}>
        {meta}
      </span>
    </div>
  );
}
