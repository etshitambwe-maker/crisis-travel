'use client';
import { useState, useEffect } from 'react';
import { createSupabaseBrowserClient } from '@/lib/auth/supabase-client';
import { AuthModal } from './AuthModal';
import type { User } from '@supabase/supabase-js';

export function UserMenu() {
  const [user, setUser] = useState<User | null>(null);
  const [showAuth, setShowAuth] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  const supabase = createSupabaseBrowserClient();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }: { data: { user: User | null } }) => setUser(data.user));
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event: string, session: { user?: User } | null) => {
        setUser(session?.user ?? null);
      }
    );
    return () => subscription.unsubscribe();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSignOut() {
    await supabase.auth.signOut();
    setShowMenu(false);
    setUser(null);
  }

  async function handleManageSubscription() {
    setPortalLoading(true);
    try {
      const res = await fetch('/api/stripe/portal', { method: 'POST' });
      const data = await res.json();
      if (res.status === 404) {
        // Aucun abonnement actif → diriger vers les tarifs
        window.location.href = '/pricing';
        return;
      }
      if (data.url) {
        window.location.href = data.url;
      }
    } catch {
      window.location.href = '/pricing';
    } finally {
      setPortalLoading(false);
    }
  }

  if (!user) {
    return (
      <>
        <button
          onClick={() => setShowAuth(true)}
          style={{
            padding: '6px 14px', borderRadius: 7, cursor: 'pointer',
            background: 'var(--ctv3-red-soft)', border: '1px solid rgba(228,51,43,0.3)',
            color: 'var(--ctv3-red)',
            fontFamily: 'var(--ctv3-mono)',
            fontSize: '0.58rem', letterSpacing: '0.1em', fontWeight: 700,
            transition: 'all 0.15s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(228,51,43,0.2)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--ctv3-red-soft)'; }}
        >
          CONNEXION
        </button>
        <AuthModal isOpen={showAuth} onClose={() => setShowAuth(false)} />
      </>
    );
  }

  const avatarLetter = user.email?.[0]?.toUpperCase() ?? '?';

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setShowMenu((v) => !v)}
        style={{
          width: 30, height: 30, borderRadius: '50%', cursor: 'pointer',
          background: 'var(--ctv3-red)', border: '2px solid rgba(228,51,43,0.4)',
          color: '#fff', fontSize: 12, fontWeight: 700,
          fontFamily: 'var(--ctv3-mono)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        {avatarLetter}
      </button>

      {showMenu && (
        <div style={{
          position: 'absolute', top: '100%', right: 0, marginTop: 6, zIndex: 300,
          background: 'var(--ctv3-ink-870)', border: '1px solid var(--ctv3-line-bright)', borderRadius: 10,
          padding: 8, minWidth: 200,
          boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
        }}>
          <div style={{
            padding: '8px 10px 10px', borderBottom: '1px solid var(--ctv3-line-soft)', marginBottom: 4,
          }}>
            <div style={{
              fontFamily: 'var(--ctv3-mono)',
              fontSize: '0.55rem', color: 'var(--ctv3-dim)', letterSpacing: '0.1em', marginBottom: 2,
            }}>
              CONNECTÉ EN TANT QUE
            </div>
            <div style={{ color: 'var(--ctv3-paper)', fontSize: 12, wordBreak: 'break-all' }}>
              {user.email}
            </div>
          </div>

          <button
            onClick={handleManageSubscription}
            disabled={portalLoading}
            style={{
              width: '100%', padding: '7px 10px', borderRadius: 6, cursor: portalLoading ? 'default' : 'pointer',
              background: 'transparent', border: 'none', textAlign: 'left',
              color: 'var(--ctv3-muted)', fontSize: 13,
              display: 'flex', alignItems: 'center', gap: 8,
              transition: 'background 0.1s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--ctv3-ink-800)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
          >
            <span style={{ fontSize: 11 }}>⚙</span>
            {portalLoading ? 'Redirection…' : 'Gérer l\'abonnement'}
          </button>

          <button
            onClick={handleSignOut}
            style={{
              width: '100%', padding: '7px 10px', borderRadius: 6, cursor: 'pointer',
              background: 'transparent', border: 'none', textAlign: 'left',
              color: 'var(--ctv3-muted)', fontSize: 13,
              display: 'flex', alignItems: 'center', gap: 8,
              transition: 'background 0.1s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--ctv3-ink-800)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
          >
            <span style={{ fontSize: 11 }}>↩</span>
            Se déconnecter
          </button>
        </div>
      )}
    </div>
  );
}
