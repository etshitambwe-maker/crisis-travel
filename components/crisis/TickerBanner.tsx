'use client';

type TickerItem = { flag: string; code: string; msg: string; lvl: 'safe' | 'warn' | 'danger' };

const DEFAULT_ITEMS: TickerItem[] = [
  { flag: '🇫🇷', code: 'FRA', msg: 'MEAE — Vigilance anti-terroriste maintenue', lvl: 'safe' },
  { flag: '🇪🇬', code: 'EGY', msg: 'Sinaï Nord — Formellement déconseillé', lvl: 'danger' },
  { flag: '🇯🇵', code: 'JPN', msg: 'Typhon saison — côte pacifique surveillée', lvl: 'warn' },
  { flag: '🇹🇷', code: 'TUR', msg: 'Frontière syrienne 10km — Déconseillé', lvl: 'danger' },
  { flag: '🇲🇦', code: 'MAR', msg: 'Vigilance zones frontalières sud', lvl: 'warn' },
  { flag: '🇵🇹', code: 'PRT', msg: 'Surveillance normale — conditions favorables', lvl: 'safe' },
  { flag: '🇬🇷', code: 'GRC', msg: 'Surveillance normale — conditions favorables', lvl: 'safe' },
  { flag: '🇲🇽', code: 'MEX', msg: 'Guerrero / Sinaloa — Formellement déconseillé', lvl: 'danger' },
  { flag: '🇮🇸', code: 'ISL', msg: 'Reykjanes — activité volcanique confirmée', lvl: 'warn' },
  { flag: '🇻🇳', code: 'VNM', msg: 'Mousson Nord en cours — centre dégagé', lvl: 'safe' },
];

const LEVEL_COLOR: Record<string, string> = {
  safe: '#3ddc97',
  warn: '#ffb224',
  danger: '#ff3b2f',
};

interface Props {
  items?: TickerItem[];
}

export function TickerBanner({ items = DEFAULT_ITEMS }: Props) {
  const doubled = [...items, ...items];

  return (
    <div style={{
      borderBottom: '1px solid #1f1f30',
      background: 'linear-gradient(90deg, rgba(255,59,47,0.06), transparent 40%)',
      display: 'flex', alignItems: 'stretch', height: 30, overflow: 'hidden',
    }}>
      {/* Tag */}
      <span style={{
        flexShrink: 0,
        background: '#ff3b2f', color: '#fff',
        fontFamily: 'var(--ct-mono, var(--font-space-mono), monospace)',
        fontSize: 9, letterSpacing: '0.18em',
        padding: '0 10px', fontWeight: 700,
        display: 'inline-flex', alignItems: 'center', gap: 5,
      }}>
        <span className="ct-pulse-dot ct-pulse-dot-danger" style={{ width: 5, height: 5 }} />
        ALERTES
      </span>

      {/* Scrolling track */}
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative', display: 'flex', alignItems: 'center' }}>
        <div style={{
          display: 'flex', gap: 32, whiteSpace: 'nowrap',
          animation: 'tscroll 60s linear infinite', paddingLeft: 20,
          fontFamily: 'var(--ct-mono, var(--font-space-mono), monospace)',
          fontSize: 10, letterSpacing: '0.04em', color: '#9898b0',
        }}>
          {doubled.map((t, i) => (
            <span key={i} style={{ display: 'inline-flex', gap: 7, alignItems: 'center' }}>
              <span style={{ fontSize: 12 }}>{t.flag}</span>
              <span style={{ color: '#f0f0f5', fontWeight: 700 }}>{t.code}</span>
              <span style={{
                width: 5, height: 5, borderRadius: '50%',
                background: LEVEL_COLOR[t.lvl],
                boxShadow: t.lvl === 'danger' ? `0 0 6px ${LEVEL_COLOR[t.lvl]}` : 'none',
                display: 'inline-block', flexShrink: 0,
              }} />
              <span>{t.msg}</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
