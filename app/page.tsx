import Link from 'next/link';
import { Header } from '@/components/layout/Header';
import { TickerBanner } from '@/components/crisis/TickerBanner';
import { TravelForm } from './TravelForm';
import { CountrySearchBar } from '@/components/crisis/CountrySearchBar';

export default function HomePage() {
  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0f' }}>
      <Header />
      <TickerBanner />

      <main style={{ maxWidth: 800, margin: '0 auto', padding: '48px 24px' }}>

        {/* ── Hero ─────────────────────────────────────────────── */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <h1 style={{
            fontFamily: 'var(--font-space-mono)', fontSize: 'clamp(2.5rem, 8vw, 5rem)',
            fontWeight: 700, color: '#ffffff', letterSpacing: '0.05em', lineHeight: 1.1, marginBottom: 12,
          }}>
            CRISIS<br /><span style={{ color: '#ff4d2e' }}>TRAVEL</span>
          </h1>
          <p style={{ color: '#6b7280', fontSize: '1.05rem', maxWidth: 480, margin: '0 auto' }}>
            Voyagez intelligemment. Sécurité, géopolitique et budget — en temps réel.
          </p>
        </div>

        {/* ── Recherche directe par pays ─────────────────────── */}
        <div style={{ marginBottom: 12 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10,
          }}>
            <div style={{ flex: 1, height: 1, background: '#1e1e2e' }} />
            <span style={{
              fontFamily: 'var(--font-space-mono)', fontSize: '0.65rem',
              color: '#3f3f5a', letterSpacing: '0.12em', whiteSpace: 'nowrap',
            }}>
              ANALYSE DIRECTE
            </span>
            <div style={{ flex: 1, height: 1, background: '#1e1e2e' }} />
          </div>
          <CountrySearchBar />
          <p style={{ fontSize: '0.72rem', color: '#3f3f5a', marginTop: 8, textAlign: 'center' }}>
            Tape un pays, une ville ou un code ISO — ex : &quot;Congo&quot;, &quot;Bali&quot;, &quot;TH&quot;
          </p>
        </div>

        {/* ── Séparateur OU ─────────────────────────────────── */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12, margin: '24px 0',
        }}>
          <div style={{ flex: 1, height: 1, background: '#1e1e2e' }} />
          <span style={{
            fontFamily: 'var(--font-space-mono)', fontSize: '0.72rem',
            color: '#3f3f5a', letterSpacing: '0.12em',
          }}>OU SCAN MONDIAL</span>
          <div style={{ flex: 1, height: 1, background: '#1e1e2e' }} />
        </div>

        {/* ── Formulaire scan mondial ────────────────────────── */}
        <div style={{ background: '#13131a', border: '1px solid #1e1e2e', borderRadius: 16, padding: '28px' }}>
          <h2 style={{
            fontFamily: 'var(--font-space-mono)', fontSize: '0.85rem',
            color: '#6b7280', marginBottom: 20, letterSpacing: '0.1em',
          }}>
            TROUVER MA PROCHAINE DESTINATION — 60 PAYS ANALYSÉS
          </h2>
          <TravelForm />
        </div>

        {/* ── Modes spéciaux ────────────────────────────────── */}
        <div style={{ marginTop: 20, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          {[
            { title: 'MODE BUNKER', desc: 'Sécurité absolue. Niveau 1 MEAE uniquement.', icon: '🛡️', mode: 'bunker' },
            { title: 'CRISE DE PORTEFEUILLE', desc: 'Budget serré. Destinations oubliées et sûres.', icon: '💸', mode: 'budget_crisis' },
            { title: 'OPPORTUNITÉ', desc: 'Taux de change exceptionnellement favorable.', icon: '📈', mode: 'standard' },
          ].map((m) => (
            <Link key={m.mode} href={`/results?mode=${m.mode}`} style={{ textDecoration: 'none' }}>
              <div style={{
                background: '#13131a', border: '1px solid #1e1e2e', borderRadius: 12,
                padding: '14px', cursor: 'pointer',
              }}>
                <div style={{ fontSize: '1.4rem', marginBottom: 5 }}>{m.icon}</div>
                <div style={{
                  fontFamily: 'var(--font-space-mono)', fontSize: '0.65rem',
                  color: '#ff4d2e', letterSpacing: '0.08em', marginBottom: 3,
                }}>
                  {m.title}
                </div>
                <div style={{ fontSize: '0.72rem', color: '#6b7280' }}>{m.desc}</div>
              </div>
            </Link>
          ))}
        </div>

        <p style={{ textAlign: 'center', marginTop: 28, fontSize: '0.68rem', color: '#3f3f5a' }}>
          Sources : MEAE France · US State Dept · UK FCDO · ACLED · World Bank · Perplexity · Claude AI
        </p>
      </main>
    </div>
  );
}
