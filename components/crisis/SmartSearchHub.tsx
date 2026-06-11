'use client';
import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
// GOAL-038 : CountrySearchBar n'est plus rendu en V1 (onglet « Destination précise »
// retiré). Le composant reste dans le repo mais n'est plus importé ici.
import { TARGET_COUNTRIES } from '@/lib/utils/countries';
import { getHint } from '@/lib/utils/staticHints';
import { acquireAnalyzeLock, releaseAnalyzeLock } from '@/lib/utils/analyzeGuard';

// ── Types ────────────────────────────────────────────────────────────────────
type Tab = 'direct' | 'region' | 'discovery';
type SortKey = 'score' | 'security' | 'budget' | 'alpha';
type Continent = 'Europe' | 'Africa' | 'Asia' | 'Americas' | 'MiddleEast';

type DiscoveryState = {
  priority: 'securite' | 'budget' | 'decouverte' | 'tout' | null;
  duration: 'court' | 'semaine' | 'long' | null;
  budget: 'serre' | 'moyen' | 'confort' | null;
  travelType: 'solo' | 'couple' | 'family' | 'nomad' | null;
};

// ── Constants ────────────────────────────────────────────────────────────────
const FRENCH_AIRPORTS = [
  { code: 'CDG', name: 'Paris Charles de Gaulle', city: 'Paris' },
  { code: 'ORY', name: 'Paris Orly',              city: 'Paris' },
  { code: 'LYS', name: 'Lyon Saint-Exupéry',      city: 'Lyon' },
  { code: 'MRS', name: 'Marseille Provence',       city: 'Marseille' },
  { code: 'NCE', name: 'Nice Côte d\'Azur',        city: 'Nice' },
  { code: 'TLS', name: 'Toulouse Blagnac',         city: 'Toulouse' },
  { code: 'BOD', name: 'Bordeaux Mérignac',        city: 'Bordeaux' },
  { code: 'NTE', name: 'Nantes Atlantique',        city: 'Nantes' },
  { code: 'LIL', name: 'Lille Lesquin',            city: 'Lille' },
  { code: 'MPL', name: 'Montpellier Méditerranée', city: 'Montpellier' },
  { code: 'SXB', name: 'Strasbourg Entzheim',      city: 'Strasbourg' },
  { code: 'RNS', name: 'Rennes Saint-Jacques',     city: 'Rennes' },
  { code: 'GNB', name: 'Grenoble Alpes Isère',     city: 'Grenoble' },
  { code: 'BIA', name: 'Bastia Poretta',           city: 'Bastia' },
  { code: 'AJA', name: 'Ajaccio Napoléon Bonaparte', city: 'Ajaccio' },
  { code: 'RUN', name: 'La Réunion Roland Garros', city: 'La Réunion' },
  { code: 'PTP', name: 'Pointe-à-Pitre',           city: 'Guadeloupe' },
  { code: 'FDF', name: 'Fort-de-France Aimé Césaire', city: 'Martinique' },
];

const CONTINENTS: { id: Continent; label: string; emoji: string; color: string }[] = [
  { id: 'Europe',     label: 'Europe',        emoji: '', color: '#4f8ef7' },
  { id: 'Africa',     label: 'Afrique',       emoji: '', color: '#ff8c42' },
  { id: 'Asia',       label: 'Asie',          emoji: '', color: '#00e5a0' },
  { id: 'Americas',   label: 'Amériques',     emoji: '', color: '#ffd23f' },
  { id: 'MiddleEast', label: 'Moyen-Orient',  emoji: '', color: '#c084fc' },
];

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'score',    label: 'Meilleure opportunité' },
  { key: 'security', label: 'Plus sûre' },
  { key: 'budget',   label: 'Moins cher' },
  { key: 'alpha',    label: 'A–Z' },
];

const BUDGET_MAP: Record<NonNullable<DiscoveryState['budget']>, number> = {
  serre: 800,
  moyen: 1500,
  confort: 3000,
};

const DURATION_MAP: Record<NonNullable<DiscoveryState['duration']>, number> = {
  court: 5,
  semaine: 10,
  long: 21,
};

// ── Sub-components ────────────────────────────────────────────────────────────

