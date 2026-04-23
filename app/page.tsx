import Link from 'next/link';
import { Header } from '@/components/layout/Header';
import { TickerBanner } from '@/components/crisis/TickerBanner';
import { TravelForm } from './TravelForm';

export default function HomePage() {
  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0f' }}>
      <Header />
      <TickerBanner />

      <main style={{ maxWidth: 800, margin: '0 auto', padding: '48px 24px' }}>
        {/* Hero */}
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
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

        {/* Formulaire */}
        <div style={{ background: '#13131a', border: '1px solid #1e1e2e', borderRadius: 16, padding: '32px' }}>
          <h2 style={{ fontFamily: 'var(--font-space-mono)', fontSize: '1rem', color: '#e8e8e8', marginBottom: 24, letterSpacing: '0.1em' }}>
            TROUVER MA PROCHAINE DESTINATION
          </h2>
          <TravelForm />
        </div>

        {/* Modes spéciaux */}
        <div style={{ marginTop: 24, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          {[
            { title: 'MODE BUNKER', desc: 'Sécurité absolue. Niveau 1 MEAE uniquement.', icon: '🛡️', mode: 'bunker' },
            { title: 'CRISE DE PORTEFEUILLE', desc: 'Budget serré. Destinations oubliées et sûres.', icon: '💸', mode: 'budget_crisis' },
            { title: 'OPPORTUNITÉ', desc: 'Taux de change exceptionnellement favorable.', icon: '📈', mode: 'standard' },
          ].map((m) => (
            <Link key={m.mode} href={`/results?mode=${m.mode}`} style={{ textDecoration: 'none' }}>
              <div style={{
                background: '#13131a', border: '1px solid #1e1e2e', borderRadius: 12, padding: '16px',
              }}>
                <div style={{ fontSize: '1.5rem', marginBottom: 6 }}>{m.icon}</div>
                <div style={{ fontFamily: 'var(--font-space-mono)', fontSize: '0.68rem', color: '#ff4d2e', letterSpacing: '0.08em', marginBottom: 4 }}>
                  {m.title}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>{m.desc}</div>
              </div>
            </Link>
          ))}
        </div>

        <p style={{ textAlign: 'center', marginTop: 32, fontSize: '0.72rem', color: '#3f3f5a' }}>
          Sources : MEAE France · US State Dept · UK FCDO · ACLED · World Bank · Perplexity · Claude AI
        </p>
      </main>
    </div>
  );
}
