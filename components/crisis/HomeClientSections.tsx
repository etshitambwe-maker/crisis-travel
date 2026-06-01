'use client';
import { useRouter } from 'next/navigation';

// Budget and duration extracted from the meta strings so clicking navigates to /results
// with pre-filled parameters matching the opportunity window.
const OPPORTUNITIES = [
  {
    dates: '28 AVR → 12 MAI',
    title: 'Shoulder season Méditerranée',
    desc: 'Portugal + Grèce : −18% hébergement, météo optimale, affluence faible.',
    tag: 'OPTIMAL', meta: ['DURÉE 15J', 'BUDGET 1800€', 'SÉCURITÉ 92'],
    href: '/results?mode=standard&budget=1800&duration=15&travelType=solo&continent=Europe',
  },
  {
    dates: '05 MAI → 19 MAI',
    title: 'Yen historiquement bas — Japon',
    desc: 'JPY à −22% vs EUR, vols LCC en promo, hanami tardif Hokkaidō.',
    tag: 'FX PLAY', meta: ['DURÉE 14J', 'BUDGET 2400€', 'FX −22%'],
    href: '/results?mode=standard&budget=2400&duration=14&travelType=solo&continent=Asia',
  },
  {
    dates: '19 MAI → 02 JUN',
    title: 'Maroc pré-été Atlantique',
    desc: '22°C côte, MAD favorable, Paris-Marrakech 119€ A/R.',
    tag: 'BUDGET', meta: ['DURÉE 14J', 'BUDGET 1200€', 'FX +12%'],
    href: '/results?mode=budget_crisis&budget=1200&duration=14&travelType=solo&continent=Africa',
  },
];

export function OpportunityCards() {
  const router = useRouter();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {OPPORTUNITIES.map((o, i) => (
        <div key={i}
          role="button"
          tabIndex={0}
          onClick={() => router.push(o.href)}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') router.push(o.href); }}
          style={{
            position: 'relative',
            background: 'linear-gradient(135deg, rgba(61,220,151,0.06), rgba(61,220,151,0.02))',
            border: '1px solid rgba(61,220,151,0.2)',
            borderRadius: 12, padding: '14px 16px',
            display: 'flex', flexDirection: 'column', gap: 8,
            cursor: 'pointer', transition: 'all 0.2s ease',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(61,220,151,0.4)';
            (e.currentTarget as HTMLDivElement).style.transform = 'translateX(2px)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(61,220,151,0.2)';
            (e.currentTarget as HTMLDivElement).style.transform = 'translateX(0)';
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
            <div style={{
              fontFamily: 'var(--ct-mono, var(--font-space-mono), monospace)',
              fontSize: 10.5, fontWeight: 700, letterSpacing: '0.1em', color: '#3ddc97', textTransform: 'uppercase',
            }}>
              {o.dates}
            </div>
            <span style={{
              fontFamily: 'var(--ct-mono, var(--font-space-mono), monospace)',
              fontSize: 8.5, letterSpacing: '0.15em', color: '#3ddc97',
              padding: '3px 7px', border: '1px solid rgba(61,220,151,0.35)', borderRadius: 3,
              textTransform: 'uppercase', fontWeight: 700, background: 'rgba(61,220,151,0.08)',
            }}>
              {o.tag}
            </span>
          </div>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#f0f0f5', letterSpacing: '-0.01em' }}>{o.title}</div>
          <div style={{ color: '#9898b0', fontSize: 12.5, lineHeight: 1.45 }}>{o.desc}</div>
          <div style={{
            fontFamily: 'var(--ct-mono, var(--font-space-mono), monospace)',
            fontSize: 9.5, color: '#6b6b85', letterSpacing: '0.1em', textTransform: 'uppercase',
            paddingTop: 8, borderTop: '1px dashed rgba(61,220,151,0.2)',
            display: 'flex', gap: 10,
          }}>
            {o.meta.map((m, j) => (
              <span key={j}>{j > 0 ? '· ' : ''}{m}</span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