// ── Date Range Picker ────────────────────────────────────────────────────────
function DateRangePicker({
  dateDepart, dateRetour, onDepartChange, onRetourChange, error,
}: {
  dateDepart: string;
  dateRetour: string;
  onDepartChange: (v: string) => void;
  onRetourChange: (v: string) => void;
  error: string | null;
}) {
  const inputStyle: React.CSSProperties = {
    width: '100%',
    background: 'var(--ctv3-ink-900)',
    border: '1px solid var(--ctv3-line)',
    color: 'var(--ctv3-paper)',
    fontFamily: 'var(--ctv3-mono)',
    fontSize: '0.85rem',
    padding: '10px 12px',
    outline: 'none',
    colorScheme: 'dark',
    boxSizing: 'border-box',
  };
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ display: 'flex', gap: 10 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: 'var(--ctv3-mono)', fontSize: '0.68rem', color: 'var(--ctv3-muted)', letterSpacing: '0.1em', marginBottom: 6 }}>
            DÉPART
          </div>
          <input
            type="date"
            value={dateDepart}
            onChange={(e) => onDepartChange(e.target.value)}
            style={inputStyle}
            aria-label="Date de départ"
          />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: 'var(--ctv3-mono)', fontSize: '0.68rem', color: 'var(--ctv3-muted)', letterSpacing: '0.1em', marginBottom: 6 }}>
            RETOUR
          </div>
          <input
            type="date"
            value={dateRetour}
            onChange={(e) => onRetourChange(e.target.value)}
            style={{
              ...inputStyle,
              borderColor: error ? 'var(--ctv3-red)' : 'var(--ctv3-line)',
            }}
            aria-label="Date de retour"
          />
        </div>
      </div>
      {error && (
        <p style={{ margin: '6px 0 0', fontFamily: 'var(--ctv3-mono)', fontSize: '0.75rem', color: 'var(--ctv3-red-2)' }}>
          {error}
        </p>
      )}
    </div>
  );
}

// ── Section header (FRONT-014) — sober numbered heading, .ctv3, no emoji/SVG ───
function SectionHeader({ index, label, hint }: { index: string; label: string; hint?: string }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
        <span style={{
          fontFamily: 'var(--ctv3-mono)', fontSize: '0.72rem', fontWeight: 700,
          letterSpacing: '0.08em', color: 'var(--ctv3-red-2)', flexShrink: 0,
        }}>
          {index}
        </span>
        <span style={{
          fontFamily: 'var(--ctv3-mono)', fontSize: '0.78rem', fontWeight: 700,
          letterSpacing: '0.1em', color: 'var(--ctv3-paper)', textTransform: 'uppercase',
        }}>
          {label}
        </span>
      </div>
      {hint && (
        <p style={{
          fontSize: '0.8rem', color: 'var(--ctv3-muted)', lineHeight: 1.5,
          margin: '6px 0 0', paddingLeft: 22,
        }}>
          {hint}
        </p>
      )}
    </div>
  );
}

function TabBar({ active, onChange }: { active: Tab; onChange: (t: Tab) => void }) {
  // V1 (GOAL-038) : l'onglet 'direct' (Destination précise) est retiré de l'interface.
  // Crisis Travel n'est pas un moteur universel de destinations ; il analyse une sélection
  // de pays opportunistes/émergents/sous-évalués. On ne garde donc que les deux parcours
  // de découverte, dans l'ordre produit voulu : découverte guidée d'abord, puis région.
  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: 'discovery', label: 'Surprends-moi',        icon: '' },
    { id: 'region',    label: 'Explorer une région',  icon: '' },
  ];
  return (
    <div style={{
      display: 'flex', gap: 4, marginBottom: 22,
      background: 'var(--ctv3-ink-900)', border: '1px solid var(--ctv3-line)',
      padding: 5,
    }}>
      {tabs.map((t) => (
        <button key={t.id} onClick={() => onChange(t.id)} style={{
          flex: 1, padding: '12px 10px', border: 'none', cursor: 'pointer',
          background: active === t.id ? 'var(--ctv3-red)' : 'transparent',
          color: active === t.id ? '#fff' : 'var(--ctv3-muted)',
          fontFamily: 'var(--ctv3-mono)', fontSize: '0.78rem',
          fontWeight: active === t.id ? 700 : 500,
          letterSpacing: '0.06em', transition: 'all 0.2s',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        }}>
          {/* Sober premium marker replacing the legacy emoji (Option B) */}
          <span aria-hidden style={{ fontSize: '0.5rem', opacity: active === t.id ? 1 : 0.5, lineHeight: 1 }}>●</span>
          <span className="ct-tab-label">{t.label}</span>
        </button>
      ))}
    </div>
  );
}

