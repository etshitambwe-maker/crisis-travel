import { Header } from '@/components/layout/Header';
import { SmartSearchHub } from '@/components/crisis/SmartSearchHub';
import { WorldMap } from '@/components/crisis/WorldMap';
import { OpportunityCards } from '@/components/crisis/HomeClientSections';
import { HowItWorks } from '@/components/crisis/HowItWorks';
import { CrisisScoreExplainer } from '@/components/crisis/CrisisScoreExplainer';
import { CountryFlag } from '@/components/design/CountryFlag';
import { DestinationImage } from '@/components/design/DestinationImage';
import { Eyebrow } from '@/components/design/atoms';
import { TARGET_COUNTRIES } from '@/lib/utils/countries';
import { CANDIDATE_CAP } from '@/lib/utils/selectCandidates';

/**
 * FRONT-002 — Homepage redesign (premium travel-editorial).
 * Built on the FRONT-001 foundation (--ctv3-* tokens, fonts, imagery system,
 * CountryFlag / DestinationImage / atoms). Scoped under .ctv3.
 *
 * Honesty: no fabricated metrics. Coverage is stated truthfully —
 *   - COVERED   = TARGET_COUNTRIES.length (catalog of covered destinations)
 *   - SCORED/RQ = CANDIDATE_CAP (destinations scored per analysis request)
 * The terminal/dashboard chrome and the invented stat block / ticker were
 * removed. TickerBanner is no longer rendered here (component kept in repo).
 */

const COVERED = TARGET_COUNTRIES.length; // 65 — covered destination catalog
const SCORED_PER_REQUEST = CANDIDATE_CAP; // 18 — scored per /api/analyze request

// A small, fixed set of covered destinations used as the editorial hero rail.
// Real countries from TARGET_COUNTRIES -> real flags + FRONT-001 imagery only.
const HERO_RAIL = ['PT', 'GE', 'MA', 'JP', 'VN', 'AL'] as const;

export default function HomePage() {
  return (
    <div className="ctv3" style={{ minHeight: '100vh', overflowX: 'hidden', background: 'var(--ctv3-ink-900)' }}>
      <Header />

      <main style={{ maxWidth: 1080, margin: '0 auto', padding: '0 20px 88px' }}>
        {/* ── HERO — editorial ───────────────────────────────── */}
        <section style={{ padding: '40px 0 28px' }}>
          <Eyebrow red>Intelligence voyage · temps réel</Eyebrow>

          <h1
            style={{
              fontFamily: 'var(--ctv3-display)',
              fontSize: 'clamp(34px, 7vw, 60px)',
              fontWeight: 900,
              lineHeight: 1.02,
              letterSpacing: '-0.035em',
              margin: '16px 0 18px',
              color: 'var(--ctv3-paper)',
              maxWidth: 760,
            }}
          >
            Le monde change.{' '}
            <span style={{ color: 'var(--ctv3-red)' }}>Vos destinations aussi.</span>
          </h1>

          <p
            className="ctv3-serif"
            style={{ maxWidth: 560, color: 'var(--ctv3-muted)', fontSize: 18, lineHeight: 1.6, margin: 0 }}
          >
            Nous analysons la <strong style={{ color: 'var(--ctv3-paper)', fontWeight: 600 }}>sécurité</strong>, la{' '}
            <strong style={{ color: 'var(--ctv3-paper)', fontWeight: 600 }}>géopolitique</strong>, le{' '}
            <strong style={{ color: 'var(--ctv3-paper)', fontWeight: 600 }}>budget</strong> et la{' '}
            <strong style={{ color: 'var(--ctv3-paper)', fontWeight: 600 }}>praticité</strong> pour révéler les
            destinations les plus avantageuses du moment.
          </p>

          {/* Honest coverage line — replaces the fabricated stat block */}
          <div
            className="ctv3-mono"
            style={{
              marginTop: 22,
              display: 'flex',
              flexWrap: 'wrap',
              gap: 18,
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
              jusqu’à <strong style={{ color: 'var(--ctv3-paper)', fontWeight: 700 }}>{SCORED_PER_REQUEST}</strong> analysées
              par requête
            </span>
            <span style={{ color: 'var(--ctv3-line-bright)' }}>·</span>
            <span>sources officielles &amp; marché</span>
          </div>

          {/* Editorial destination rail — photo-led (duotone fallback if no photo) */}
          <div
            style={{
              marginTop: 28,
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
              gap: 12,
            }}
          >
            {HERO_RAIL.map((code) => (
              <DestinationImage key={code} code={code} slot="card" aspect="3/4" showLabel={false} scrim="strong">
                <div style={{ position: 'absolute', left: 12, bottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <CountryFlag code={code} width={20} />
                </div>
              </DestinationImage>
            ))}
          </div>
        </section>

        {/* ── HOW IT WORKS — parcours pédagogique (FRONT-019) ── */}
        <section style={{ marginBottom: 36 }}>
          <HowItWorks />
        </section>

        {/* ── SCORE METHOD ───────────────────────────────────── */}
        <section style={{ marginBottom: 36 }}>
          <CrisisScoreExplainer />
        </section>

        {/* ── SEARCH / ANALYSE (functional core — preserved) ─── */}
        <section id="analyse" style={{ marginBottom: 40 }}>
          <SectionHead label="Lancer une analyse" meta="Sécurité · géo · budget · praticité" />
          <SmartSearchHub />
        </section>

        {/* ── WORLD MAP — ambient editorial visual ───────────── */}
        <section style={{ marginBottom: 40 }}>
          <SectionHead label="Carte des destinations" meta={`${COVERED} couvertes`} />
          <WorldMap showScores={false} />
        </section>

        {/* ── EDITORIAL DESTINATION ENTRIES ──────────────────── */}
        <section style={{ marginBottom: 40 }}>
          <SectionHead label="Commencer par une destination" meta="Points d’entrée" />
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

/* ── Section head (editorial, no terminal numbering) ───────── */
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
