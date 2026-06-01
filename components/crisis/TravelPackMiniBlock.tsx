'use client';
import { useState } from 'react';

// Bloc compact « Préparer ce voyage » affiché sur /results (parcours principal).
// Ne contient AUCUNE logique d'affiliation : les 3 CTA pointent simplement vers
// la route serveur /api/affiliate/click, qui trace le clic puis redirige (302)
// vers le partenaire. Aucun lien partenaire direct ici, aucun affiliate_id.

type TravelType = 'solo' | 'couple' | 'family' | 'nomad';
type Category = 'flight' | 'hotel' | 'insurance';

interface TravelPackMiniBlockProps {
  countryCode?: string;
  countryName?: string;
  // Optional context from /results search params — enriches Booking URL when present.
  travelType?: TravelType;
  checkin?: string;   // YYYY-MM-DD
  checkout?: string;  // YYYY-MM-DD
}

// Adults count per travel type — family defaults to 2 adults (minimum).
const ADULTS_BY_TYPE: Record<TravelType, number> = {
  solo: 1,
  couple: 2,
  family: 2,
  nomad: 1,
};

/**
 * Builds an enriched Booking search URL.
 * Injects checkin/checkout/group_adults/no_rooms when available.
 * Falls back to bare destination search when dates are absent.
 */
function buildBookingUrl(countryName: string, opts?: {
  checkin?: string;
  checkout?: string;
  travelType?: TravelType;
}): string {
  const base = `https://www.booking.com/searchresults.fr.html`;
  const params = new URLSearchParams({
    ss: countryName,
    lang: 'fr',
    currency: 'EUR',
  });

  const adults = ADULTS_BY_TYPE[opts?.travelType ?? 'solo'];
  params.set('group_adults', String(adults));
  params.set('no_rooms', '1');

  // Only inject dates when both checkin and checkout are valid YYYY-MM-DD strings.
  if (opts?.checkin && opts?.checkout && opts.checkin < opts.checkout) {
    params.set('checkin', opts.checkin);
    params.set('checkout', opts.checkout);
  }

  return `${base}?${params.toString()}`;
}

function targetUrl(category: Category, countryName?: string, opts?: {
  checkin?: string;
  checkout?: string;
  travelType?: TravelType;
}): string | undefined {
  if (!countryName) return undefined;
  if (category === 'flight')    return 'https://www.skyscanner.fr/';
  if (category === 'hotel')     return buildBookingUrl(countryName, opts);
  if (category === 'insurance') return 'https://www.chapkadirect.fr/';
  return undefined;
}

function buildClickUrl(
  category: Category,
  countryCode?: string,
  countryName?: string,
  opts?: { checkin?: string; checkout?: string; travelType?: TravelType },
): string {
  const params = new URLSearchParams({ category });
  if (countryCode) params.set('country', countryCode);
  if (countryName) params.set('countryName', countryName);
  const dest = targetUrl(category, countryName, opts);
  if (dest) params.set('url', dest);
  return `/api/affiliate/click?${params.toString()}`;
}

const CTAS: { category: Category; icon: string; generic: string; prefix: string; bg: string; hover: string }[] = [
  { category: 'flight',    icon: '✈',  generic: 'Trouver un vol',    prefix: 'Vol',       bg: '#dc2626', hover: '#ef4444' },
  { category: 'hotel',     icon: '🏨', generic: 'Réserver un hôtel', prefix: 'Hôtel',     bg: '#1d4ed8', hover: '#2563eb' },
  { category: 'insurance', icon: '🛡', generic: 'Assurance voyage',  prefix: 'Assurance', bg: '#065f46', hover: '#047857' },
];

export function TravelPackMiniBlock({ countryCode, countryName, travelType, checkin, checkout }: TravelPackMiniBlockProps) {
  const title = countryName ? `Préparer votre voyage : ${countryName}` : 'Préparer ce voyage';
  const ctaLabel = (c: (typeof CTAS)[number]) => (countryName ? `${c.prefix} ${countryName}` : c.generic);
  const bookingOpts = { checkin, checkout, travelType };

  return (
    <div style={{
      background: 'linear-gradient(135deg, #13131a 0%, #0f0f1a 100%)',
      border: '1px solid rgba(255,77,46,0.25)',
      borderRadius: 14, padding: '18px 18px 16px', marginTop: 24,
      boxShadow: '0 0 40px rgba(255,77,46,0.05) inset',
    }}>
      {/* Titre + sous-texte */}
      <div style={{ marginBottom: 14 }}>
        <h2 style={{
          fontFamily: 'var(--ct-mono, var(--font-space-mono), monospace)',
          fontSize: '0.85rem', color: '#ff4d2e', letterSpacing: '0.1em',
          margin: 0, textTransform: 'uppercase', fontWeight: 700,
        }}>
          ✈️ {title}
        </h2>
        <p style={{
          fontSize: '0.72rem', color: '#9898b0', margin: '4px 0 0',
          lineHeight: 1.4,
        }}>
          Comparez vols, hôtels et assurance avant de réserver.
        </p>
      </div>

      {/* 3 CTA → /api/affiliate/click */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8 }}>
        {CTAS.map((c) => (
          <a
            key={c.category}
            href={buildClickUrl(c.category, countryCode, countryName, bookingOpts)}
            target="_blank"
            rel="noopener noreferrer"
            style={{ textDecoration: 'none' }}
          >
            <MiniCta icon={c.icon} label={ctaLabel(c)} bgColor={c.bg} hoverColor={c.hover} />
          </a>
        ))}
      </div>

      {/* Disclaimer */}
      <p style={{ fontSize: '0.58rem', color: '#3f3f5a', marginTop: 12, textAlign: 'center', lineHeight: 1.5 }}>
        Crisis Travel peut percevoir une commission si vous réservez via ces liens.
      </p>
    </div>
  );
}

function MiniCta({ icon, label, bgColor, hoverColor }: {
  icon: string; label: string; bgColor: string; hoverColor: string;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        background: hovered ? hoverColor : bgColor,
        borderRadius: 9, padding: '11px 12px',
        transition: 'background 0.15s, transform 0.15s',
        transform: hovered ? 'translateY(-1px)' : 'none',
        boxShadow: hovered ? `0 4px 16px ${bgColor}60` : 'none',
        cursor: 'pointer',
      }}
    >
      <span style={{ fontSize: '1rem' }}>{icon}</span>
      <span style={{
        fontFamily: 'var(--ct-mono, var(--font-space-mono), monospace)',
        fontSize: '0.68rem', color: '#fff', letterSpacing: '0.06em', fontWeight: 700,
      }}>
        {label} →
      </span>
    </div>
  );
}

// Exported for unit testing.
export { buildBookingUrl, ADULTS_BY_TYPE };
