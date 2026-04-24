'use client';
import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { CountrySearchBar } from './CountrySearchBar';
import { TARGET_COUNTRIES } from '@/lib/utils/countries';

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
const CONTINENTS: { id: Continent; label: string; emoji: string; color: string }[] = [
  { id: 'Europe',     label: 'Europe',        emoji: '🌍', color: '#4f8ef7' },
  { id: 'Africa',     label: 'Afrique',       emoji: '🌍', color: '#ff8c42' },
  { id: 'Asia',       label: 'Asie',          emoji: '🌏', color: '#00e5a0' },
  { id: 'Americas',   label: 'Amériques',     emoji: '🌎', color: '#ffd23f' },
  { id: 'MiddleEast', label: 'Moyen-Orient',  emoji: '🕌', color: '#c084fc' },
];

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'score',    label: '⚡ Meilleure opportunité' },
  { key: 'security', label: '🛡 Plus sûre' },
  { key: 'budget',   label: '💸 Moins cher' },
  { key: 'alpha',    label: '🔤 A–Z' },
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

// ── Static score hints (used for sorting when no live data) ───────────────────
// Each country has a static "opportunity hint" so sorting in region tab makes sense.
// This is a curated ranking, not a live score.
const STATIC_HINTS: Record<string, { score: number; security: number; budget: number }> = {
  GE: { score: 82, security: 85, budget: 90 }, TH: { score: 72, security: 80, budget: 85 },
  PT: { score: 70, security: 90, budget: 60 }, VN: { score: 68, security: 82, budget: 88 },
  AL: { score: 75, security: 80, budget: 85 }, GR: { score: 68, security: 85, budget: 65 },
  HR: { score: 65, security: 85, budget: 62 }, RS: { score: 70, security: 78, budget: 80 },
  ME: { score: 72, security: 80, budget: 78 }, JP: { score: 65, security: 90, budget: 50 },
  KH: { score: 62, security: 72, budget: 88 }, MA: { score: 63, security: 75, budget: 78 },
  SN: { score: 60, security: 72, budget: 80 }, RW: { score: 68, security: 78, budget: 75 },
  KE: { score: 55, security: 62, budget: 72 }, TN: { score: 62, security: 73, budget: 76 },
  MU: { score: 72, security: 85, budget: 60 }, UZ: { score: 70, security: 78, budget: 88 },
  KG: { score: 68, security: 75, budget: 90 }, PE: { score: 62, security: 65, budget: 78 },
  CO: { score: 58, security: 60, budget: 75 }, CR: { score: 65, security: 80, budget: 68 },
  MX: { score: 60, security: 62, budget: 72 }, AR: { score: 65, security: 72, budget: 85 },
  JO: { score: 68, security: 80, budget: 72 }, OM: { score: 72, security: 88, budget: 60 },
};

function getHint(code: string) {
  return STATIC_HINTS[code] ?? { score: 55, security: 55, budget: 55 };
}

// ── Sub-components ────────────────────────────────────────────────────────────

function TabBar({ active, onChange }: { active: Tab; onChange: (t: Tab) => void }) {
  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: 'direct',    label: 'Destination précise', icon: '🎯' },
    { id: 'region',    label: 'Explorer une région',  icon: '🌍' },
    { id: 'discovery', label: 'Surprends-moi',        icon: '✨' },
  ];
  return (
    <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: '#0d0d14', borderRadius: 12, padding: 4 }}>
      {tabs.map((t) => (
        <button key={t.id} onClick={() => onChange(t.id)} style={{
          flex: 1, padding: '9px 8px', border: 'none', borderRadius: 9, cursor: 'pointer',
          background: active === t.id ? '#ff4d2e' : 'transparent',
          color: active === t.id ? '#fff' : '#6b7280',
          fontFamily: 'var(--font-space-mono)', fontSize: '0.65rem',
          letterSpacing: '0.06em', transition: 'all 0.2s',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
        }}>
          <span>{t.icon}</span>
          <span style={{ display: 'none' }} className="tab-label">{t.label}</span>
          <style>{`@media (min-width: 480px) { .tab-label { display: inline !important } }`}</style>
          <span className="tab-label">{t.label}</span>
        </button>
      ))}
    </div>
  );
}

