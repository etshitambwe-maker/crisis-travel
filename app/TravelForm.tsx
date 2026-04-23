'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

const TRAVEL_TYPES = [
  { value: 'solo', label: 'Solo' },
  { value: 'couple', label: 'Couple' },
  { value: 'family', label: 'Famille' },
  { value: 'nomad', label: 'Nomad digital' },
];

const MODES = [
  { value: 'standard', label: 'Standard' },
  { value: 'bunker', label: '🛡️ Bunker' },
  { value: 'budget_crisis', label: '💸 Budget serré' },
];

export function TravelForm() {
  const router = useRouter();
  const [budget, setBudget] = useState(1500);
  const [duration, setDuration] = useState(7);
  const [travelType, setTravelType] = useState('solo');
  const [mode, setMode] = useState('standard');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const params = new URLSearchParams({ budget: String(budget), duration: String(duration), travelType, mode });
    router.push(`/results?${params.toString()}`);
  }

  const inputStyle = {
    background: '#0a0a0f', border: '1px solid #1e1e2e', borderRadius: 8,
    color: '#e8e8e8', padding: '8px 12px', fontSize: '0.9rem', width: '100%',
    fontFamily: 'var(--font-dm-sans)',
  };

  const labelStyle = { display: 'block', fontSize: '0.75rem', color: '#6b7280', marginBottom: 6, letterSpacing: '0.06em' };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Budget */}
      <div>
        <label style={labelStyle}>BUDGET TOTAL</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <input
            type="range" min={300} max={8000} step={100} value={budget}
            onChange={(e) => setBudget(Number(e.target.value))}
            style={{ flex: 1, accentColor: '#ff4d2e' }}
          />
          <span style={{ fontFamily: 'var(--font-space-mono)', color: '#ff4d2e', fontSize: '1rem', minWidth: 70 }}>
            {budget.toLocaleString('fr-FR')}€
          </span>
        </div>
      </div>

      {/* Durée */}
      <div>
        <label style={labelStyle}>DURÉE DU VOYAGE</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <input
            type="range" min={3} max={60} step={1} value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
            style={{ flex: 1, accentColor: '#ff4d2e' }}
          />
          <span style={{ fontFamily: 'var(--font-space-mono)', color: '#ff4d2e', fontSize: '1rem', minWidth: 70 }}>
            {duration} jours
          </span>
        </div>
      </div>

      {/* Profil voyageur */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <label style={labelStyle}>PROFIL VOYAGEUR</label>
          <select value={travelType} onChange={(e) => setTravelType(e.target.value)} style={inputStyle}>
            {TRAVEL_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div>
          <label style={labelStyle}>MODE DE RECHERCHE</label>
          <select value={mode} onChange={(e) => setMode(e.target.value)} style={inputStyle}>
            {MODES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
        </div>
      </div>

      <button
        type="submit" disabled={loading}
        style={{
          background: loading ? '#3f3f5a' : '#ff4d2e', color: '#fff', border: 'none',
          borderRadius: 8, padding: '12px', fontSize: '0.95rem', fontWeight: 700,
          cursor: loading ? 'not-allowed' : 'pointer', letterSpacing: '0.08em',
          fontFamily: 'var(--font-space-mono)', transition: 'background 0.2s',
        }}
      >
        {loading ? 'ANALYSE EN COURS...' : '⚡ LANCER L\'ANALYSE'}
      </button>
    </form>
  );
}
