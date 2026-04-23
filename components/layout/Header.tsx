'use client';
import Link from 'next/link';

export function Header() {
  return (
    <header style={{
      background: '#0a0a0f', borderBottom: '1px solid #1e1e2e',
      padding: '12px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    }}>
      <Link href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ color: '#ff4d2e', fontSize: '1.4rem', fontWeight: 700, letterSpacing: '0.15em', fontFamily: 'var(--font-space-mono)' }}>
          ⚡ CRISIS TRAVEL
        </span>
      </Link>
      <nav style={{ display: 'flex', gap: 24 }}>
        <Link href="/results" style={{ color: '#6b7280', fontSize: '0.85rem', textDecoration: 'none', transition: 'color 0.2s' }}
          onMouseEnter={(e) => (e.currentTarget.style.color = '#e8e8e8')}
          onMouseLeave={(e) => (e.currentTarget.style.color = '#6b7280')}
        >
          Analyser
        </Link>
        <Link href="/api/health" style={{ color: '#6b7280', fontSize: '0.85rem', textDecoration: 'none' }}
          onMouseEnter={(e) => (e.currentTarget.style.color = '#e8e8e8')}
          onMouseLeave={(e) => (e.currentTarget.style.color = '#6b7280')}
        >
          Statut APIs
        </Link>
      </nav>
    </header>
  );
}
