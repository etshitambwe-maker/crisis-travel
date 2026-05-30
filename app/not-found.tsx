import Link from 'next/link';
import { Header } from '@/components/layout/Header';

export default function NotFound() {
  return (
    <div style={{ minHeight: '100vh', background: '#07070c' }}>
      <Header />
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        minHeight: '70vh', padding: '20px', textAlign: 'center', gap: 20,
      }}>
        <div style={{
          fontFamily: 'var(--ct-mono, var(--font-space-mono), monospace)',
          fontSize: 72, fontWeight: 700, letterSpacing: '-0.05em',
          color: '#ff3b2f', lineHeight: 1, opacity: 0.8,
        }}>
          404
        </div>
        <div style={{
          fontFamily: 'var(--ct-mono, var(--font-space-mono), monospace)',
          fontSize: '0.72rem', letterSpacing: '0.2em', color: '#6b6b85',
          textTransform: 'uppercase',
        }}>
          DESTINATION NON TROUVÉE
        </div>
        <p style={{ color: '#9898b0', fontSize: 14, maxWidth: 340, lineHeight: 1.5 }}>
          La page que vous cherchez n&apos;existe pas ou a été déplacée.
          Vérifiez le code pays (ex: TH, JP, MA) ou retournez à l&apos;accueil.
        </p>
        <Link
          href="/"
          style={{
            padding: '10px 20px', borderRadius: 8, cursor: 'pointer',
            background: 'rgba(255,59,47,0.12)', border: '1px solid rgba(255,59,47,0.3)',
            color: '#ff3b2f', textDecoration: 'none',
            fontFamily: 'var(--ct-mono, var(--font-space-mono), monospace)',
            fontSize: '0.65rem', letterSpacing: '0.12em', fontWeight: 700,
          }}
        >
          ← RETOUR À L&apos;ACCUEIL
        </Link>
      </div>
    </div>
  );
}
