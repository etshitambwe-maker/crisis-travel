'use client';
import { useRouter } from 'next/navigation';
import type { CrisisScore } from '@/types/crisis.types';
import { PdfExportButton } from './PdfExportButton';

/**
 * PREMIUM-FLOW-001F — Actions premium réelles du bloc « Aller plus loin ».
 * ─────────────────────────────────────────────────────────────────────────────
 * Rendu UNIQUEMENT pour un utilisateur premium (en children du PremiumGate
 * unifié de la page destination). Aucun upsell ici : ce composant n'affiche que
 * les vraies actions disponibles, sous la synthèse IA complète :
 *
 *   1. « Préparer mon itinéraire » → redirige vers /results (le vrai flow
 *      itinéraire qui collecte durée/budget/type). On NE génère RIEN ici et on
 *      n'appelle AUCUNE route d'itinéraire (pas de valeurs figées).
 *   2. « Exporter en PDF » → PdfExportButton inchangé (réutilise scoreSnapshot +
 *      narrative déjà calculés en SSR ; pas de second appel Claude).
 *
 * Remplace l'ancien trio (PremiumGate « Synthèse IA » + PrepareItineraryCta
 * autonome + PremiumGate « Export PDF »), qui répétait les mêmes promesses.
 */

interface Props {
  countryCode: string;
  countryName: string;
  scoreSnapshot: CrisisScore;
  narrative: string;
}

export function PremiumActions({ countryCode, countryName, scoreSnapshot, narrative }: Props) {
  const router = useRouter();

  return (
    <div
      data-testid="premium-actions"
      style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', marginTop: 18, paddingTop: 16, borderTop: '1px solid var(--ctv3-line-soft)' }}
    >
      <button
        type="button"
        data-testid="premium-itinerary-btn"
        onClick={() => router.push('/results')}
        className="ctv3-mono"
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 7,
          padding: '11px 16px', cursor: 'pointer',
          background: 'var(--ctv3-blue)', border: 'none', color: '#fff',
          fontSize: 10.5, letterSpacing: '0.12em', fontWeight: 700, textTransform: 'uppercase',
        }}
      >
        Préparer mon itinéraire →
      </button>

      <PdfExportButton
        countryCode={countryCode}
        countryName={countryName}
        scoreSnapshot={scoreSnapshot}
        narrative={narrative}
      />
    </div>
  );
}
