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

type FinancialItem = {
  flag: string;
  country: string;
  type: 'flight' | 'hotel' | 'fx' | 'cost';
  label: string;
  delta: number;
};

const FINANCIAL_ITEMS: FinancialItem[] = [
  { flag: '🇯🇵', country: 'Japon',       type: 'flight', label: 'Vols',       delta: -12 },
  { flag: '🇹🇭', country: 'Thaïlande',   type: 'hotel',  label: 'Hôtels',     delta: +8  },
  { flag: '🇦🇷', country: 'Argentine',   type: 'fx',     label: 'Pouvoir d\'achat', delta: +15 },
  { flag: '🇹🇷', country: 'Turquie',     type: 'cost',   label: 'Vie locale',  delta: +6  },
  { flag: '🇮🇩', country: 'Indonésie',   type: 'hotel',  label: 'Hébergement', delta: -9  },
  { flag: '🇲🇦', country: 'Maroc',       type: 'flight', label: 'Vols',       delta: -18 },
  { flag: '🇻🇳', country: 'Vietnam',     type: 'cost',   label: 'Restauration', delta: -14 },
  { flag: '🇬🇷', country: 'Grèce',       type: 'hotel',  label: 'Hôtels',     delta: -7  },
  { flag: '🇲🇽', country: 'Mexique',     type: 'fx',     label: 'Taux de change', delta: +11 },
  { flag: '🇮🇸', country: 'Islande',     type: 'flight', label: 'Vols',       delta: +22 },
  { flag: '🇵🇹', country: 'Portugal',    type: 'hotel',  label: 'Hébergement', delta: +5  },
  { flag: '🇰🇷', country: 'Corée du Sud', type: 'fx',   label: 'Won / EUR',   delta: -8  },
  { flag: '🇧🇷', country: 'Brésil',      type: 'cost',   label: 'Budget global', delta: -16 },
  { flag: '🇦🇺', country: 'Australie',   type: 'flight', label: 'Vols',       delta: +4  },
  { flag: '🇿🇦', country: 'Afrique du Sud', type: 'fx', label: 'Pouvoir d\'achat', delta: +19 },
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
  const financialDoubled = [...FINANCIAL_ITEMS, ...FINANCIAL_ITEMS];

  return (
    <div>
      {/* ── Bandeau 1 : alertes géopolitiques (gauche → droite) ── */}
      <div style={{
        borderBottom: '1px solid #1f1f30',
        background: 'linear-gradient(90deg, rgba(255,59,47,0.06), transparent 40%)',
        display: 'flex', alignItems: 'stretch', height: 30, overflow: 'hidden',
      }}>
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

      {/* ── Bandeau 2 : tendances voyage & prix (droite → gauche) ── */}
      <div style={{
        borderBottom: '1px solid #1f1f30',
        background: 'linear-gradient(90deg, transparent 60%, rgba(74,158,255,0.04))',
        display: 'flex', alignItems: 'stretch', height: 28, overflow: 'hidden',
      }}>
        <span style={{
          flexShrink: 0,
          background: '#13131f', color: '#4a9eff',
          fontFamily: 'var(--ct-mono, var(--font-space-mono), monospace)',
          fontSize: 9, letterSpacing: '0.18em',
          padding: '0 10px', fontWeight: 700,
          display: 'inline-flex', alignItems: 'center', gap: 5,
          borderRight: '1px solid #1f1f30',
        }}>
          MARCHÉS
        </span>

        <div style={{ flex: 1, overflow: 'hidden', position: 'relative', display: 'flex', alignItems: 'center' }}>
          <div style={{
            display: 'flex', gap: 28, whiteSpace: 'nowrap',
            animation: 'tscroll-reverse 80s linear infinite', paddingRight: 20,
            fontFamily: 'var(--ct-mono, var(--font-space-mono), monospace)',
            fontSize: 9.5, letterSpacing: '0.04em', color: '#9898b0',
          }}>
            {financialDoubled.map((item, i) => {
              const isUp = item.delta > 0;
              const color = isUp ? '#ff8c42' : '#3ddc97';
              const arrow = isUp ? '▲' : '▼';
              const absVal = Math.abs(item.delta);
              return (
                <span key={i} style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                  <span style={{ fontSize: 11 }}>{item.flag}</span>
                  <span style={{ color: '#f0f0f5', fontWeight: 600 }}>{item.country}</span>
                  <span style={{ color: '#6b6b85' }}>·</span>
                  <span style={{ color: '#9898b0' }}>{item.label}</span>
                  <span style={{ color, fontWeight: 700 }}>
                    {arrow} {absVal}%
                  </span>
                </span>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
