'use client';
import { useState } from 'react';
import { AuthModal } from '@/components/auth/AuthModal';

export function DashboardLoginCta() {
  const [showAuth, setShowAuth] = useState(false);

  return (
    <>
      <div style={{
        padding: '40px 24px', border: '1px solid var(--ctv3-line)',
        background: 'var(--ctv3-ink-850)', textAlign: 'center',
      }}>
        <p className="ctv3-mono" style={{
          fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase',
          color: 'var(--ctv3-faint)', marginBottom: 12,
        }}>
          CONNEXION REQUISE
        </p>
        <p className="ctv3-serif" style={{ fontSize: 14, color: 'var(--ctv3-muted)', marginBottom: 24, lineHeight: 1.5 }}>
          Connectez-vous pour accéder à votre historique d&apos;analyses et retrouver vos destinations avec le même contexte de voyage.
        </p>
        <button
          onClick={() => setShowAuth(true)}
          className="ctv3-mono"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '11px 24px', minHeight: 40,
            background: 'var(--ctv3-red)', border: 'none', cursor: 'pointer',
            color: '#fff', fontSize: 10.5, letterSpacing: '0.12em',
            textTransform: 'uppercase', fontWeight: 700,
            boxShadow: '0 4px 16px rgba(228,51,43,0.3)',
            transition: 'background 0.15s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(228,51,43,0.85)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--ctv3-red)'; }}
        >
          Se connecter pour voir mon tableau de bord
        </button>
      </div>
      <AuthModal isOpen={showAuth} onClose={() => setShowAuth(false)} next="/dashboard" />
    </>
  );
}
