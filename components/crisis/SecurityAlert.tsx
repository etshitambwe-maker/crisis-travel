interface Props {
  level: number;
  country: string;
}

const LEVELS: Record<number, { color: string; bg: string; border: string; label: string; icon: string }> = {
  1: { color: '#00e5a0', bg: 'rgba(0,229,160,0.08)', border: 'rgba(0,229,160,0.25)', label: 'Vigilance normale', icon: '✓' },
  2: { color: '#ffd23f', bg: 'rgba(255,210,63,0.08)', border: 'rgba(255,210,63,0.25)', label: 'Vigilance renforcée', icon: '⚠' },
  3: { color: '#ff8c42', bg: 'rgba(255,140,66,0.08)', border: 'rgba(255,140,66,0.25)', label: 'Déconseillé sauf raison impérative', icon: '⚠' },
  4: { color: '#ff4d2e', bg: 'rgba(255,77,46,0.08)', border: 'rgba(255,77,46,0.25)', label: 'Déconseillé formellement', icon: '✕' },
};

export function SecurityAlert({ level, country }: Props) {
  const cfg = LEVELS[level] ?? LEVELS[2];
  return (
    <div style={{
      background: cfg.bg, border: `1px solid ${cfg.border}`, borderRadius: 8,
      padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 8,
      fontSize: '0.82rem', color: cfg.color, marginTop: 8,
    }}>
      <span style={{ fontWeight: 700, fontSize: '1rem' }}>{cfg.icon}</span>
      <span>
        <strong>MEAE Niveau {level}</strong> — {cfg.label} pour {country}
      </span>
    </div>
  );
}
