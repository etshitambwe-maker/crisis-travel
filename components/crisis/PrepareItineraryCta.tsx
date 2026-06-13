'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AuthModal } from '@/components/auth/AuthModal';

/**
 * PREMIUM-FLOW-001D — CTA "Préparer mon itinéraire" sur /destination/[country].
 * ─────────────────────────────────────────────────────────────────────────────
 * Entrée premium VISIBLE. Trois états (alignés sur le pattern HTTP 401/402) :
 *   - non connecté          → ouvre AuthModal (retour /results après login).
 *   - connecté non premium  → /pricing.
 *   - premium               → redirige vers /results (le vrai flow itinéraire,
 *                             qui collecte durée/budget/type ; on NE génère PAS
 *                             d'itinéraire ici avec des valeurs figées).
 *
 * La page destination ne possède pas les vraies infos du voyage : ce CTA
 * n'appelle AUCUNE route d'itinéraire et ne génère rien. Il oriente seulement.
 */

interface Props {
  isLoggedIn?: boolean;
  isPremium?: boolean;
}

export function PrepareItineraryCta({ isLoggedIn = false, isPremium = false }: Props) {
  const router = useRouter();
  const [showAuth, setShowAuth] = useState(false);

  function handleClick() {
    if (isPremium) {
      // Premium : on rejoint le flow itinéraire existant.
      router.push('/results');
      return;
    }
    if (isLoggedIn) {
      // Connecté mais non premium → offres.
      router.push('/pricing');
      return;
    }
    // Non connecté → connexion, retour /results après login (safeNext préservé).
    setShowAuth(true);
  }

  const hint = isPremium
    ? 'Itinéraire jour par jour, basé sur votre durée et votre profil.'
    : isLoggedIn
      ? 'Fonctionnalité Premium — débloquez l’itinéraire personnalisé.'
      : 'Connectez-vous pour préparer votre itinéraire.';

  return (
    <div
      data-testid="prepare-itinerary-cta"
      style={{
        width: '100%',
        border: '1px solid var(--ctv3-line-bright)',
        borderTop: '2px solid var(--ctv3-blue)',
        background: 'linear-gradient(135deg, rgba(91,141,239,0.07), var(--ctv3-ink-850))',
        padding: '18px 20px',
        display: 'flex', flexDirection: 'column', gap: 12,
      }}
    >
      <div>
        <span className="ctv3-mono" style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--ctv3-blue)',
        }}>
          <span style={{ width: 14, height: 1, background: 'currentColor', opacity: 0.6 }} />
          Premium · Itinéraire IA
        </span>
        <h3 style={{
          fontFamily: 'var(--ctv3-display)', fontWeight: 800, fontSize: 18,
          letterSpacing: '-0.02em', color: 'var(--ctv3-paper)', margin: '8px 0 4px',
        }}>
          Préparer mon itinéraire
        </h3>
        <p className="ctv3-serif" style={{ fontSize: 13.5, color: 'var(--ctv3-muted)', lineHeight: 1.45, margin: 0 }}>
          {hint}
        </p>
      </div>

      <button
        type="button"
        data-testid="prepare-itinerary-btn"
        onClick={handleClick}
        className="ctv3-mono"
        style={{
          width: '100%', maxWidth: 320,
          padding: '12px 18px', cursor: 'pointer',
          background: isPremium ? 'var(--ctv3-blue)' : 'var(--ctv3-reco)',
          border: 'none', color: isPremium ? '#fff' : 'var(--ctv3-ink-950)',
          fontSize: 11, letterSpacing: '0.12em', fontWeight: 700, textTransform: 'uppercase',
        }}
      >
        {isPremium ? 'Préparer mon itinéraire →' : isLoggedIn ? '⚡ Voir les offres Premium →' : '🔐 Se connecter →'}
      </button>

      {/* Non connecté : retour /results après login (safeNext sanitize le next). */}
      <AuthModal isOpen={showAuth} onClose={() => setShowAuth(false)} next="/results" />
    </div>
  );
}
