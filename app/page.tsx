import { Header } from '@/components/layout/Header';
import { SmartSearchHub } from '@/components/crisis/SmartSearchHub';
import { OpportunityCards } from '@/components/crisis/HomeClientSections';
import { HowItWorks } from '@/components/crisis/HowItWorks';
import { Eyebrow } from '@/components/design/atoms';
import { TARGET_COUNTRIES } from '@/lib/utils/countries';
import { CANDIDATE_CAP } from '@/lib/utils/selectCandidates';
import { TickerBanner } from '@/components/crisis/TickerBanner';
import { getMeaeTickerItems, MEAE_LAST_UPDATED } from '@/lib/utils/meae-ticker-items';
import Link from 'next/link';

/**
 * HOME-UX-001 — Simplification page d'accueil.
 * Sections supprimées : WorldMap (décorative), CrisisScoreExplainer (trop technique),
 * rail photo hero (décoratif, pas cliquable).
 * Nouvelle structure : hero → formulaire → bloc premium → comment ça marche → destinations.
 */

const COVERED = TARGET_COUNTRIES.length;
const SCORED_PER_REQUEST = CANDIDATE_CAP;

const MEAE_TICKER_ITEMS = getMeaeTickerItems();

const PREMIUM_FEATURES = [
  { label: 'Guide terrain pays', desc: 'Analyse de terrain en 8 sections : ambiance locale, sécurité au quotidien, budget réel.' },
  { label: 'Itinéraire parcours-guide', desc: 'Un récit de voyage structuré adapté à votre profil, pas des cartes horaires.' },
  { label: 'Risques live & événements', desc: 'Événements récents et risques actifs remontés en temps réel depuis les sources officielles.' },
  { label: 'Export PDF', desc: 'Téléchargez votre rapport complet pour le consulter hors-ligne ou le partager.' },
];

