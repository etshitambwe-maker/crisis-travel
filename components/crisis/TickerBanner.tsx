'use client';

import type { MeaeTickerItem } from '@/lib/utils/meae-ticker-items';

const LEVEL_COLOR: Record<3 | 4, string> = {
  3: '#ffb224',
  4: '#ff3b2f',
};

interface Props {
  items: MeaeTickerItem[];
  lastUpdated: string;
}

export function TickerBanner({ items, lastUpdated }: Props) {
  if (items.length === 0) return null;

  const doubled = [...items, ...items];
  const formattedDate = new Date(lastUpdated).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  return (
    <div>
      {/* ── Bandeau alertes MEAE niveaux 3/4 — données statiques intégrées ── */}
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
            {doubled.map((item, i) => (
              <a
                key={i}
                href={item.officialUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-flex', gap: 7, alignItems: 'center',
                  color: 'inherit', textDecoration: 'none',
                }}
              >
                <span style={{ color: '#f0f0f5', fontWeight: 700 }}>{item.code}</span>
                <span style={{
                  width: 5, height: 5, borderRadius: '50%',
                  background: LEVEL_COLOR[item.level],
                  boxShadow: `0 0 6px ${LEVEL_COLOR[item.level]}`,
                  display: 'inline-block', flexShrink: 0,
                }} />
                <span>{item.name}</span>
                <span style={{ color: '#6b6b85' }}>—</span>
                <span>{item.label}</span>
              </a>
            ))}
          </div>
        </div>

        <span style={{
          flexShrink: 0,
          color: '#4a4a6a',
          fontFamily: 'var(--ct-mono, var(--font-space-mono), monospace)',
          fontSize: 9, letterSpacing: '0.08em',
          padding: '0 12px',
          display: 'inline-flex', alignItems: 'center',
          borderLeft: '1px solid #1f1f30',
          whiteSpace: 'nowrap',
        }}>
          Données intégrées le {formattedDate} · Source :{' '}
          <a
            href="https://www.diplomatie.gouv.fr/fr/conseils-aux-voyageurs/"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: '#6b6b85', textDecoration: 'underline', marginLeft: 4 }}
          >
            Diplomatie.gouv.fr
          </a>
        </span>
      </div>
    </div>
  );
}