// ── Airport Selector ─────────────────────────────────────────────────────────
function AirportSelector({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const airport = FRENCH_AIRPORTS.find((a) => a.code === value) ?? FRENCH_AIRPORTS[0];

  return (
    <div style={{ position: 'relative', marginBottom: 18 }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        background: 'var(--ctv3-ink-900)', border: '1px solid var(--ctv3-line)',
        padding: '11px 14px', cursor: 'pointer',
      }} onClick={() => setOpen((o) => !o)}>
        {/* Sober dot marker replacing the legacy airport emoji (Option B) */}
        <span aria-hidden style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--ctv3-red)', flexShrink: 0 }} />
        <span style={{ fontFamily: 'var(--ctv3-mono)', fontSize: '0.7rem', color: 'var(--ctv3-muted)', letterSpacing: '0.1em', flexShrink: 0 }}>
          DÉPART DEPUIS
        </span>
        <span style={{ fontSize: '0.92rem', color: 'var(--ctv3-paper)', fontWeight: 600, flex: 1 }}>
          {airport.city}
        </span>
        <span style={{ fontFamily: 'var(--ctv3-mono)', fontSize: '0.7rem', color: 'var(--ctv3-muted)', background: 'var(--ctv3-ink-700)', padding: '3px 7px' }}>
          {airport.code}
        </span>
        <span style={{ color: 'var(--ctv3-faint)', fontSize: '0.7rem' }}>{open ? '▲' : '▼'}</span>
      </div>

      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, marginTop: 2,
          background: 'var(--ctv3-ink-850)', border: '1px solid var(--ctv3-line)',
          boxShadow: '0 8px 24px rgba(0,0,0,0.5)', maxHeight: 280, overflowY: 'auto',
        }}>
          {FRENCH_AIRPORTS.map((ap) => (
            <button
              key={ap.code}
              onClick={() => { onChange(ap.code); setOpen(false); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                padding: '11px 14px',
                background: ap.code === value ? 'rgba(228,51,43,0.16)' : 'transparent',
                border: 'none', borderBottom: '1px solid var(--ctv3-line-soft)', cursor: 'pointer', textAlign: 'left',
              }}
            >
              <span style={{ fontFamily: 'var(--ctv3-mono)', fontSize: '0.68rem', color: 'var(--ctv3-muted)', background: 'var(--ctv3-ink-700)', padding: '2px 6px', flexShrink: 0 }}>
                {ap.code}
              </span>
              <span style={{ fontSize: '0.9rem', color: ap.code === value ? 'var(--ctv3-red-2)' : 'var(--ctv3-paper)' }}>
                {ap.city}
              </span>
              <span style={{ fontSize: '0.78rem', color: 'var(--ctv3-faint)', marginLeft: 'auto' }}>
                {ap.name}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Tab 2 : Region Explorer ──────────────────────────────────────────────────
function RegionTab({ onAnalyze, airport, dateDepart, dateRetour, dateError }: {
  onAnalyze: (continent: Continent, sort: SortKey) => void;
  airport: string;
  dateDepart: string;
  dateRetour: string;
  dateError: string | null;
}) {
  const [selected, setSelected] = useState<Continent | null>(null);
  const [sort, setSort] = useState<SortKey>('score');
  const [pending, setPending] = useState(false);
  const router = useRouter();

  const countries = selected
    ? [...TARGET_COUNTRIES]
        .filter((c) => c.continent === selected)
        .map((c) => ({ ...c, hint: getHint(c.code) }))
        .sort((a, b) => {
          if (sort === 'alpha')    return a.name.localeCompare(b.name);
          if (sort === 'security') return b.hint.security - a.hint.security;
          if (sort === 'budget')   return b.hint.budget - a.hint.budget;
          return b.hint.score - a.hint.score;
        })
    : [];

  const selectedLabel = selected ? CONTINENTS.find((c) => c.id === selected)?.label : null;

  return (
    <div>
      {/* FRONT-014 — Section 2 : Région (étape dédiée + aide) */}
      <SectionHeader
        index="02"
        label="Région"
        hint="Choisis une région : l’analyse se concentre sur ses destinations."
      />

      {/* Continent pills */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 18 }}>
        {CONTINENTS.map((c) => (
          <button
            key={c.id}
            onClick={() => setSelected(selected === c.id ? null : c.id)}
            style={{
              padding: '9px 16px', cursor: 'pointer',
              border: selected === c.id ? `1.5px solid ${c.color}` : '1.5px solid var(--ctv3-line)',
              background: selected === c.id ? `${c.color}2e` : 'var(--ctv3-ink-800)',
              color: selected === c.id ? c.color : 'var(--ctv3-muted)',
              fontFamily: 'var(--ctv3-display)', fontSize: '0.9rem', fontWeight: 600,
              transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            {/* Colored dot marker via the continent's own color (replaces emoji, Option B) */}
            <span aria-hidden style={{ width: 7, height: 7, borderRadius: '50%', background: c.color, flexShrink: 0 }} /> {c.label}
          </button>
        ))}
      </div>

      {selected && (
        <>
          {/* Sort bar */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
            {SORT_OPTIONS.map((s) => (
              <button
                key={s.key}
                onClick={() => setSort(s.key)}
                style={{
                  padding: '7px 13px', cursor: 'pointer',
                  border: sort === s.key ? '1px solid var(--ctv3-red)' : '1px solid var(--ctv3-line)',
                  background: sort === s.key ? 'rgba(228,51,43,0.18)' : 'var(--ctv3-ink-800)',
                  color: sort === s.key ? 'var(--ctv3-red-2)' : 'var(--ctv3-muted)',
                  fontFamily: 'var(--ctv3-mono)', fontSize: '0.72rem', letterSpacing: '0.06em',
                  fontWeight: sort === s.key ? 700 : 500,
                  transition: 'all 0.15s',
                }}
              >
                {s.label}
              </button>
            ))}
          </div>

          {/* Country grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10, marginBottom: 18 }}>
            {countries.map((c) => {
              const sortValue = sort === 'security' ? c.hint.security : sort === 'budget' ? c.hint.budget : c.hint.score;
              const barColor = sortValue >= 70 ? 'var(--ctv3-ideal)' : sortValue >= 55 ? 'var(--ctv3-reco)' : 'var(--ctv3-poss)';
              return (
                <button
                  key={c.code}
                  onClick={() => router.push(`/destination/${c.code}`)}
                  style={{
                    background: 'var(--ctv3-ink-800)', border: '1px solid var(--ctv3-line)',
                    padding: '13px 14px', cursor: 'pointer', textAlign: 'left',
                    transition: 'border-color 0.15s', display: 'flex', flexDirection: 'column', gap: 8,
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--ctv3-line-bright)')}
                  onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--ctv3-line)')}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.65rem', fontFamily: 'var(--ctv3-mono)', color: 'var(--ctv3-faint)', letterSpacing: '0.06em' }}>
                      {c.code}
                    </span>
                    <span style={{ fontSize: '0.82rem', color: barColor, fontFamily: 'var(--ctv3-mono)', fontWeight: 700 }}>
                      {sortValue}
                    </span>
                  </div>
                  <span style={{ fontSize: '0.9rem', color: 'var(--ctv3-paper)', fontWeight: 600 }}>{c.name}</span>
                  {/* Mini bar */}
                  <div style={{ height: 3, background: 'var(--ctv3-line)', borderRadius: 2 }}>
                    <div style={{ height: '100%', width: `${sortValue}%`, background: barColor, borderRadius: 2, transition: 'width 0.4s ease' }} />
                  </div>
                </button>
              );
            })}
          </div>

          {/* FRONT-014 — Résumé « Votre analyse » (lecture seule, dérivé de l'état région existant) */}
          <div style={{
            marginBottom: 14, padding: '14px 16px',
            background: 'var(--ctv3-ink-900)', border: '1px solid var(--ctv3-line)',
          }}>
            <div style={{ fontFamily: 'var(--ctv3-mono)', fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.1em', color: 'var(--ctv3-muted)', textTransform: 'uppercase', marginBottom: 10 }}>
              Votre analyse
            </div>
            {[
              { k: 'Départ', v: airport },
              { k: 'Mode', v: 'Explorer une région' },
              { k: 'Région', v: selectedLabel ?? '—' },
              ...(dateDepart ? [{ k: 'Date départ', v: dateDepart }] : []),
              ...(dateRetour ? [{ k: 'Date retour', v: dateRetour }] : []),
            ].map((row) => (
              <div key={row.k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '4px 0' }}>
                <span style={{ fontFamily: 'var(--ctv3-mono)', fontSize: '0.74rem', color: 'var(--ctv3-faint)', letterSpacing: '0.04em' }}>{row.k}</span>
                <span style={{ fontSize: '0.84rem', color: 'var(--ctv3-paper)', fontWeight: 600 }}>{row.v}</span>
              </div>
            ))}
          </div>

          {/* FRONT-014 — Section : Lancer l'analyse (région) */}
          <SectionHeader index="03" label="Lancer l'analyse" />
          {/* Analyze whole region button */}
          <button
            disabled={pending || !!dateError}
            onClick={() => {
              if (dateError) return;
              if (!acquireAnalyzeLock()) return;
              setPending(true);
              // Micro-delay lets React flush the disabled state before navigation
              setTimeout(() => {
                onAnalyze(selected, sort);
                // Lock released by handleRegionAnalyze after router.push
              }, 50);
            }}
            style={{
              width: '100%', padding: '15px',
              cursor: (pending || !!dateError) ? 'not-allowed' : 'pointer',
              background: (pending || !!dateError) ? 'rgba(228,51,43,0.06)' : 'rgba(228,51,43,0.14)',
              border: '1px solid rgba(228,51,43,0.45)',
              color: (pending || !!dateError) ? 'var(--ctv3-faint)' : 'var(--ctv3-red-2)',
              fontFamily: 'var(--ctv3-mono)', fontWeight: 700,
              fontSize: '0.85rem', letterSpacing: '0.1em', transition: 'all 0.2s',
              opacity: (pending || !!dateError) ? 0.6 : 1,
            }}
            onMouseEnter={(e) => { if (!pending && !dateError) e.currentTarget.style.background = 'rgba(228,51,43,0.22)'; }}
            onMouseLeave={(e) => { if (!pending && !dateError) e.currentTarget.style.background = 'rgba(228,51,43,0.14)'; }}
          >
            {pending
              ? 'LANCEMENT EN COURS...'
              : `ANALYSER TOUTE LA RÉGION ${CONTINENTS.find(c => c.id === selected)?.label.toUpperCase()} DEPUIS ${airport} →`}
          </button>
        </>
      )}

      {!selected && (
        <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--ctv3-muted)', fontSize: '0.9rem' }}>
          Sélectionne une région pour explorer ses destinations
        </div>
      )}
    </div>
  );
}

// ── Tab 3 : Smart Discovery ───────────────────────────────────────────────────
const PRIORITY_OPTIONS = [
  { id: 'securite',  label: 'Sécurité maximale', icon: '', desc: 'Destinations ultra-sûres en priorité' },
  { id: 'budget',    label: 'Budget minimal',    icon: '', desc: 'Où ton argent vaut le plus' },
  { id: 'decouverte',label: 'Découverte',        icon: '', desc: 'Destinations hors des sentiers battus' },
  { id: 'tout',      label: 'Équilibre parfait', icon: '', desc: 'Le meilleur ratio sécurité/budget/expérience' },
];
const DURATION_OPTIONS = [
  { id: 'court',   label: 'Court séjour',    icon: '',  desc: '3–7 jours' },
  { id: 'semaine', label: 'Deux semaines',   icon: '', desc: '8–15 jours' },
  { id: 'long',    label: 'Long séjour',     icon: '', desc: '3 semaines et plus' },
];
const BUDGET_OPTIONS = [
  { id: 'serre',  label: 'Budget serré', icon: '', desc: 'Moins de 800€' },
  { id: 'moyen',  label: 'Confortable',  icon: '', desc: '800€ – 2 000€' },
  { id: 'confort',label: 'Sans compter', icon: '', desc: '2 000€ et plus' },
];
const TRAVEL_TYPE_OPTIONS = [
  { id: 'solo',   label: 'Solo',          icon: '' },
  { id: 'couple', label: 'En couple',     icon: '' },
  { id: 'family', label: 'En famille',    icon: '' },
  { id: 'nomad',  label: 'Nomad digital', icon: '' },
];

type ChoiceKey = 'priority' | 'duration' | 'budget' | 'travelType';

function OptionGrid<T extends string>({
  label, options, value, onChange,
}: {
  label: string;
  options: { id: T; label: string; icon: string; desc?: string }[];
  value: T | null;
  onChange: (v: T) => void;
}) {
  return (
    <div style={{ marginBottom: 22 }}>
      <div style={{ fontFamily: 'var(--ctv3-mono)', fontSize: '0.72rem', color: 'var(--ctv3-muted)', letterSpacing: '0.1em', marginBottom: 10 }}>
        {label}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(options.length, 2)}, 1fr)`, gap: 10 }}>
        {options.map((opt, idx) => (
          <button
            key={opt.id}
            onClick={() => onChange(opt.id)}
            style={{
              padding: '14px 14px', cursor: 'pointer', textAlign: 'left',
              border: value === opt.id ? '1.5px solid var(--ctv3-red)' : '1.5px solid var(--ctv3-line)',
              background: value === opt.id ? 'rgba(228,51,43,0.16)' : 'var(--ctv3-ink-800)',
              boxShadow: value === opt.id ? '0 0 0 1px rgba(228,51,43,0.25), 0 2px 12px rgba(228,51,43,0.12)' : 'none',
              transition: 'all 0.15s',
            }}
          >
            {/* Sober mono index marker replacing the legacy emoji (Option B) */}
            <div style={{
              fontFamily: 'var(--ctv3-mono)', fontSize: '0.68rem', fontWeight: 700,
              letterSpacing: '0.08em', marginBottom: 8,
              color: value === opt.id ? 'var(--ctv3-red-2)' : 'var(--ctv3-faint)',
            }}>
              {String(idx + 1).padStart(2, '0')}
            </div>
            <div style={{ fontSize: '0.9rem', color: value === opt.id ? 'var(--ctv3-red-2)' : 'var(--ctv3-paper)', fontWeight: 600 }}>{opt.label}</div>
            {opt.desc && <div style={{ fontSize: '0.78rem', color: value === opt.id ? 'var(--ctv3-muted)' : 'var(--ctv3-faint)', marginTop: 3, lineHeight: 1.4 }}>{opt.desc}</div>}
          </button>
        ))}
      </div>
    </div>
  );
}

function DiscoveryTab({ airport, dateDepart, dateRetour, dateError }: {
  airport: string;
  dateDepart: string;
  dateRetour: string;
  dateError: string | null;
}) {
  const router = useRouter();
  const [state, setState] = useState<DiscoveryState>({ priority: null, duration: null, budget: null, travelType: null });
  const [loading, setLoading] = useState(false);
  const set = (key: ChoiceKey) => (val: string) => {
    setState((s) => ({ ...s, [key]: val as never }));
  };
  const completed = Object.values(state).filter(Boolean).length;
  const total = 4;

  // GOAL-032 : suppression du double appel /api/analyze. DiscoveryTab ne lance PLUS
  // sa propre analyse (qui était ensuite refaite par /results). On navigue directement
  // vers /results — la SEULE page qui exécute l'analyse complète. Le verrou + loading
  // restent pour le feedback de clic et empêcher les doubles navigations.
  function handleGenerate() {
    if (dateError) return;
    if (!acquireAnalyzeLock()) return;
    const b = BUDGET_MAP[state.budget ?? 'moyen'];
    const d = DURATION_MAP[state.duration ?? 'semaine'];
    const tt = state.travelType ?? 'solo';
    const mode = state.priority === 'securite' ? 'bunker' : state.priority === 'budget' ? 'budget_crisis' : 'standard';
    const priority = state.priority ?? 'tout';

    setLoading(true);
    router.push(`/results?budget=${b}&duration=${d}&travelType=${tt}&mode=${mode}&priority=${priority}&airport=${airport}&from=${dateDepart}&to=${dateRetour}`);
    // Navigation en cours ; le verrou est relâché après une fenêtre (le composant sera démonté).
    setTimeout(releaseAnalyzeLock, 3000);
  }

  const remaining = Math.max(0, 2 - completed);

  return (
    <div>
      {/* FRONT-014 — Section 2 : Profil de voyage */}
      <SectionHeader
        index="02"
        label="Profil de voyage"
        hint="Réponds à au moins 2 critères. Plus tu en renseignes, plus l’analyse est précise."
      />

      <OptionGrid label="CE QUI COMPTE LE PLUS POUR TOI" options={PRIORITY_OPTIONS as never} value={state.priority} onChange={set('priority') as never} />
      <OptionGrid label="DURÉE DU VOYAGE" options={DURATION_OPTIONS as never} value={state.duration} onChange={set('duration') as never} />
      <OptionGrid label="BUDGET TOTAL" options={BUDGET_OPTIONS as never} value={state.budget} onChange={set('budget') as never} />
      <OptionGrid label="TU VOYAGES" options={TRAVEL_TYPE_OPTIONS as never} value={state.travelType} onChange={set('travelType') as never} />

      {/* FRONT-014 — Section 3 : Progression (compteur explicite + jalon du seuil minimum) */}
      <div style={{ marginBottom: 22 }}>
        <SectionHeader index="03" label="Progression" />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
          <span style={{ fontFamily: 'var(--ctv3-mono)', fontSize: '0.78rem', fontWeight: 700, color: completed === total ? 'var(--ctv3-ideal)' : 'var(--ctv3-paper)' }}>
            {completed} critère{completed > 1 ? 's' : ''} sur {total}
          </span>
          <span style={{ fontFamily: 'var(--ctv3-mono)', fontSize: '0.72rem', color: 'var(--ctv3-muted)' }}>
            minimum 2 pour lancer
          </span>
        </div>
        <div style={{ position: 'relative', height: 4, background: 'var(--ctv3-line)', borderRadius: 2 }}>
          <div style={{ height: '100%', width: `${(completed / total) * 100}%`, background: completed === total ? 'var(--ctv3-ideal)' : 'var(--ctv3-red)', borderRadius: 2, transition: 'width 0.3s ease' }} />
          {/* Jalon visuel du seuil minimum (2/4 = 50%) — repère d'affichage, ne change aucun seuil */}
          <div aria-hidden style={{ position: 'absolute', top: -2, left: '50%', width: 2, height: 8, background: 'var(--ctv3-paper)', opacity: 0.5 }} />
        </div>
      </div>

      {/* FRONT-014 — Résumé « Votre analyse » (lecture seule, dérivé de l'état existant) */}
      <div style={{
        marginBottom: 22, padding: '14px 16px',
        background: 'var(--ctv3-ink-900)', border: '1px solid var(--ctv3-line)',
      }}>
        <div style={{ fontFamily: 'var(--ctv3-mono)', fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.1em', color: 'var(--ctv3-muted)', textTransform: 'uppercase', marginBottom: 10 }}>
          Votre analyse
        </div>
        {[
          { k: 'Départ', v: airport },
          { k: 'Mode', v: 'Surprends-moi' },
          { k: 'Critères', v: `${completed} sur ${total}` },
          ...(dateDepart ? [{ k: 'Date départ', v: dateDepart }] : []),
          ...(dateRetour ? [{ k: 'Date retour', v: dateRetour }] : []),
        ].map((row) => (
          <div key={row.k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '4px 0' }}>
            <span style={{ fontFamily: 'var(--ctv3-mono)', fontSize: '0.74rem', color: 'var(--ctv3-faint)', letterSpacing: '0.04em' }}>{row.k}</span>
            <span style={{ fontSize: '0.84rem', color: 'var(--ctv3-paper)', fontWeight: 600 }}>{row.v}</span>
          </div>
        ))}
      </div>

      {/* FRONT-014 — Section 4 : Lancer l'analyse */}
      <SectionHeader index="04" label="Lancer l'analyse" />
      <button
        onClick={handleGenerate}
        disabled={completed < 2 || loading || !!dateError}
        style={{
          width: '100%', padding: '16px',
          cursor: completed < 2 || loading || !!dateError ? 'not-allowed' : 'pointer',
          background: completed >= 2 && !dateError ? 'var(--ctv3-red)' : 'var(--ctv3-ink-700)',
          border: completed >= 2 && !dateError ? '1px solid transparent' : '1px solid var(--ctv3-line)',
          color: completed >= 2 && !dateError ? '#fff' : 'var(--ctv3-faint)',
          fontFamily: 'var(--ctv3-mono)', fontSize: '0.9rem', fontWeight: 700, letterSpacing: '0.1em',
          transition: 'all 0.2s', marginTop: 8,
          boxShadow: completed >= 2 && !dateError ? '0 6px 24px rgba(228,51,43,0.35)' : 'none',
        }}
      >
        {loading ? 'ANALYSE EN COURS...' : completed >= 4 ? 'SURPRENDS-MOI →' : completed >= 2 ? 'VOIR MES DESTINATIONS →' : 'Réponds à au moins 2 questions'}
      </button>
      {/* FRONT-014 — Sous-texte d'état du CTA (affichage dérivé de completed, aucune logique modifiée) */}
      <p style={{ fontSize: '0.78rem', color: 'var(--ctv3-muted)', lineHeight: 1.5, margin: '8px 0 0', textAlign: 'center' }}>
        {completed < 2
          ? `Renseigne encore ${remaining} critère${remaining > 1 ? 's' : ''} pour lancer l’analyse.`
          : 'Prêt à lancer — tu pourras affiner ensuite.'}
      </p>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export function SmartSearchHub() {
  // GOAL-038 : la V1 ouvre sur la découverte guidée (« Surprends-moi »), cœur du
  // positionnement produit. L'ancien onglet 'direct' n'est plus atteignable via l'UI.
  const [tab, setTab] = useState<Tab>('discovery');
  const [airport, setAirport] = useState('CDG');
  const [dateDepart, setDateDepart] = useState('');
  const [dateRetour, setDateRetour] = useState('');
  const router = useRouter();

  // Validation : retour doit être strictement après départ (seulement si les deux sont renseignés)
  const dateError: string | null = (() => {
    if (!dateDepart || !dateRetour) return null;
    if (dateRetour <= dateDepart) return 'La date de retour doit être après la date de départ.';
    return null;
  })();

  // Persiste l'aéroport pour TravelPackBlock sur les fiches destination
  function handleAirportChange(code: string) {
    setAirport(code);
    if (typeof window !== 'undefined') localStorage.setItem('crisis_travel_airport', code);
  }

  const handleRegionAnalyze = useCallback((continent: Continent, sort: SortKey) => {
    const sortMode = sort === 'security' ? 'bunker' : sort === 'budget' ? 'budget_crisis' : 'standard';
    router.push(`/results?continent=${continent}&mode=${sortMode}&budget=1500&duration=7&travelType=solo&airport=${airport}&from=${dateDepart}&to=${dateRetour}`);
    // Release after a frame — navigation is in flight, lock stays until /results mounts
    setTimeout(releaseAnalyzeLock, 3000);
  }, [router, airport, dateDepart, dateRetour]);

  return (
    <div style={{
      background: 'var(--ctv3-ink-850)',
      border: '1px solid var(--ctv3-line)',
      borderTop: '2px solid var(--ctv3-red)',
      padding: 24,
      overflowX: 'hidden',
    }}>

      {/* Sélecteur d'aéroport — persistant, visible sur tous les onglets */}
      <AirportSelector value={airport} onChange={handleAirportChange} />

      {/* Dates de voyage — optionnelles, visibles sur tous les onglets */}
      <DateRangePicker
        dateDepart={dateDepart}
        dateRetour={dateRetour}
        onDepartChange={setDateDepart}
        onRetourChange={setDateRetour}
        error={dateError}
      />

      {/* Microcopy de positionnement (GOAL-038) — visible sur les deux parcours V1.
          Clarifie que Crisis Travel n'est pas un moteur universel de destinations :
          il détecte les pays où le contexte actuel crée une opportunité de voyage. */}
      <p style={{
        fontSize: '0.82rem', color: 'var(--ctv3-muted)', lineHeight: 1.6,
        textAlign: 'center', margin: '0 0 22px',
      }}>
        Pas toutes les destinations. Les bonnes opportunités. Crisis Travel analyse une
        sélection de pays <strong style={{ color: 'var(--ctv3-paper)', fontWeight: 600 }}>opportunistes,
        émergents ou sous-évalués</strong> et repère ceux où le contexte actuel peut rendre
        le voyage plus avantageux.
      </p>

      {/* FRONT-014 — Section 1 : Mode d'analyse (titre + onglets + aide contextuelle) */}
      <div style={{ marginBottom: 22 }}>
        <SectionHeader index="01" label="Mode d'analyse" />
        <TabBar active={tab} onChange={setTab} />
        <p style={{ fontSize: '0.8rem', color: 'var(--ctv3-muted)', lineHeight: 1.5, margin: '10px 0 0' }}>
          {tab === 'discovery'
            ? 'Réponds à quelques critères : l’analyse trouve les destinations qui te correspondent.'
            : 'Choisis une région : l’analyse se concentre sur ses destinations.'}
        </p>
      </div>

      {tab === 'region' && <RegionTab onAnalyze={handleRegionAnalyze} airport={airport} dateDepart={dateDepart} dateRetour={dateRetour} dateError={dateError} />}
      {tab === 'discovery' && <DiscoveryTab airport={airport} dateDepart={dateDepart} dateRetour={dateRetour} dateError={dateError} />}
    </div>
  );
}