// ── Tab 2 : Region Explorer ──────────────────────────────────────────────────
function RegionTab({ onAnalyze }: { onAnalyze: (continent: Continent, sort: SortKey) => void }) {
  const [selected, setSelected] = useState<Continent | null>(null);
  const [sort, setSort] = useState<SortKey>('score');
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

  return (
    <div>
      {/* Continent pills */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
        {CONTINENTS.map((c) => (
          <button
            key={c.id}
            onClick={() => setSelected(selected === c.id ? null : c.id)}
            style={{
              padding: '7px 14px', borderRadius: 20, cursor: 'pointer',
              border: selected === c.id ? `1.5px solid ${c.color}` : '1.5px solid #1e1e2e',
              background: selected === c.id ? `${c.color}18` : '#0d0d14',
              color: selected === c.id ? c.color : '#6b7280',
              fontFamily: 'var(--font-dm-sans)', fontSize: '0.82rem', fontWeight: 600,
              transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: 5,
            }}
          >
            <span>{c.emoji}</span> {c.label}
          </button>
        ))}
      </div>

      {selected && (
        <>
          {/* Sort bar */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
            {SORT_OPTIONS.map((s) => (
              <button
                key={s.key}
                onClick={() => setSort(s.key)}
                style={{
                  padding: '4px 10px', borderRadius: 6, cursor: 'pointer',
                  border: sort === s.key ? '1px solid #ff4d2e' : '1px solid #1e1e2e',
                  background: sort === s.key ? 'rgba(255,77,46,0.1)' : 'transparent',
                  color: sort === s.key ? '#ff4d2e' : '#6b7280',
                  fontFamily: 'var(--font-space-mono)', fontSize: '0.58rem', letterSpacing: '0.06em',
                  transition: 'all 0.15s',
                }}
              >
                {s.label}
              </button>
            ))}
          </div>

          {/* Country grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 8, marginBottom: 16 }}>
            {countries.map((c) => {
              const sortValue = sort === 'security' ? c.hint.security : sort === 'budget' ? c.hint.budget : c.hint.score;
              const barColor = sortValue >= 70 ? '#00e5a0' : sortValue >= 55 ? '#ffd23f' : '#ff8c42';
              return (
                <button
                  key={c.code}
                  onClick={() => router.push(`/destination/${c.code}`)}
                  style={{
                    background: '#0d0d14', border: '1px solid #1e1e2e', borderRadius: 10,
                    padding: '10px 12px', cursor: 'pointer', textAlign: 'left',
                    transition: 'border-color 0.15s', display: 'flex', flexDirection: 'column', gap: 6,
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#3f3f5a')}
                  onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#1e1e2e')}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.55rem', fontFamily: 'var(--font-space-mono)', color: '#3f3f5a', letterSpacing: '0.06em' }}>
                      {c.code}
                    </span>
                    <span style={{ fontSize: '0.7rem', color: barColor, fontFamily: 'var(--font-space-mono)', fontWeight: 700 }}>
                      {sortValue}
                    </span>
                  </div>
                  <span style={{ fontSize: '0.82rem', color: '#e8e8e8', fontWeight: 600 }}>{c.name}</span>
                  {/* Mini bar */}
                  <div style={{ height: 2, background: '#1e1e2e', borderRadius: 1 }}>
                    <div style={{ height: '100%', width: `${sortValue}%`, background: barColor, borderRadius: 1, transition: 'width 0.4s ease' }} />
                  </div>
                </button>
              );
            })}
          </div>

          {/* Analyze whole region button */}
          <button
            onClick={() => onAnalyze(selected, sort)}
            style={{
              width: '100%', padding: '12px', borderRadius: 10, cursor: 'pointer',
              background: 'rgba(255,77,46,0.08)', border: '1px solid rgba(255,77,46,0.3)',
              color: '#ff4d2e', fontFamily: 'var(--font-space-mono)',
              fontSize: '0.72rem', letterSpacing: '0.1em', transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,77,46,0.15)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,77,46,0.08)'; }}
          >
            ⚡ ANALYSER TOUTE LA RÉGION {CONTINENTS.find(c => c.id === selected)?.label.toUpperCase()} EN TEMPS RÉEL →
          </button>
        </>
      )}

      {!selected && (
        <div style={{ textAlign: 'center', padding: '28px 0', color: '#3f3f5a', fontSize: '0.82rem' }}>
          Sélectionne une région pour explorer ses destinations
        </div>
      )}
    </div>
  );
}

