'use client';
import Link from 'next/link';
import { UserMenu } from '@/components/auth/UserMenu';

export function Header() {
  return (
    <header style={{
      position: 'sticky', top: 0, zIndex: 50,
      backdropFilter: 'blur(24px) saturate(1.5)',
      WebkitBackdropFilter: 'blur(24px) saturate(1.5)',
      background: 'rgba(7,7,12,0.80)',
      borderBottom: '1px solid #1f1f30',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px 10px' }}>
        {/* Logo */}
        <Link href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            width: 22, height: 22,
            background: '#ff3b2f',
            borderRadius: 5,
            display: 'grid', placeItems: 'center',
            boxShadow: '0 0 12px rgba(255,59,47,0.4)',
            flexShrink: 0,
          }}>
            <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: 12, height: 12, color: '#fff' }}>
              <path d="M13 2 3 14h7l-1 8 10-12h-7l1-8z"/>
            </svg>
          </span>
          <span style={{
            fontFamily: 'var(--ct-mono, var(--font-space-mono), monospace)',
            fontWeight: 700, fontSize: 11,
            letterSpacing: '0.18em',
            color: '#f0f0f5',
            textTransform: 'uppercase',
          }}>
            CRISIS TRAVEL
          </span>
        </Link>

        {/* Right side: status + auth */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            fontFamily: 'var(--ct-mono, var(--font-space-mono), monospace)',
            fontSize: 9.5, letterSpacing: '0.15em',
            color: '#9898b0', textTransform: 'uppercase',
            padding: '5px 9px',
            border: '1px solid #1f1f30',
            borderRadius: 999,
            background: 'rgba(17,17,28,0.5)',
          }}>
            <span className="ct-pulse-dot" />
            LIVE · 4/4 APIS
          </div>
          <UserMenu />
        </div>
      </div>

      {/* Sub-nav */}
      <div className="ct-subnav" style={{
        display: 'flex', gap: 0,
        borderTop: '1px solid #1f1f30',
        padding: '0 20px',
        overflowX: 'auto',
        scrollbarWidth: 'none',
      }}>
        {[
          { href: '/', label: 'ACCUEIL' },
          { href: '/results?mode=standard&budget=1500&duration=7&travelType=solo', label: 'ANALYSER' },
          { href: '/pricing', label: 'TARIFS' },
          { href: '/api/health', label: 'STATUT' },
        ].map((item) => (
          <Link
            key={item.href}
            href={item.href}
            style={{
              fontFamily: 'var(--ct-mono, var(--font-space-mono), monospace)',
              fontSize: 9, letterSpacing: '0.14em',
              color: '#6b6b85', textDecoration: 'none',
              padding: '8px 10px',
              display: 'inline-block',
              transition: 'color 0.2s',
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#f0f0f5')}
            onMouseLeave={(e) => (e.currentTarget.style.color = '#6b6b85')}
          >
            {item.label}
          </Link>
        ))}
      </div>
    </header>
  );
}
