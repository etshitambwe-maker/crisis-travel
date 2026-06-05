'use client';
import { useState } from 'react';
import { AuthModal } from './AuthModal';

interface Props {
  children: React.ReactNode;
  feature: string;
  description?: string;
  isPremium?: boolean;
  isLoggedIn?: boolean;
}

export function PremiumGate({ children, feature, description, isPremium = false, isLoggedIn = false }: Props) {
  const [showAuth, setShowAuth] = useState(false);

  if (isPremium) {
    return <>{children}</>;
  }

  return (
    <>
      <div style={{
        position: 'relative', borderRadius: 12, overflow: 'hidden',
      }}>
        {/* Content blurred */}
        <div style={{ filter: 'blur(4px)', opacity: 0.4, pointerEvents: 'none', userSelect: 'none' }}>
          {children}
        </div>

        {/* Overlay */}
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(6,6,10,0.75)', backdropFilter: 'blur(2px)',
          borderRadius: 12, border: '1px solid var(--ctv3-line-bright)',
          padding: 20, textAlign: 'center',
          gap: 12,
        }}>
          {/* Icon */}
          <div style={{
            width: 40, height: 40, borderRadius: '50%',
            background: 'linear-gradient(135deg, rgba(216,168,62,0.2), rgba(217,116,46,0.1))',
            border: '1px solid rgba(216,168,62,0.4)',
            display: 'grid', placeItems: 'center',
            fontSize: 18,
          }}>
            ⚡
          </div>

          <div>
            <div style={{
              fontFamily: 'var(--ctv3-mono)',
              fontSize: '0.62rem', letterSpacing: '0.14em', color: 'var(--ctv3-reco)',
              fontWeight: 700, textTransform: 'uppercase', marginBottom: 6,
            }}>
              FONCTIONNALITÉ PREMIUM
            </div>
            <div style={{ color: 'var(--ctv3-paper)', fontSize: 15, fontWeight: 600, marginBottom: 4 }}>
              {feature}
            </div>
            {description && (
              <div style={{ color: 'var(--ctv3-muted)', fontSize: 12, lineHeight: 1.45, maxWidth: 240 }}>
                {description}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%', maxWidth: 220 }}>
            {/* Pricing info */}
            <div style={{
              fontFamily: 'var(--ctv3-mono)',
              fontSize: '0.55rem', color: 'var(--ctv3-faint)', letterSpacing: '0.1em', textTransform: 'uppercase',
            }}>
              À PARTIR DE 9€/MOIS
            </div>

            <button
              onClick={() => setShowAuth(true)}
              style={{
                padding: '10px 16px', borderRadius: 8, cursor: 'pointer',
                background: 'var(--ctv3-reco)', border: 'none', color: 'var(--ctv3-ink-950)',
                fontFamily: 'var(--ctv3-mono)',
                fontSize: '0.65rem', letterSpacing: '0.12em', fontWeight: 700,
                transition: 'all 0.2s',
                boxShadow: '0 4px 16px rgba(216,168,62,0.3)',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#e4ba5a'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--ctv3-reco)'; }}
            >
              {isLoggedIn ? '⚡ PASSER À PREMIUM →' : '🔐 SE CONNECTER →'}
            </button>

            {!isLoggedIn && (
              <div style={{ fontSize: 11, color: 'var(--ctv3-faint)' }}>
                3 analyses gratuites / mois sans inscription
              </div>
            )}
          </div>
        </div>
      </div>

      <AuthModal isOpen={showAuth} onClose={() => setShowAuth(false)} />
    </>
  );
}
