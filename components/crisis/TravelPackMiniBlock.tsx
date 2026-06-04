'use client';
import { useState } from 'react';

// Bloc compact « Préparer votre voyage » affiché sur /results (parcours principal).
// Ne contient AUCUNE logique d'affiliation : les 3 CTA pointent simplement vers
// la route serveur /api/affiliate/click, qui trace le clic puis redirige (302)
// vers le partenaire. Aucun lien partenaire direct ici, aucun affiliate_id.
//
// FRONT-005 : refonte visuelle uniquement (système ctv3, direction éditoriale
// premium). Le comportement d'affiliation, les paramètres préremplis (Booking),
// et les exports testés (buildBookingUrl / ADULTS_BY_TYPE) sont inchangés.

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

const CTAS: { category: Category; icon: string; generic: string; prefix: string }[] = [
  { category: 'flight',    icon: '✈', generic: 'Trouver un vol',    prefix: 'Vol' },
  { category: 'hotel',     icon: '⌂', generic: 'Réserver un hôtel', prefix: 'Hôtel' },
  { category: 'insurance', icon: '⛨', generic: 'Assurance voyage',  prefix: 'Assurance' },
];

export function TravelPackMiniBlock({ countryCode, countryName, travelType, checkin, checkout }: TravelPackMiniBlockProps) {
  const title = countryName ? `Préparer votre voyage : ${countryName}` : 'Préparer ce voyage';
  const ctaLabel = (c: (typeof CTAS)[number]) => (countryName ? `${c.prefix} · ${countryName}` : c.generic);
  const bookingOpts = { checkin, checkout, travelType };

  return (
    <div style={{
      border: '1px solid var(--ctv3-line)',
      borderTop: '2px solid var(--ctv3-red)',
      background: 'var(--ctv3-ink-850)',
      padding: '20px 20px 18px',
      marginTop: 24,
    }}>
      {/* Eyebrow + titre éditorial */}
      <div style={{ marginBottom: 16 }}>
        <span className="ctv3-mono" style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          fontSize: 10, letterSpacing: '0.22em', textTransform: 'uppercase',
          color: 'var(--ctv3-red)',
        }}>
          <span style={{ width: 14, height: 1, background: 'currentColor', opacity: 0.6 }} />
          Préparer le voyage
        </span>
        <h2 style={{
          fontFamily: 'var(--ctv3-display)', fontWeight: 800, fontSize: 19,
          letterSpacing: '-0.02em', color: 'var(--ctv3-paper)', margin: '8px 0 4px',
        }}>
          {title}
        </h2>
        <p className="ctv3-serif" style={{ fontSize: 13.5, color: 'var(--ctv3-muted)', lineHeight: 1.45 }}>
          Comparez vols, hôtels et assurance avant de réserver.
        </p>
      </div>

      {/* 3 CTA → /api/affiliate/click (hiérarchie : vol en primaire, hôtel/assurance en appui) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
        {CTAS.map((c, i) => (
          <a
            key={c.category}
            href={buildClickUrl(c.category, countryCode, countryName, bookingOpts)}
            target="_blank"
            rel="noopener noreferrer"
            style={{ textDecoration: 'none' }}
          >
            <MiniCta icon={c.icon} label={ctaLabel(c)} primary={i === 0} />
          </a>
        ))}
      </div>

      {/* Disclaimer — honnête, ton sobre */}
      <p className="ctv3-mono" style={{
        fontSize: 9.5, color: 'var(--ctv3-dim)', marginTop: 14, lineHeight: 1.5,
        letterSpacing: '0.02em',
      }}>
        Liens partenaires. Crisis Travel peut percevoir une commission si vous réservez via ces liens.
        Les tarifs peuvent varier selon dates, disponibilité et partenaires.
      </p>
    </div>
  );
}

function MiniCta({ icon, label, primary }: { icon: string; label: string; primary: boolean }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        background: primary
          ? (hovered ? 'var(--ctv3-red-2)' : 'var(--ctv3-red)')
          : (hovered ? 'var(--ctv3-ink-700)' : 'var(--ctv3-ink-800)'),
        border: primary ? '1px solid transparent' : '1px solid var(--ctv3-line)',
        padding: '12px 14px',
        transition: 'background 0.15s, transform 0.15s',
        transform: hovered ? 'translateY(-1px)' : 'none',
        cursor: 'pointer',
      }}
    >
      <span aria-hidden="true" style={{ fontSize: '0.95rem', color: primary ? '#fff' : 'var(--ctv3-muted)' }}>{icon}</span>
      <span className="ctv3-mono" style={{
        fontSize: 11, letterSpacing: '0.06em', fontWeight: 700,
        color: primary ? '#fff' : 'var(--ctv3-paper)',
      }}>
        {label} →
      </span>
    </div>
  );
}

// Exported for unit testing.
export { buildBookingUrl, ADULTS_BY_TYPE };
