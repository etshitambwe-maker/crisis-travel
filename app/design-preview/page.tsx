import type { Metadata } from 'next';
import { CountryFlag } from '@/components/design/CountryFlag';
import { DestinationImage } from '@/components/design/DestinationImage';
import {
  Eyebrow,
  SectionLabel,
  Chip,
  Button,
  VerdictScore,
  Sparkline,
} from '@/components/design/atoms';
import { DESTINATION_IMAGERY_LIST } from '@/lib/design/destinationImagery';

/**
 * FRONT-001 — Isolated design-system preview.
 * ISOLATION: not linked in any nav/header/footer, not in app/sitemap.ts
 * (which is an explicit allow-list), and noindex below + robots disallow.
 * Renders only design-foundation primitives — no production behavior.
 *
 * Note on the folder name: a Next.js App Router folder prefixed with `_`
 * (e.g. `_design-preview`) is a *private folder* excluded from routing, so
 * the page would never render. To keep the route reachable for visual
 * verification while staying isolated, it lives at `design-preview` with
 * noindex + robots disallow instead.
 */
export const metadata: Metadata = {
  title: 'Design Preview — FRONT-001',
  robots: { index: false, follow: false },
};

export default function DesignPreviewPage() {
  return (
    <main
      className="ctv3"
      style={{ minHeight: '100vh', padding: '32px 20px 80px', maxWidth: 1080, margin: '0 auto' }}
    >
      <header style={{ marginBottom: 28 }}>
        <Eyebrow red>FRONT-001 · Fondation design v3</Eyebrow>
        <h1 style={{ fontSize: 40, marginTop: 12 }}>Design Preview</h1>
        <p className="ctv3-serif" style={{ color: 'var(--ctv3-muted)', marginTop: 8, fontSize: 16 }}>
          Page isolée — tokens, polices, système image+drapeau ({DESTINATION_IMAGERY_LIST.length}{' '}
          destinations), atoms. Aucune photo curée n’existe encore : les slots affichent le
          fallback duotone premium (aucun <code>&lt;img&gt;</code> cassé n’est monté).
        </p>
      </header>

      {/* ── Fonts ─────────────────────────────────────────────── */}
      <section style={{ marginBottom: 40 }}>
        <SectionLabel num="01" label="Polices" meta="Archivo · Newsreader · JetBrains Mono" />
        <div style={{ display: 'grid', gap: 12 }}>
          <div style={{ fontFamily: 'var(--ctv3-display)', fontSize: 30, fontWeight: 900 }}>
            Archivo — display 900
          </div>
          <div className="ctv3-serif" style={{ fontSize: 20 }}>
            Newsreader — narration éditoriale en serif.
          </div>
          <div className="ctv3-mono" style={{ fontSize: 14 }}>
            JetBrains Mono — 0123456789 · DATA · MONO
          </div>
        </div>
      </section>

      {/* ── Atoms ─────────────────────────────────────────────── */}
      <section style={{ marginBottom: 40 }}>
        <SectionLabel num="02" label="Atoms" meta="chips · boutons · verdict · sparkline" />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
          <Chip tier="ideal">Idéale</Chip>
          <Chip tier="reco">Recommandée</Chip>
          <Chip tier="poss">Possible</Chip>
          <Chip tier="deco">Déconseillée</Chip>
          <Chip>Neutre</Chip>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 20, alignItems: 'center' }}>
          <Button variant="primary">Primary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="quiet">Quiet</Button>
          <Sparkline />
        </div>
        <div style={{ maxWidth: 420 }}>
          <VerdictScore
            score={76}
            confidence="élevée"
            sourceCount={4}
            verdict="Destination idéale pour une fenêtre courte : sécurité stable, monnaie favorable."
            pillars={[
              { label: 'Sécurité', value: 82, weight: 0.4 },
              { label: 'Géopolitique', value: 71, weight: 0.3 },
              { label: 'Budget', value: 74, weight: 0.2 },
              { label: 'Praticité', value: 66, weight: 0.1 },
            ]}
          />
        </div>
      </section>

      {/* ── Flags ─────────────────────────────────────────────── */}
      <section style={{ marginBottom: 40 }}>
        <SectionLabel num="03" label="Drapeaux" meta={`${DESTINATION_IMAGERY_LIST.length} pays`} />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14 }}>
          {DESTINATION_IMAGERY_LIST.map((d) => (
            <div key={d.countryCode} style={{ textAlign: 'center', width: 56 }}>
              <CountryFlag code={d.countryCode} width={48} />
              <div
                className="ctv3-mono"
                style={{ fontSize: 9, color: 'var(--ctv3-faint)', marginTop: 4, letterSpacing: '0.08em' }}
              >
                {d.countryCode}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Hero slots ────────────────────────────────────────── */}
      <section style={{ marginBottom: 40 }}>
        <SectionLabel num="04" label="Slots hero" meta="fallback duotone (aucune photo curée)" />
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
            gap: 16,
          }}
        >
          {DESTINATION_IMAGERY_LIST.map((d) => (
            <div key={d.countryCode}>
              <DestinationImage code={d.countryCode} slot="hero" aspect="16/9" />
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                <CountryFlag code={d.countryCode} width={22} />
                <span style={{ fontFamily: 'var(--ctv3-display)', fontWeight: 800, fontSize: 15 }}>
                  {d.name}
                </span>
                <span
                  className="ctv3-mono"
                  style={{ marginLeft: 'auto', fontSize: 9, color: 'var(--ctv3-faint)' }}
                >
                  {d.region}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Card slots ────────────────────────────────────────── */}
      <section style={{ marginBottom: 24 }}>
        <SectionLabel num="05" label="Slots card" meta="format compact 4:3" />
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
            gap: 12,
          }}
        >
          {DESTINATION_IMAGERY_LIST.slice(0, 6).map((d) => (
            <DestinationImage key={d.countryCode} code={d.countryCode} slot="card" aspect="4/3" />
          ))}
        </div>
      </section>

      {/* ── Override demo: a deliberately broken src must fall back ── */}
      <section>
        <SectionLabel num="06" label="Fallback sur erreur" meta="src invalide → duotone, jamais cassé" />
        <div style={{ maxWidth: 360 }}>
          <DestinationImage
            code="PT"
            slot="hero"
            aspect="16/9"
            src="/images/destinations/__does-not-exist__.jpg"
          />
        </div>
      </section>
    </main>
  );
}
