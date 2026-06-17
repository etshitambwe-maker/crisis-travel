'use client';
import Link from 'next/link';
import { UserMenu } from '@/components/auth/UserMenu';

export function Header() {
  return (
    <header style={{
      position: 'sticky', top: 0, zIndex: 50,
      backdropFilter: 'blur(24px) saturate(1.5)',
      WebkitBackdropFilter: 'blur(24px) saturate(1.5)',
      background: 'rgba(9,9,11,0.80)',
      borderBottom: '1px solid var(--ctv3-line)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px 10px' }}>
        {/* Logo */}
        <Link href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            width: 22, height: 22,
            background: 'var(--ctv3-red)',
            display: 'grid', placeItems: 'center',
            boxShadow: '0 0 12px rgba(228,51,43,0.4)',
            flexShrink: 0,
          }}>
            <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: 12, height: 12, color: '#fff' }}>
              <path d="M13 2 3 14h7l-1 8 10-12h-7l1-8z"/>
            </svg>
          </span>
          <span style={{
            fontFamily: 'var(--ctv3-mono)',
            fontWeight: 700, fontSize: 11,
            letterSpacing: '0.18em',
            color: 'var(--ctv3-paper)',
            textTransform: 'uppercase',
          }}>
            CRISIS TRAVEL
          </span>
        </Link>

        {/* Right side: auth */}
        {/* HONESTY-UI-001: Header must not display hardcoded API health claims.
            Real service health belongs on /status via /api/health. */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <UserMenu />
        </div>
      </div>

      {/* Sub-nav */}
      <div className="ct-subnav" style={{
        display: 'flex', gap: 0,
        borderTop: '1px solid var(--ctv3-line)',
        padding: '0 20px',
        overflowX: 'auto',
        scrollbarWidth: 'none',
      }}>
        {[
          { href: '/', label: 'ACCUEIL' },
          { href: '/#analyse', label: 'ANALYSER' },
          { href: '/pricing', label: 'TARIFS' },
          { href: '/dashboard', label: 'TABLEAU DE BORD' },
          { href: '/status', label: 'STATUT' },
        ].map((item) => (
          <Link
            key={item.href}
            href={item.href}
            style={{
              fontFamily: 'var(--ctv3-mono)',
              fontSize: 9, letterSpacing: '0.14em',
              color: 'var(--ctv3-faint)', textDecoration: 'none',
              padding: '8px 10px',
              display: 'inline-block',
              transition: 'color 0.2s',
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--ctv3-paper)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--ctv3-faint)')}
          >
            {item.label}
          </Link>
        ))}
      </div>
    </header>
  );
}
