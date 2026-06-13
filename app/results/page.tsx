import { Suspense } from 'react';
import { Header } from '@/components/layout/Header';
import { ResultsContent } from './ResultsContent';
// LOADING-UX-001 : on réutilise le loader plein écran déjà éprouvé (halo/scan ctv3,
// 100vh, prefers-reduced-motion) au lieu d'un fallback texte minimal qui laissait un
// flash/saut visuel avant que l'overlay de ResultsContent ne prenne le relais.
import ResultsLoading from './loading';

export default function ResultsPage() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--ctv3-ink-900, #09090b)' }}>
      <Header />
      <Suspense fallback={<ResultsLoading />}>
        <ResultsContent />
      </Suspense>
    </div>
  );
}
