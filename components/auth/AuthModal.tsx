'use client';
import { useState } from 'react';
import { createSupabaseBrowserClient } from '@/lib/auth/supabase-client';
import { safeNext } from '@/lib/auth/safe-next';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  /**
   * Relative path to return to after login. Defaults to the current page
   * (pathname + search) so the user lands back where they started.
   * Sanitized again server-side in /auth/callback.
   */
  next?: string;
}

export function AuthModal({ isOpen, onClose, next }: Props) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supabase = createSupabaseBrowserClient();

  /** Build the auth callback URL carrying a safe relative `next`. */
  function callbackUrl(): string {
    const fallback =
      typeof window !== 'undefined'
        ? window.location.pathname + window.location.search
        : '/';
    const target = safeNext(next ?? fallback);
    const base = `${window.location.origin}/auth/callback`;
    return target === '/' ? base : `${base}?next=${encodeURIComponent(target)}`;
  }

  async function handleMagicLink() {
    if (!email || !email.includes('@')) {
      setError('Email invalide');
      return;
    }
    setLoading(true);
    setError(null);
    const { error: authError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: callbackUrl(),
      },
    });
    setLoading(false);
    if (authError) {
      setError(authError.message);
    } else {
      setSent(true);
    }
  }

  async function handleGoogle() {
    setLoading(true);
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: callbackUrl() },
    });
  }

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 500,
      background: 'rgba(6,6,10,0.88)', backdropFilter: 'blur(16px)',
      display: 'grid', placeItems: 'center', padding: 20,
    }} onClick={onClose}>
      <div
        style={{
          width: '100%', maxWidth: 380,
          background: 'var(--ctv3-ink-870)', border: '1px solid var(--ctv3-line-bright)',
          borderRadius: 16, padding: 28,
          boxShadow: '0 24px 64px rgba(0,0,0,0.8)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <div style={{
            fontFamily: 'var(--ctv3-mono)',
            fontSize: '0.6rem', letterSpacing: '0.18em', color: 'var(--ctv3-red)',
            textTransform: 'uppercase', marginBottom: 8,
          }}>
            CRISIS TRAVEL
          </div>
          <h2 style={{
            margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--ctv3-paper)',
            fontFamily: 'var(--ctv3-mono)', letterSpacing: '-0.02em',
          }}>
            Connexion
          </h2>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--ctv3-faint)', lineHeight: 1.4 }}>
            Accédez à vos analyses illimitées et alertes pays.
          </p>
        </div>

        {sent ? (
          <div style={{
            padding: '16px', borderRadius: 10,
            background: 'rgba(70,184,136,0.1)', border: '1px solid rgba(70,184,136,0.3)',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>✉️</div>
            <div style={{ color: 'var(--ctv3-ideal)', fontWeight: 600, marginBottom: 4 }}>Lien envoyé !</div>
            <div style={{ color: 'var(--ctv3-muted)', fontSize: 13 }}>
              Vérifiez votre boîte mail <strong style={{ color: 'var(--ctv3-paper)' }}>{email}</strong>
            </div>
          </div>
        ) : (
          <>
            {/* Google OAuth */}
            <button
              onClick={handleGoogle}
              disabled={loading}
              style={{
                width: '100%', padding: '11px', borderRadius: 10, cursor: 'pointer',
                background: 'var(--ctv3-ink-800)', border: '1px solid var(--ctv3-line-bright)',
                color: 'var(--ctv3-paper)', fontSize: 14, fontWeight: 600,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                marginBottom: 12, transition: 'background 0.15s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--ctv3-ink-700)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--ctv3-ink-800)'; }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Continuer avec Google
            </button>

            <div style={{
              display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12,
              color: 'var(--ctv3-dim)', fontSize: 11,
              fontFamily: 'var(--ctv3-mono)', letterSpacing: '0.1em',
            }}>
              <div style={{ flex: 1, height: 1, background: 'var(--ctv3-line-soft)' }} />
              OU
              <div style={{ flex: 1, height: 1, background: 'var(--ctv3-line-soft)' }} />
            </div>

            {/* Email magic link */}
            <input
              type="email"
              placeholder="votre@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleMagicLink()}
              style={{
                width: '100%', padding: '10px 12px', borderRadius: 8,
                background: 'var(--ctv3-ink-950)', border: `1px solid ${error ? 'var(--ctv3-red)' : 'var(--ctv3-line)'}`,
                color: 'var(--ctv3-paper)', fontSize: 14,
                outline: 'none', boxSizing: 'border-box',
                marginBottom: 8,
              }}
            />

            {error && (
              <div style={{ color: 'var(--ctv3-red)', fontSize: 12, marginBottom: 8 }}>{error}</div>
            )}

            <button
              onClick={handleMagicLink}
              disabled={loading || !email}
              style={{
                width: '100%', padding: '11px', borderRadius: 10, cursor: 'pointer',
                background: email ? 'var(--ctv3-red)' : 'var(--ctv3-ink-800)',
                border: 'none', color: email ? '#fff' : 'var(--ctv3-dim)',
                fontFamily: 'var(--ctv3-mono)',
                fontSize: '0.72rem', letterSpacing: '0.12em', fontWeight: 700,
                transition: 'all 0.2s',
                boxShadow: email ? '0 4px 16px rgba(228,51,43,0.3)' : 'none',
              }}
            >
              {loading ? '⏳ ENVOI...' : '✉ ENVOYER LE LIEN MAGIQUE →'}
            </button>
          </>
        )}

        <p style={{ marginTop: 16, fontSize: 11, color: 'var(--ctv3-dim)', textAlign: 'center', lineHeight: 1.5 }}>
          En vous connectant, vous acceptez les CGU de Crisis Travel.
          Aucun mot de passe requis.
        </p>
      </div>
    </div>
  );
}
