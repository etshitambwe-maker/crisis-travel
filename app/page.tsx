import { Header } from '@/components/layout/Header';
import { TickerBanner } from '@/components/crisis/TickerBanner';
import { SmartSearchHub } from '@/components/crisis/SmartSearchHub';

export default function HomePage() {
  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0f' }}>
      <Header />
      <TickerBanner />

      <main style={{ maxWidth: 800, margin: '0 auto', padding: '48px 24px' }}>

        {/* Hero */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <h1 style={{
            fontFamily: 'var(--font-space-mono)',
            fontSize: 'clamp(2.5rem, 8vw, 5rem)',
            fontWeight: 700, color: '#ffffff',
            letterSpacing: '0.05em', lineHeight: 1.1, marginBottom: 12,
          }}>
            CRISIS<br /><span style={{ color: '#ff4d2e' }}>TRAVEL</span>
          </h1>
          <p style={{ color: '#6b7280', fontSize: '1.05rem', maxWidth: 480, margin: '0 auto' }}>
            Intelligence géopolitique appliquée au voyage. Sécurité, budget et opportunités — en temps réel.
          </p>
        </div>

        {/* Hub de recherche intelligent */}
        <SmartSearchHub />

        {/* Sources */}
        <p style={{ textAlign: 'center', marginTop: 28, fontSize: '0.65rem', color: '#3f3f5a' }}>
          Sources : MEAE France · US State Dept · UK FCDO · ACLED · World Bank · Perplexity · Claude AI
        </p>
      </main>
    </div>
  );
}
