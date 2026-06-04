import { Suspense } from 'react';
import { Header } from '@/components/layout/Header';
import { ResultsContent } from './ResultsContent';

export default function ResultsPage() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--ctv3-ink-900, #09090b)' }}>
      <Header />
      <Suspense fallback={
        <div className="ctv3">
          <main style={{ maxWidth: 860, margin: '0 auto', padding: '80px 24px', textAlign: 'center' }}>
            <div
              className="ctv3-mono"
              style={{ color: 'var(--ctv3-faint)', fontSize: 12, letterSpacing: '0.18em', textTransform: 'uppercase' }}
            >
              Préparation de l’analyse…
            </div>
          </main>
        </div>
      }>
        <ResultsContent />
      </Suspense>
    </div>
  );
}