// ── Tab 3 : Smart Discovery ───────────────────────────────────────────────────
const PRIORITY_OPTIONS = [
  { id: 'securite',  label: 'Sécurité maximale', icon: '🛡️', desc: 'Destinations ultra-sûres en priorité' },
  { id: 'budget',    label: 'Budget minimal',    icon: '💸', desc: 'Où ton argent vaut le plus' },
  { id: 'decouverte',label: 'Découverte',        icon: '🌏', desc: 'Destinations hors des sentiers battus' },
  { id: 'tout',      label: 'Équilibre parfait', icon: '⚡', desc: 'Le meilleur ratio sécurité/budget/expérience' },
];
const DURATION_OPTIONS = [
  { id: 'court',   label: 'Court séjour',    icon: '✈️',  desc: '3–7 jours' },
  { id: 'semaine', label: 'Deux semaines',   icon: '🗓️', desc: '8–15 jours' },
  { id: 'long',    label: 'Long séjour',     icon: '🌍', desc: '3 semaines et plus' },
];
const BUDGET_OPTIONS = [
  { id: 'serre',  label: 'Budget serré', icon: '🪙', desc: 'Moins de 800€' },
  { id: 'moyen',  label: 'Confortable',  icon: '💳', desc: '800€ – 2 000€' },
  { id: 'confort',label: 'Sans compter', icon: '💎', desc: '2 000€ et plus' },
];
const TRAVEL_TYPE_OPTIONS = [
  { id: 'solo',   label: 'Solo',          icon: '🧍' },
  { id: 'couple', label: 'En couple',     icon: '👫' },
  { id: 'family', label: 'En famille',    icon: '👨‍👩‍👧' },
  { id: 'nomad',  label: 'Nomad digital', icon: '💻' },
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
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontFamily: 'var(--font-space-mono)', fontSize: '0.62rem', color: '#3f3f5a', letterSpacing: '0.1em', marginBottom: 8 }}>
        {label}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(options.length, 2)}, 1fr)`, gap: 8 }}>
        {options.map((opt) => (
          <button
            key={opt.id}
            onClick={() => onChange(opt.id)}
            style={{
              padding: '10px 12px', borderRadius: 10, cursor: 'pointer', textAlign: 'left',
              border: value === opt.id ? '1.5px solid #ff4d2e' : '1.5px solid #1e1e2e',
              background: value === opt.id ? 'rgba(255,77,46,0.08)' : '#0d0d14',
              transition: 'all 0.15s',
            }}
          >
            <div style={{ fontSize: '1.2rem', marginBottom: 2 }}>{opt.icon}</div>
            <div style={{ fontSize: '0.82rem', color: value === opt.id ? '#ff4d2e' : '#e8e8e8', fontWeight: 600 }}>{opt.label}</div>
            {opt.desc && <div style={{ fontSize: '0.68rem', color: '#6b7280', marginTop: 2 }}>{opt.desc}</div>}
          </button>
        ))}
      </div>
    </div>
  );
}

function DiscoveryTab() {
  const router = useRouter();
  const [state, setState] = useState<DiscoveryState>({ priority: null, duration: null, budget: null, travelType: null });
  const set = (key: ChoiceKey) => (val: string) => setState((s) => ({ ...s, [key]: val as never }));
  const completed = Object.values(state).filter(Boolean).length;
  const total = 4;

  function handleGenerate() {
    const b = BUDGET_MAP[state.budget ?? 'moyen'];
    const d = DURATION_MAP[state.duration ?? 'semaine'];
    const tt = state.travelType ?? 'solo';
    const mode = state.priority === 'securite' ? 'bunker' : state.priority === 'budget' ? 'budget_crisis' : 'standard';
    const priority = state.priority ?? 'tout';
    router.push(`/results?budget=${b}&duration=${d}&travelType=${tt}&mode=${mode}&priority=${priority}`);
  }

  return (
    <div>
      {/* Progress */}
      <div style={{ marginBottom: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          <span style={{ fontFamily: 'var(--font-space-mono)', fontSize: '0.6rem', color: '#3f3f5a', letterSpacing: '0.08em' }}>
            PROFIL EN COURS
          </span>
          <span style={{ fontFamily: 'var(--font-space-mono)', fontSize: '0.6rem', color: completed === total ? '#00e5a0' : '#6b7280' }}>
            {completed}/{total}
          </span>
        </div>
        <div style={{ height: 2, background: '#1e1e2e', borderRadius: 1 }}>
          <div style={{ height: '100%', width: `${(completed / total) * 100}%`, background: completed === total ? '#00e5a0' : '#ff4d2e', borderRadius: 1, transition: 'width 0.3s ease' }} />
        </div>
      </div>

      <OptionGrid label="CE QUI COMPTE LE PLUS POUR TOI" options={PRIORITY_OPTIONS as never} value={state.priority} onChange={set('priority') as never} />
      <OptionGrid label="DURÉE DU VOYAGE" options={DURATION_OPTIONS as never} value={state.duration} onChange={set('duration') as never} />
      <OptionGrid label="BUDGET TOTAL" options={BUDGET_OPTIONS as never} value={state.budget} onChange={set('budget') as never} />
      <OptionGrid label="TU VOYAGES" options={TRAVEL_TYPE_OPTIONS as never} value={state.travelType} onChange={set('travelType') as never} />

      <button
        onClick={handleGenerate}
        disabled={completed < 2}
        style={{
          width: '100%', padding: '13px', borderRadius: 10, cursor: completed < 2 ? 'not-allowed' : 'pointer',
          background: completed >= 2 ? '#ff4d2e' : '#1e1e2e',
          border: 'none',
          color: completed >= 2 ? '#fff' : '#3f3f5a',
          fontFamily: 'var(--font-space-mono)', fontSize: '0.75rem', letterSpacing: '0.1em',
          transition: 'all 0.2s', marginTop: 4,
          boxShadow: completed >= 2 ? '0 4px 20px rgba(255,77,46,0.3)' : 'none',
        }}
      >
        {completed >= 4 ? '✨ GÉNÉRER MES RECOMMANDATIONS PERSONNALISÉES →' : completed >= 2 ? '⚡ VOIR LES DESTINATIONS →' : 'Réponds à au moins 2 questions'}
      </button>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export function SmartSearchHub() {
  const [tab, setTab] = useState<Tab>('direct');
  const router = useRouter();

  const handleRegionAnalyze = useCallback((continent: Continent, sort: SortKey) => {
    const sortMode = sort === 'security' ? 'bunker' : sort === 'budget' ? 'budget_crisis' : 'standard';
    router.push(`/results?continent=${continent}&mode=${sortMode}&budget=1500&duration=7&travelType=solo`);
  }, [router]);

  return (
    <div style={{ background: '#13131a', border: '1px solid #1e1e2e', borderRadius: 16, padding: 20 }}>
      <TabBar active={tab} onChange={setTab} />

      {tab === 'direct' && (
        <div>
          <CountrySearchBar />
          <p style={{ fontSize: '0.68rem', color: '#3f3f5a', marginTop: 8, textAlign: 'center' }}>
            Tape un pays, une ville ou un code — ex : &quot;Congo&quot;, &quot;Bali&quot;, &quot;TH&quot;
          </p>
        </div>
      )}

      {tab === 'region' && <RegionTab onAnalyze={handleRegionAnalyze} />}
      {tab === 'discovery' && <DiscoveryTab />}
    </div>
  );
}
