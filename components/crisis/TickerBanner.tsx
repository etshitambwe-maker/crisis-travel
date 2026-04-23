'use client';

const DEFAULT_ITEMS = [
  '🌍 Crisis Travel analyse 25 pays en temps réel',
  '🔒 Sources officielles : MEAE France, State Dept US, FCDO UK',
  '📊 Données mises à jour toutes les 30 minutes',
  '💶 Détection automatique des opportunités de change',
  '🤖 Analyse narrative propulsée par Claude AI',
];

interface Props {
  items?: string[];
}

export function TickerBanner({ items = DEFAULT_ITEMS }: Props) {
  const all = [...items, ...items];
  return (
    <div style={{ background: '#0d0d14', borderBottom: '1px solid #1e1e2e', overflow: 'hidden', padding: '7px 0' }}>
      <div className="animate-ticker" style={{ display: 'flex', whiteSpace: 'nowrap' }}>
        {all.map((item, i) => (
          <span key={i} style={{ fontFamily: 'var(--font-space-mono)', fontSize: '0.72rem', color: '#6b7280', margin: '0 40px' }}>
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}
