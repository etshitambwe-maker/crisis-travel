'use client';
import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[App/error]', error);
  }, [error]);

  return (
    <div style={{
      minHeight: '100vh', background: '#07070c',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '20px', textAlign: 'center', gap: 20,
    }}>
      <div style={{
        fontFamily: 'var(--ct-mono, var(--font-space-mono), monospace)',
        fontSize: 48, fontWeight: 700, letterSpacing: '-0.04em',
        color: '#ff3b2f', lineHeight: 1,
      }}>
        ERREUR
      </div>
      <div style={{
        fontFamily: 'var(--ct-mono, var(--font-space-mono), monospace)',
        fontSize: '0.65rem', letterSpacing: '0.18em', color: '#6b6b85',
        textTransform: 'uppercase',
      }}>
        SYSTÈME TEMPORAIREMENT INDISPONIBLE
      </div>
      <p style={{ color: '#9898b0', fontSize: 13, maxWidth: 320, lineHeight: 1.5 }}>
        Une erreur inattendue s&apos;est produite. Les services de données géopolitiques peuvent être temporairement indisponibles.
      </p>
      {error.digest && (
        <div style={{
          fontFamily: 'var(--ct-mono, var(--font-space-mono), monospace)',
          fontSize: '0.5rem', color: '#3f3f5a', letterSpacing: '0.1em',
        }}>
          Référence: {error.digest}
        </div>
      )}
      <button
        onClick={reset}
        style={{
          padding: '10px 20px', borderRadius: 8, cursor: 'pointer',
          background: 'rgba(255,59,47,0.12)', border: '1px solid rgba(255,59,47,0.3)',
          color: '#ff3b2f',
          fontFamily: 'var(--ct-mono, var(--font-space-mono), monospace)',
          fontSize: '0.65rem', letterSpacing: '0.12em', fontWeight: 700,
        }}
      >
        ↺ RÉESSAYER
      </button>
    </div>
  );
}
