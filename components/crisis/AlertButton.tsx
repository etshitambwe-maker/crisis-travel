'use client';
import { useState } from 'react';

interface Props {
  countryCode: string;
  countryName: string;
  isLoggedIn: boolean;
}

export function AlertButton({ countryCode, countryName, isLoggedIn }: Props) {
  const [state, setState] = useState<'idle' | 'loading' | 'active' | 'error'>('idle');
  const [message, setMessage] = useState('');

  async function handleToggle() {
    if (!isLoggedIn) {
      // Déclencher l'ouverture de l'AuthModal via un événement custom
      window.dispatchEvent(new CustomEvent('ct:open-auth'));
      return;
    }

    if (state === 'active') {
      // Désactiver l'alerte
      setState('loading');
      try {
        const res = await fetch(`/api/alerts?countryCode=${countryCode}`, { method: 'DELETE' });
        if (res.ok) {
          setState('idle');
          setMessage('Alerte supprimée');
          setTimeout(() => setMessage(''), 2000);
        } else {
          setState('active');
          setMessage('Erreur lors de la suppression');
        }
      } catch {
        setState('active');
      }
      return;
    }

    setState('loading');
    try {
      const res = await fetch('/api/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          countryCode,
          thresholdScore: 60,
          alertTypes: ['security_improved', 'cheap_flights', 'currency'],
        }),
      });

      if (res.ok || res.status === 201) {
        setState('active');
        setMessage(`Alerte créée pour ${countryName}`);
        setTimeout(() => setMessage(''), 3000);
      } else if (res.status === 429) {
        setState('idle');
        setMessage('Limite de 10 alertes atteinte');
        setTimeout(() => setMessage(''), 3000);
      } else if (res.status === 401) {
        setState('idle');
        window.dispatchEvent(new CustomEvent('ct:open-auth'));
      } else {
        setState('error');
        setTimeout(() => setState('idle'), 2000);
      }
    } catch {
      setState('error');
      setTimeout(() => setState('idle'), 2000);
    }
  }

  const isOn = state === 'active';
  const isLoading = state === 'loading';

  return (
    <div>
      <button
        onClick={handleToggle}
        disabled={isLoading}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          padding: '9px 16px', borderRadius: 8, cursor: isLoading ? 'wait' : 'pointer',
          background: isOn
            ? 'rgba(61,220,151,0.12)'
            : 'rgba(255,178,36,0.1)',
          border: isOn
            ? '1px solid rgba(61,220,151,0.35)'
            : '1px solid rgba(255,178,36,0.3)',
          color: isOn ? '#3ddc97' : '#ffb224',
          fontFamily: 'var(--ct-mono, var(--font-space-mono), monospace)',
          fontSize: '0.6rem', letterSpacing: '0.12em', fontWeight: 700,
          transition: 'all 0.2s',
        }}
        onMouseEnter={(e) => {
          if (!isLoading) e.currentTarget.style.opacity = '0.8';
        }}
        onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
      >
        {/* Indicateur */}
        <span style={{
          width: 6, height: 6, borderRadius: '50%',
          background: isOn ? '#3ddc97' : '#ffb224',
          boxShadow: isOn ? '0 0 6px #3ddc97' : 'none',
          animation: isOn ? 'ct-pulse 2s ease-in-out infinite' : 'none',
          display: 'inline-block', flexShrink: 0,
        }} />
        {isLoading ? 'TRAITEMENT...' : isOn ? 'ALERTE ACTIVE' : '+ CRÉER UNE ALERTE'}
      </button>

      {message && (
        <div style={{
          marginTop: 6, fontSize: 11,
          color: state === 'error' ? '#ff3b2f' : '#3ddc97',
          fontFamily: 'var(--ct-mono, var(--font-space-mono), monospace)',
          letterSpacing: '0.06em',
        }}>
          {message}
        </div>
      )}

      {!isLoggedIn && (
        <div style={{
          marginTop: 4, fontSize: 10, color: '#6b6b85',
          fontFamily: 'var(--ct-mono, var(--font-space-mono), monospace)',
          letterSpacing: '0.04em',
        }}>
          Connexion requise pour créer une alerte
        </div>
      )}
    </div>
  );
}