export default function HomePage() {
  return (
    <div className="ctv3" style={{ minHeight: '100vh', overflowX: 'hidden', background: 'var(--ctv3-ink-900)' }}>
      <Header />
      <TickerBanner items={MEAE_TICKER_ITEMS} lastUpdated={MEAE_LAST_UPDATED} />

      <main style={{ maxWidth: 1080, margin: '0 auto', padding: '0 20px 88px' }}>

        {/* ── HERO ────────────────────────────────────────────── */}
        <section style={{ padding: '40px 0 32px' }}>
          <Eyebrow red>Intelligence voyage · temps réel</Eyebrow>

          <h1
            style={{
              fontFamily: 'var(--ctv3-display)',
              fontSize: 'clamp(30px, 6vw, 54px)',
              fontWeight: 900,
              lineHeight: 1.05,
              letterSpacing: '-0.03em',
              margin: '14px 0 16px',
              color: 'var(--ctv3-paper)',
              maxWidth: 680,
            }}
          >
            Trouvez la destination adaptée à votre profil,{' '}
            <span style={{ color: 'var(--ctv3-red)' }}>votre budget et votre niveau de risque.</span>
          </h1>

          <p
            className="ctv3-serif"
            style={{ maxWidth: 520, color: 'var(--ctv3-muted)', fontSize: 17, lineHeight: 1.65, margin: '0 0 20px' }}
          >
            Crisis Travel analyse la sécurité, la géopolitique, le budget et la praticité pour
            révéler les destinations les plus avantageuses du moment.
          </p>

          <div
            className="ctv3-mono"
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 14,
              fontSize: 11,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: 'var(--ctv3-faint)',
            }}
          >
            <span>
              <strong style={{ color: 'var(--ctv3-paper)', fontWeight: 700 }}>{COVERED}</strong> destinations couvertes
            </span>
            <span style={{ color: 'var(--ctv3-line-bright)' }}>·</span>
            <span>
              jusqu'à <strong style={{ color: 'var(--ctv3-paper)', fontWeight: 700 }}>{SCORED_PER_REQUEST}</strong> analysées
              par requête
            </span>
            <span style={{ color: 'var(--ctv3-line-bright)' }}>·</span>
            <span>sources officielles &amp; marché</span>
          </div>
        </section>

        {/* ── FORMULAIRE D'ANALYSE ────────────────────────────── */}
        <section id="analyse" style={{ marginBottom: 44 }}>
          <SectionHead label="Lancer une analyse" meta="Sécurité · géo · budget · praticité" />
          <SmartSearchHub />
        </section>

        {/* ── BLOC PREMIUM ─────────────────────────────────────── */}
        <section style={{ marginBottom: 44 }}>
          <SectionHead label="Aller plus loin avec Premium" meta="Guide complet" />
          <div
            style={{
              background: 'var(--ctv3-ink-850)',
              border: '1px solid var(--ctv3-line)',
              borderTop: '2px solid var(--ctv3-red)',
              padding: '20px 22px',
            }}
          >
            <p
              className="ctv3-serif"
              style={{ maxWidth: 600, color: 'var(--ctv3-muted)', fontSize: 14.5, lineHeight: 1.6, margin: '0 0 18px' }}
            >
              L'analyse gratuite donne le classement et le contexte. Le Premium débloque le guide
              terrain complet, l'itinéraire adapté et les exports.
            </p>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: 10,
                marginBottom: 20,
              }}
            >
              {PREMIUM_FEATURES.map((f) => (
                <div
                  key={f.label}
                  style={{
                    background: 'var(--ctv3-ink-900)',
                    border: '1px solid var(--ctv3-line)',
                    padding: '13px 14px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    <span
                      aria-hidden
                      style={{
                        width: 6,
                        height: 6,
                        background: 'var(--ctv3-red)',
                        transform: 'rotate(45deg)',
                        flexShrink: 0,
                        display: 'inline-block',
                      }}
                    />
                    <span
                      style={{
                        fontFamily: 'var(--ctv3-display)',
                        fontSize: 14,
                        fontWeight: 800,
                        letterSpacing: '-0.01em',
                        color: 'var(--ctv3-paper)',
                      }}
                    >
                      {f.label}
                    </span>
                  </div>
                  <p
                    className="ctv3-serif"
                    style={{ fontSize: 12.5, lineHeight: 1.5, color: 'var(--ctv3-muted)', margin: 0 }}
                  >
                    {f.desc}
                  </p>
                </div>
              ))}
            </div>

            <Link
              href="/pricing"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '11px 20px',
                background: 'rgba(228,51,43,0.14)',
                border: '1px solid rgba(228,51,43,0.45)',
                color: 'var(--ctv3-red-2)',
                fontFamily: 'var(--ctv3-mono)',
                fontSize: '0.78rem',
                fontWeight: 700,
                letterSpacing: '0.1em',
                textDecoration: 'none',
                textTransform: 'uppercase',
              }}
            >
              Voir les offres Premium →
            </Link>
          </div>
        </section>

        {/* ── COMMENT ÇA MARCHE ───────────────────────────────── */}
        <section style={{ marginBottom: 44 }}>
          <HowItWorks />
        </section>

        {/* ── DESTINATIONS EXEMPLES ───────────────────────────── */}
        <section style={{ marginBottom: 40 }}>
          <SectionHead label="Tester avec un exemple" meta="Analyses pré-remplies" />
          <OpportunityCards />
        </section>

        {/* Footer */}
        <footer
          className="ctv3-mono"
          style={{
            paddingTop: 26,
            marginTop: 8,
            borderTop: '1px solid var(--ctv3-line-soft)',
            textAlign: 'center',
            fontSize: 9.5,
            letterSpacing: '0.18em',
            color: 'var(--ctv3-faint)',
            textTransform: 'uppercase',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 8 }}>
            {['MEAE', 'Skyscanner', 'Booking', 'BCE', 'Claude AI'].map((s, i, a) => (
              <span key={s}>
                {s}
                {i < a.length - 1 && <span style={{ marginLeft: 12, color: 'var(--ctv3-line-bright)' }}>·</span>}
              </span>
            ))}
          </div>
          <div>© Crisis Travel</div>
        </footer>
      </main>
    </div>
  );
}

/* ── Section head ──────────────────────────────────────────── */
function SectionHead({ label, meta }: { label: string; meta?: string }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 16,
        paddingBottom: 12,
        borderBottom: '1px solid var(--ctv3-line-soft)',
      }}
    >
      <h2
        style={{
          fontFamily: 'var(--ctv3-display)',
          fontSize: 20,
          fontWeight: 800,
          letterSpacing: '-0.02em',
          color: 'var(--ctv3-paper)',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <span style={{ width: 6, height: 6, background: 'var(--ctv3-red)', transform: 'rotate(45deg)' }} />
        {label}
      </h2>
      {meta && (
        <span
          className="ctv3-mono"
          style={{ fontSize: 9.5, letterSpacing: '0.14em', color: 'var(--ctv3-faint)', textTransform: 'uppercase' }}
        >
          {meta}
        </span>
      )}
    </div>
  );
}
