'use client';
import { useEffect, useState } from 'react';

// FRONT-005 : refonte visuelle uniquement (système ctv3, direction éditoriale
// premium). La logique d'estimation, les paramètres préremplis, l'aéroport
// (localStorage), le sélecteur de durée et TOUS les CTA passant par
// /api/affiliate/click sont préservés à l'identique. Aucun lien partenaire
// direct, aucun affiliate_id côté front : le tracking + la redirection (302)
// sont résolus côté serveur.

// ── Prix de vol approximatifs depuis CDG (EUR aller-retour) ──────────────────
// Source : données historiques Skyscanner/Google Flights, mis à jour trimestriellement
const FLIGHT_PRICES_CDG: Record<string, number> = {
  // Europe
  PT: 110, GR: 100, HR: 110, AL: 120, RS: 130, BA: 130, ME: 140, GE: 180,
  MD: 160, TR: 140, MK: 130, AM: 200, HU: 90, XK: 140,
  // Afrique du Nord
  MA: 120, TN: 130, EG: 200,
  // Afrique Subsaharienne
  SN: 350, CI: 450, GH: 500, CM: 450, CG: 600, CD: 650, NG: 500,
  KE: 450, TZ: 500, RW: 500, ET: 400, ZA: 650, MU: 680, MG: 750, AO: 580,
  // Asie
  TH: 450, VN: 500, JP: 650, ID: 550, KH: 520, LK: 500, PH: 600,
  MY: 520, SG: 550, MM: 580, NP: 550, IN: 400, KZ: 380, KG: 380, UZ: 370,
  // Amériques
  MX: 600, CO: 650, PE: 700, EC: 720, BO: 760, PY: 780, UY: 800,
  GT: 680, CR: 640, PA: 660, CU: 600, DO: 550, BR: 700, AR: 750, CL: 900,
  // Moyen-Orient
  JO: 200, AE: 280, OM: 300,
};

// Coefficients par aéroport de départ (par rapport à CDG)
const AIRPORT_COEFF: Record<string, number> = {
  CDG: 1.00, ORY: 1.05, LYS: 1.10, MRS: 1.05, NCE: 1.08, TLS: 1.12,
  BOD: 1.12, NTE: 1.15, LIL: 1.15, MPL: 1.10, SXB: 1.18, RNS: 1.18,
  GNB: 1.20, BIA: 1.25, AJA: 1.25,
  // DOM-TOM — déjà sur place ou hubs régionaux
  RUN: 0.85, PTP: 0.90, FDF: 0.90,
};

function estimateFlight(countryCode: string, airport: string, duration: number): number {
  const base = FLIGHT_PRICES_CDG[countryCode] ?? 500;
  const coeff = AIRPORT_COEFF[airport] ?? 1.10;
  return Math.round(base * coeff);
}

interface TravelPackBlockProps {
  countryCode: string;
  countryName: string;
  mealCheapEur?: number;   // Repas bon marché en EUR (depuis Numbeo)
  hotelAvgEur?: number;    // Hôtel moyen par nuit en EUR
}

