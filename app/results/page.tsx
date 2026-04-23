import { Suspense } from 'react';
import { Header } from '@/components/layout/Header';
import { ResultsContent } from './ResultsContent';

export default function ResultsPage() {
  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0f' }}>
      <Header />
      <Suspense fallback={
        <main style={{ maxWidth: 800, margin: '0 auto', padding: '80px 24px', textAlign: 'center' }}>
          <div style={{ fontFamily: 'var(--font-space-mono)', color: '#ff4d2e', fontSize: '1rem', marginBottom: 12 }}>
            ⚡ CHARGEMENT...
          </div>
        </main>
      }>
        <ResultsContent />
      </Suspense>
    </div>
  );
}
