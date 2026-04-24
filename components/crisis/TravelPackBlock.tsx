'use client';
import { useEffect, useState } from 'react';

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

  // Liens affiliés (à remplacer par les IDs Travelpayouts une fois inscrits)
  const skyscannerUrl = `https://www.skyscanner.fr/transport/vols/${airport.toLowerCase()}/anywhere/?adults=1&currency=EUR`;
  const bookingUrl    = `https://www.booking.com/searchresults.fr.html?ss=${encodeURIComponent(countryName)}&lang=fr&currency=EUR`;
  const chapkaUrl     = `https://www.chapkadirect.fr/`;

  const durationOptions = [
    { v: 5, label: '5 jours' }, { v: 7, label: '1 semaine' },
    { v: 10, label: '10 jours' }, { v: 14, label: '2 semaines' }, { v: 21, label: '3 semaines' },
  ];

  return (
    <div style={{
      background: 'linear-gradient(135deg, #13131a 0%, #0f0f1a 100%)',
      border: '1px solid rgba(255,77,46,0.25)',
      borderRadius: 14, padding: '22px', marginTop: 20,
      boxShadow: '0 0 40px rgba(255,77,46,0.05) inset',
    }}>
      {/* Titre */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
        <div>
          <h2 style={{
            fontFamily: 'var(--font-space-mono)', fontSize: '0.85rem',
            color: '#ff4d2e', letterSpacing: '0.1em', margin: 0,
          }}>
            ✈️ TON PACK VOYAGE ESTIMÉ
          </h2>
          <p style={{ fontSize: '0.68rem', color: '#3f3f5a', margin: '3px 0 0', fontFamily: 'var(--font-space-mono)' }}>
            {airport} → {countryName.toUpperCase()} · Prix indicatifs en EUR
          </p>
        </div>
        {/* Sélecteur durée */}
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {durationOptions.map((d) => (
            <button
              key={d.v}
              onClick={() => setDuration(d.v)}
              style={{
                padding: '3px 8px', borderRadius: 5, cursor: 'pointer', border: 'none',
                background: duration === d.v ? '#ff4d2e' : '#1e1e2e',
                color: duration === d.v ? '#fff' : '#6b7280',
                fontFamily: 'var(--font-space-mono)', fontSize: '0.58rem', letterSpacing: '0.04em',
                transition: 'all 0.15s',
              }}
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>

      {/* Lignes de coût */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 18 }}>
        {/* Vol */}
        <CostLine
          icon="🛫" label={`Vol A/R depuis ${airport}`}
          value={`~${flightCost.toLocaleString('fr-FR')}€`}
          note="estimation basse saison"
          color="#6b7280"
        />
        {/* Hôtel */}
        {hotelCost !== null ? (
          <CostLine
            icon="🏨" label={`Hôtel ${duration} nuits`}
            value={`~${hotelCost.toLocaleString('fr-FR')}€`}
            note="hôtel moyen de gamme"
            color="#6b7280"
          />
        ) : (
          <CostLine icon="🏨" label={`Hôtel ${duration} nuits`} value="données insuffisantes" color="#3f3f5a" />
        )}
        {/* Vie quotidienne */}
        {dailyBudget !== null ? (
          <CostLine
            icon="🍽️" label={`Budget vie ${duration} jours`}
            value={`~${dailyBudget.toLocaleString('fr-FR')}€`}
            note="repas + transports locaux"
            color="#6b7280"
          />
        ) : (
          <CostLine icon="🍽️" label={`Budget vie ${duration} jours`} value="données insuffisantes" color="#3f3f5a" />
        )}

        {/* Séparateur */}
        <div style={{ height: 1, background: '#1e1e2e', margin: '4px 0' }} />

        {/* Total */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontFamily: 'var(--font-space-mono)', fontSize: '0.75rem', color: '#e8e8e8', letterSpacing: '0.06em' }}>
            TOTAL ESTIMÉ
          </span>
          <div style={{ textAlign: 'right' }}>
            <span style={{
              fontFamily: 'var(--font-space-mono)', fontSize: '1.6rem',
              fontWeight: 700, color: '#ff4d2e',
            }}>
              ~{total.toLocaleString('fr-FR')}€
            </span>
            <div style={{ fontSize: '0.6rem', color: '#3f3f5a', marginTop: 1 }}>
              par personne · estimation indicative
            </div>
          </div>
        </div>
      </div>

      {/* CTAs affiliés */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <a href={skyscannerUrl} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
          <CtaButton
            icon="🛫"
            label="TROUVER MON VOL"
            sub={`Depuis ${airport} — meilleur prix garanti`}
            bgColor="#dc2626"
            hoverColor="#ef4444"
          />
        </a>
        <a href={bookingUrl} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
          <CtaButton
            icon="🏨"
            label="RÉSERVER MON HÔTEL"
            sub={`${countryName} — Annulation gratuite disponible`}
            bgColor="#1d4ed8"
            hoverColor="#2563eb"
          />
        </a>
        <a href={chapkaUrl} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
          <CtaButton
            icon="🛡️"
            label="ASSURANCE VOYAGE"
            sub="Chapka Direct — rapatriement, annulation, santé"
            bgColor="#065f46"
            hoverColor="#047857"
          />
        </a>
      </div>

      {/* Disclaimer */}
      <p style={{ fontSize: '0.6rem', color: '#3f3f5a', marginTop: 14, textAlign: 'center', lineHeight: 1.5 }}>
        Les prix affichés sont des estimations indicatives. Les tarifs réels dépendent de la date,
        disponibilité et aéroport. Crisis Travel peut percevoir une commission si vous réservez via ces liens.
      </p>
    </div>
  );
}

// ── Sous-composants ───────────────────────────────────────────────────────────

function CostLine({ icon, label, value, note, color }: {
  icon: string; label: string; value: string; note?: string; color: string;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: '0.9rem' }}>{icon}</span>
        <div>
          <span style={{ fontSize: '0.82rem', color: '#c0c0c0' }}>{label}</span>
          {note && <span style={{ fontSize: '0.65rem', color: '#3f3f5a', marginLeft: 6 }}>{note}</span>}
        </div>
      </div>
      <span style={{ fontFamily: 'var(--font-space-mono)', fontSize: '0.85rem', color, fontWeight: 600, flexShrink: 0 }}>
        {value}
      </span>
    </div>
  );
}

function CtaButton({ icon, label, sub, bgColor, hoverColor }: {
  icon: string; label: string; sub: string; bgColor: string; hoverColor: string;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        background: hovered ? hoverColor : bgColor,
        borderRadius: 9, padding: '11px 16px', transition: 'background 0.15s, transform 0.15s',
        transform: hovered ? 'translateY(-1px)' : 'none',
        boxShadow: hovered ? `0 4px 16px ${bgColor}60` : 'none',
        cursor: 'pointer',
      }}
    >
      <span style={{ fontSize: '1.1rem' }}>{icon}</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontFamily: 'var(--font-space-mono)', fontSize: '0.72rem', color: '#fff', letterSpacing: '0.08em', fontWeight: 700 }}>
          {label} →
        </div>
        <div style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.6)', marginTop: 1 }}>{sub}</div>
      </div>
      <span style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.4)' }}>↗</span>
    </div>
  );
}
