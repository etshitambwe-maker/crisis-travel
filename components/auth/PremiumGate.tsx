'use client';
import { useState } from 'react';
import { AuthModal } from './AuthModal';

interface Props {
  children: React.ReactNode;
  feature: string;
  description?: string;
  isPremium?: boolean;
  isLoggedIn?: boolean;
  /**
   * 'overlay' (défaut) : blur du children + overlay absolu. Adapté aux GRANDS
   *   contenus (ex. bloc Synthèse IA) qui donnent à l'overlay une surface suffisante.
   * 'card' : carte premium autonome, centrée et responsive. À utiliser quand le
   *   children est PETIT (ex. bouton Export PDF ~40px) : l'overlay absolu s'écrasait
   *   alors sur le bouton et coupait le contenu via overflow:hidden (PREMIUM-UX-001).
   */
  variant?: 'overlay' | 'card';
}

// Bénéfices premium affichés dans le gate — wording court, la grille complète
// (plans détaillés, FAQ) reste sur /pricing. PREMIUM-FLOW-001C.
const PREMIUM_BENEFITS = ['PDF illimité', 'Préparer mon itinéraire', 'Analyses illimitées'] as const;

/**
 * CTA du gate, conscient de l'état (PREMIUM-FLOW-001C).
 *
 *   - non connecté         → bouton qui ouvre AuthModal (onLogin → setShowAuth(true)).
 *   - connecté non premium → lien <a href="/pricing"> ("Voir les offres Premium").
 *                            On NE rouvre PLUS la connexion à un utilisateur déjà connecté.
 *
 * Aligné sur le pattern HTTP 402 de PdfExportButton/ItineraryBlock (402 → /pricing).
 */
function PremiumCta({ isLoggedIn, onLogin, style }: { isLoggedIn: boolean; onLogin: () => void; style: React.CSSProperties }) {
  if (isLoggedIn) {
    return (
      <a
        href="/pricing"
        className="ctv3-mono"
        style={{ ...style, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none', boxSizing: 'border-box' }}
      >
        ⚡ Voir les offres Premium →
      </a>
    );
  }
  return (
    <button
      onClick={onLogin}
      className="ctv3-mono"
      style={style}
      onMouseEnter={(e) => { e.currentTarget.style.background = '#e4ba5a'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--ctv3-reco)'; }}
    >
      🔐 Se connecter →
    </button>
  );
}

export function PremiumGate({ children, feature, description, isPremium = false, isLoggedIn = false, variant = 'overlay' }: Props) {
  const [showAuth, setShowAuth] = useState(false);

  if (isPremium) {
    return <>{children}</>;
  }

  // ── Variant CARD : carte premium autonome, largeur fluide, CTA full-width ──────
  // Pas d'overlay absolu sur le children → plus d'écrasement / coupure. Le children
  // n'est pas rendu (un bouton premium-gated n'a pas à apparaître flouté).
  if (variant === 'card') {
    return (
      <>
        <div style={{
          width: '100%',
          borderRadius: 12, border: '1px solid var(--ctv3-line-bright)',
          background: 'linear-gradient(135deg, rgba(216,168,62,0.06), var(--ctv3-ink-850))',
          padding: '20px 18px',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          textAlign: 'center', gap: 12,
        }}>
          {/* Icon */}
          <div style={{
            width: 40, height: 40, borderRadius: '50%',
            background: 'linear-gradient(135deg, rgba(216,168,62,0.2), rgba(217,116,46,0.1))',
            border: '1px solid rgba(216,168,62,0.4)',
            display: 'grid', placeItems: 'center', fontSize: 18, flexShrink: 0,
          }}>
            ⚡
          </div>

          <div>
            <div className="ctv3-mono" style={{
              fontSize: '0.62rem', letterSpacing: '0.14em', color: 'var(--ctv3-reco)',
              fontWeight: 700, textTransform: 'uppercase', marginBottom: 6,
            }}>
              FONCTIONNALITÉ PREMIUM
            </div>
            <div style={{ color: 'var(--ctv3-paper)', fontSize: 15, fontWeight: 600, marginBottom: 4 }}>
              {feature}
            </div>
            {description && (
              <div style={{ color: 'var(--ctv3-muted)', fontSize: 12.5, lineHeight: 1.45, maxWidth: 320, margin: '0 auto' }}>
                {description}
              </div>
            )}
          </div>

          {/* Bénéfices premium — wording court (la grille complète reste sur /pricing) */}
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, width: '100%', maxWidth: 320, display: 'flex', flexDirection: 'column', gap: 5 }}>
            {PREMIUM_BENEFITS.map((b) => (
              <li key={b} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: 'var(--ctv3-muted)' }}>
                <span style={{ color: 'var(--ctv3-reco)', fontWeight: 700, flexShrink: 0 }}>+</span>
                {b}
              </li>
            ))}
          </ul>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%', maxWidth: 320 }}>
            <div className="ctv3-mono" style={{
              fontSize: '0.55rem', color: 'var(--ctv3-faint)', letterSpacing: '0.1em', textTransform: 'uppercase',
            }}>
              9€/MOIS · 79€/AN
            </div>

            <PremiumCta
              isLoggedIn={isLoggedIn}
              onLogin={() => setShowAuth(true)}
              style={{
                width: '100%',
                padding: '12px 16px', borderRadius: 8, cursor: 'pointer',
                background: 'var(--ctv3-reco)', border: 'none', color: 'var(--ctv3-ink-950)',
                fontSize: '0.7rem', letterSpacing: '0.12em', fontWeight: 700, textTransform: 'uppercase',
                transition: 'background 0.2s',
                boxShadow: '0 4px 16px rgba(216,168,62,0.3)',
              }}
            />

            {!isLoggedIn && (
              <div style={{ fontSize: 11, color: 'var(--ctv3-faint)' }}>
                3 analyses gratuites / mois sans inscription
              </div>
            )}
          </div>
        </div>

        <AuthModal isOpen={showAuth} onClose={() => setShowAuth(false)} />
      </>
    );
  }

  // ── Variant OVERLAY (défaut, historique) : blur children + overlay absolu ──────
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

          {/* Bénéfices premium — wording court (la grille complète reste sur /pricing) */}
          <div className="ctv3-mono" style={{
            fontSize: 11, color: 'var(--ctv3-muted)', lineHeight: 1.5, maxWidth: 240,
          }}>
            + PDF illimité · Préparer mon itinéraire · Analyses illimitées
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%', maxWidth: 240 }}>
            {/* Pricing info */}
            <div style={{
              fontFamily: 'var(--ctv3-mono)',
              fontSize: '0.55rem', color: 'var(--ctv3-faint)', letterSpacing: '0.1em', textTransform: 'uppercase',
            }}>
              9€/MOIS · 79€/AN
            </div>

            <PremiumCta
              isLoggedIn={isLoggedIn}
              onLogin={() => setShowAuth(true)}
              style={{
                padding: '10px 16px', borderRadius: 8, cursor: 'pointer',
                background: 'var(--ctv3-reco)', border: 'none', color: 'var(--ctv3-ink-950)',
                fontFamily: 'var(--ctv3-mono)',
                fontSize: '0.65rem', letterSpacing: '0.12em', fontWeight: 700, textTransform: 'uppercase',
                transition: 'all 0.2s',
                boxShadow: '0 4px 16px rgba(216,168,62,0.3)',
              }}
            />

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
