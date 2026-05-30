'use client';
import { useState } from 'react';
import { createSupabaseBrowserClient } from '@/lib/auth/supabase-client';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export function AuthModal({ isOpen, onClose }: Props) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supabase = createSupabaseBrowserClient();

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
        emailRedirectTo: `${window.location.origin}/auth/callback`,
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
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  }

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 500,
      background: 'rgba(7,7,12,0.88)', backdropFilter: 'blur(16px)',
      display: 'grid', placeItems: 'center', padding: 20,
    }} onClick={onClose}>
      <div
        style={{
          width: '100%', maxWidth: 380,
          background: '#11111c', border: '1px solid #2e2e45',
          borderRadius: 16, padding: 28,
          boxShadow: '0 24px 64px rgba(0,0,0,0.8)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <div style={{
            fontFamily: 'var(--ct-mono, var(--font-space-mono), monospace)',
            fontSize: '0.6rem', letterSpacing: '0.18em', color: '#ff3b2f',
            textTransform: 'uppercase', marginBottom: 8,
          }}>
            CRISIS TRAVEL
          </div>
          <h2 style={{
            margin: 0, fontSize: 22, fontWeight: 700, color: '#f0f0f5',
            fontFamily: 'var(--font-space-mono), monospace', letterSpacing: '-0.02em',
          }}>
            Connexion
          </h2>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: '#6b6b85', lineHeight: 1.4 }}>
            Accédez à vos analyses illimitées et alertes pays.
          </p>
        </div>

        {sent ? (
          <div style={{
            padding: '16px', borderRadius: 10,
            background: 'rgba(61,220,151,0.1)', border: '1px solid rgba(61,220,151,0.3)',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>✉️</div>
            <div style={{ color: '#3ddc97', fontWeight: 600, marginBottom: 4 }}>Lien envoyé !</div>
            <div style={{ color: '#9898b0', fontSize: 13 }}>
              Vérifiez votre boîte mail <strong style={{ color: '#f0f0f5' }}>{email}</strong>
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
                background: '#1e1e2e', border: '1px solid #2e2e45',
                color: '#f0f0f5', fontSize: 14, fontWeight: 600,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                marginBottom: 12, transition: 'background 0.15s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#252535'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = '#1e1e2e'; }}
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
              color: '#3f3f5a', fontSize: 11,
              fontFamily: 'var(--ct-mono, var(--font-space-mono), monospace)', letterSpacing: '0.1em',
            }}>
              <div style={{ flex: 1, height: 1, background: '#1f1f30' }} />
              OU
              <div style={{ flex: 1, height: 1, background: '#1f1f30' }} />
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
                background: '#0a0a14', border: `1px solid ${error ? '#ff3b2f' : '#2a2a3e'}`,
                color: '#f0f0f5', fontSize: 14,
                outline: 'none', boxSizing: 'border-box',
                marginBottom: 8,
              }}
            />

            {error && (
              <div style={{ color: '#ff3b2f', fontSize: 12, marginBottom: 8 }}>{error}</div>
            )}

            <button
              onClick={handleMagicLink}
              disabled={loading || !email}
              style={{
                width: '100%', padding: '11px', borderRadius: 10, cursor: 'pointer',
                background: email ? '#ff3b2f' : '#1e1e2e',
                border: 'none', color: email ? '#fff' : '#3f3f5a',
                fontFamily: 'var(--ct-mono, var(--font-space-mono), monospace)',
                fontSize: '0.72rem', letterSpacing: '0.12em', fontWeight: 700,
                transition: 'all 0.2s',
                boxShadow: email ? '0 4px 16px rgba(255,59,47,0.3)' : 'none',
              }}
            >
              {loading ? '⏳ ENVOI...' : '✉ ENVOYER LE LIEN MAGIQUE →'}
            </button>
          </>
        )}

        <p style={{ marginTop: 16, fontSize: 11, color: '#3f3f5a', textAlign: 'center', lineHeight: 1.5 }}>
          En vous connectant, vous acceptez les CGU de Crisis Travel.
          Aucun mot de passe requis.
        </p>
      </div>
    </div>
  );
}