export function TravelPackBlock({ countryCode, countryName, mealCheapEur, hotelAvgEur }: TravelPackBlockProps) {
  const [airport, setAirport] = useState('CDG');
  const [duration, setDuration] = useState(7);

  // Lire l'aéroport depuis localStorage (sauvegardé par SmartSearchHub)
  useEffect(() => {
    const saved = localStorage.getItem('crisis_travel_airport');
    if (saved) setAirport(saved);
  }, []);

  // Calculs
  const flightCost = estimateFlight(countryCode, airport, duration);
  const hotelCost  = hotelAvgEur ? Math.round(hotelAvgEur * duration) : null;
  const dailyBudget = mealCheapEur ? Math.round(mealCheapEur * 3 * duration) : null;
  const total = flightCost + (hotelCost ?? 0) + (dailyBudget ?? 0);

  // URLs cibles contextualisées (publiques pour l'instant : aucun ID d'affiliation réel).
  const skyscannerUrl = 'https://www.skyscanner.fr/';
  // Booking URL enriched with group_adults=1 and no_rooms=1.
  // No dates injected here: the destination page has no date picker, so checkin/checkout
  // would require guessing — omitting is safer than sending wrong dates.
  const bookingUrl = (() => {
    const p = new URLSearchParams({
      ss: countryName,
      lang: 'fr',
      currency: 'EUR',
      group_adults: '1',
      no_rooms: '1',
    });
    return `https://www.booking.com/searchresults.fr.html?${p.toString()}`;
  })();
  const chapkaUrl     = `https://www.chapkadirect.fr/`;
  // Cibles publiques des partenaires secondaires (transfert / activités / eSIM).
  // Ce sont des pages PUBLIQUES : aucun lien d'affiliation (tpo.mx) côté front.
  // Le deep-link Travelpayouts est résolu côté serveur via redirect_url en base.
  const transferUrl   = 'https://www.welcomepickups.com/';
  const activityUrl    = 'https://www.tiqets.com/';
  const esimUrl        = 'https://www.airalo.com/';

  // Tous les CTA passent par /api/affiliate/click : le clic est tracé côté serveur
  // PUIS l'utilisateur est redirigé (302) vers le partenaire. L'ID d'affiliation réel
  // sera injecté en base plus tard sans toucher au front.
  const trackUrl = (
    category: 'flight' | 'hotel' | 'insurance' | 'transfer' | 'activity' | 'esim',
    partner: string,
    target: string,
  ) =>
    `/api/affiliate/click?category=${category}&partner=${partner}` +
    `&url=${encodeURIComponent(target)}` +
    `&country=${encodeURIComponent(countryCode)}` +
    `&countryName=${encodeURIComponent(countryName)}` +
    `&total=${total}`;

  const flightHref    = trackUrl('flight', 'skyscanner', skyscannerUrl);
  const hotelHref     = trackUrl('hotel', 'booking', bookingUrl);
  const insuranceHref = trackUrl('insurance', 'chapka', chapkaUrl);
  // Partenaires secondaires (GOAL-048) — slugs activés en base au GOAL-047.
  const transferHref  = trackUrl('transfer', 'welcome-pickups', transferUrl);
  const activityHref  = trackUrl('activity', 'tiqets', activityUrl);
  const esimHref      = trackUrl('esim', 'airalo', esimUrl);

  const durationOptions = [
    { v: 5, label: '5 j' }, { v: 7, label: '1 sem.' },
    { v: 10, label: '10 j' }, { v: 14, label: '2 sem.' }, { v: 21, label: '3 sem.' },
  ];

  return (
    <div style={{
      border: '1px solid var(--ctv3-line)',
      borderTop: '2px solid var(--ctv3-red)',
      background: 'var(--ctv3-ink-850)',
      padding: '22px',
      marginTop: 20,
    }}>
      {/* En-tête éditorial + sélecteur durée */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 18, flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0 }}>
          <span className="ctv3-mono" style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            fontSize: 10, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'var(--ctv3-red)',
          }}>
            <span style={{ width: 14, height: 1, background: 'currentColor', opacity: 0.6 }} />
            Préparer le voyage
          </span>
          <h2 style={{
            fontFamily: 'var(--ctv3-display)', fontWeight: 800, fontSize: 19,
            letterSpacing: '-0.02em', color: 'var(--ctv3-paper)', margin: '8px 0 4px',
          }}>
            Votre pack voyage estimé
          </h2>
          <p className="ctv3-mono" style={{ fontSize: 10, color: 'var(--ctv3-faint)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            {airport} → {countryName} · estimation indicative · hors disponibilité temps réel
          </p>
        </div>
        {/* Sélecteur durée */}
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {durationOptions.map((d) => {
            const active = duration === d.v;
            return (
              <button
                key={d.v}
                onClick={() => setDuration(d.v)}
                className="ctv3-mono"
                style={{
                  padding: '5px 9px', cursor: 'pointer',
                  border: `1px solid ${active ? 'var(--ctv3-red)' : 'var(--ctv3-line)'}`,
                  background: active ? 'var(--ctv3-red)' : 'transparent',
                  color: active ? '#fff' : 'var(--ctv3-muted)',
                  fontSize: 10, letterSpacing: '0.06em', fontWeight: 700,
                  transition: 'all 0.15s',
                }}
              >
                {d.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Lignes de coût */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginBottom: 18 }}>
        <CostLine label={`Vol A/R depuis ${airport}`} value={`~${flightCost.toLocaleString('fr-FR')}€`} note="estimation basse saison" />
        {hotelCost !== null
          ? <CostLine label={`Hôtel ${duration} nuits`} value={`~${hotelCost.toLocaleString('fr-FR')}€`} note="hôtel moyen de gamme" />
          : <CostLine label={`Hôtel ${duration} nuits`} value="données insuffisantes" muted />}
        {dailyBudget !== null
          ? <CostLine label={`Budget vie ${duration} jours`} value={`~${dailyBudget.toLocaleString('fr-FR')}€`} note="repas + transports locaux" />
          : <CostLine label={`Budget vie ${duration} jours`} value="données insuffisantes" muted />}

        {/* Séparateur */}
        <div style={{ height: 1, background: 'var(--ctv3-line-soft)', margin: '8px 0' }} />

        {/* Total */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span className="ctv3-mono" style={{ fontSize: 11, color: 'var(--ctv3-paper)', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 700 }}>
            Total estimé
          </span>
          <div style={{ textAlign: 'right' }}>
            <span className="ctv3-mono" style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.03em', color: 'var(--ctv3-red-2)' }}>
              ~{total.toLocaleString('fr-FR')}€
            </span>
            <div className="ctv3-mono" style={{ fontSize: 9, color: 'var(--ctv3-dim)', marginTop: 1, letterSpacing: '0.04em' }}>
              par personne · prix indicatifs
            </div>
          </div>
        </div>
      </div>

      {/* CTA primaires → /api/affiliate/click */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <a href={flightHref} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
          <CtaButton icon="✈" label="Trouver mon vol" sub={`Depuis ${airport} · comparateur`} primary />
        </a>
        <a href={hotelHref} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
          <CtaButton icon="⌂" label="Réserver mon hôtel" sub={`${countryName} · annulation gratuite possible`} />
        </a>
        <a href={insuranceHref} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
          <CtaButton icon="⛨" label="Assurance voyage" sub="Rapatriement · annulation · santé" />
        </a>
      </div>

      {/* CTA secondaires — préparation voyage (transfert / activités / eSIM) : pills discrètes */}
      <div style={{ marginTop: 14 }}>
        <div className="ctv3-mono" style={{
          fontSize: 9.5, color: 'var(--ctv3-faint)', letterSpacing: '0.16em', marginBottom: 8, textTransform: 'uppercase',
        }}>
          Aussi utile sur place
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 8 }}>
          <a href={transferHref} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
            <SecondaryCta icon="⇄" label="Transfert" />
          </a>
          <a href={activityHref} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
            <SecondaryCta icon="◷" label="Activités" />
          </a>
          <a href={esimHref} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
            <SecondaryCta icon="≡" label="eSIM" />
          </a>
        </div>
      </div>

      {/* Disclaimer — honnête, ton sobre */}
      <p className="ctv3-mono" style={{ fontSize: 9.5, color: 'var(--ctv3-dim)', marginTop: 14, lineHeight: 1.55, letterSpacing: '0.02em' }}>
        Estimation indicative, hors disponibilité en temps réel. Les tarifs peuvent varier selon les dates,
        la disponibilité et les partenaires. Crisis Travel peut percevoir une commission si vous réservez via ces liens.
      </p>
    </div>
  );
}

// ── Sous-composants ───────────────────────────────────────────────────────────

function CostLine({ label, value, note, muted }: {
  label: string; value: string; note?: string; muted?: boolean;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, padding: '6px 0' }}>
      <div style={{ minWidth: 0 }}>
        <span style={{ fontSize: 14, color: 'var(--ctv3-paper)' }}>{label}</span>
        {note && <span className="ctv3-mono" style={{ fontSize: 9.5, color: 'var(--ctv3-faint)', marginLeft: 8, letterSpacing: '0.04em' }}>{note}</span>}
      </div>
      <span className="ctv3-mono" style={{
        fontSize: 14, color: muted ? 'var(--ctv3-dim)' : 'var(--ctv3-paper)', fontWeight: 600, flexShrink: 0,
      }}>
        {value}
      </span>
    </div>
  );
}

function CtaButton({ icon, label, sub, primary }: {
  icon: string; label: string; sub: string; primary?: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        background: primary
          ? (hovered ? 'var(--ctv3-red-2)' : 'var(--ctv3-red)')
          : (hovered ? 'var(--ctv3-ink-700)' : 'var(--ctv3-ink-800)'),
        border: primary ? '1px solid transparent' : '1px solid var(--ctv3-line)',
        padding: '13px 16px',
        transition: 'background 0.15s, transform 0.15s',
        transform: hovered ? 'translateY(-1px)' : 'none',
        cursor: 'pointer',
      }}
    >
      <span aria-hidden="true" style={{ fontSize: '1.05rem', color: primary ? '#fff' : 'var(--ctv3-muted)' }}>{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="ctv3-mono" style={{ fontSize: 12, color: primary ? '#fff' : 'var(--ctv3-paper)', letterSpacing: '0.04em', fontWeight: 700 }}>
          {label} →
        </div>
        <div style={{ fontSize: 11.5, color: primary ? 'rgba(255,255,255,0.7)' : 'var(--ctv3-muted)', marginTop: 1 }}>{sub}</div>
      </div>
      <span aria-hidden="true" style={{ fontSize: '0.8rem', color: primary ? 'rgba(255,255,255,0.5)' : 'var(--ctv3-faint)' }}>↗</span>
    </div>
  );
}

// Pill compacte pour les CTA secondaires (transfert / activités / eSIM).
// Volontairement plus discrète que CtaButton : fond neutre, pas d'accent fort.
function SecondaryCta({ icon, label }: { icon: string; label: string }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
        background: hovered ? 'var(--ctv3-ink-700)' : 'var(--ctv3-ink-800)',
        border: '1px solid var(--ctv3-line)',
        padding: '9px 10px',
        transition: 'background 0.15s, transform 0.15s',
        transform: hovered ? 'translateY(-1px)' : 'none',
        cursor: 'pointer',
      }}
    >
      <span aria-hidden="true" style={{ fontSize: '0.9rem', color: 'var(--ctv3-faint)' }}>{icon}</span>
      <span className="ctv3-mono" style={{ fontSize: 10.5, color: 'var(--ctv3-paper)', letterSpacing: '0.04em', fontWeight: 600 }}>
        {label} →
      </span>
    </div>
  );
}
