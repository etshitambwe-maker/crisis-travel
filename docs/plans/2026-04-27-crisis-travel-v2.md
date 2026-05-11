# Crisis Travel v2 — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rendre Crisis Travel parfait : vraies photos de pays, scores WorldBank corrigés, CrisisScore expliqué via tooltip discret, recherche enrichie, dates transmises à l'API, et performance /results améliorée.

**Architecture:** Six tâches indépendantes implémentées dans l'ordre. Chaque tâche modifie un périmètre précis sans casser les autres. Pas de nouveaux packages requis — tout est natif (fetch, React state, CSS).

**Tech Stack:** Next.js 14 App Router, TypeScript strict, Tailwind/inline styles, Redis Upstash, Wikimedia REST API (gratuit, sans clé)

---

## Task 1 — WorldBank ISO codes fix

**Problème:** L'API World Bank utilise ses propres codes pour certains pays ambigus (ex: `GE` = Géorgie renvoie null car World Bank utilise `GEO`). L'URL actuelle passe le code ISO-2 en minuscules mais l'API accepte aussi ISO-3. Solution : utiliser directement le code `iso3` (déjà dans `TARGET_COUNTRIES`) au lieu du code ISO-2.

**Files:**
- Modify: `lib/services/geopolitical/worldbank.service.ts`
- Modify: `lib/services/scoring/crisisScore.service.ts` (passer `iso3` à `getWorldBankScore`)

**Step 1: Modifier la signature de getWorldBankScore pour accepter iso3**

Dans `lib/services/geopolitical/worldbank.service.ts`, remplacer la fonction `fetchIndicator` pour utiliser le code passé directement (ISO-3) et mettre à jour l'export :

```typescript
async function fetchIndicator(isoCode: string, indicator: string): Promise<number | null> {
  const res = await axios.get(
    `https://api.worldbank.org/v2/country/${isoCode.toLowerCase()}/indicator/${indicator}`,
    { params: { format: 'json', mrv: 1 }, timeout: 5000 }
  );
  const rows = res.data as [unknown, Array<{ value: number | null }>];
  return rows[1]?.[0]?.value ?? null;
}

export async function getWorldBankScore(
  countryCode: string,
  iso3?: string
): Promise<ServiceResult<{ score: number }>> {
  const codeToUse = iso3 ?? countryCode;
  const key = buildCacheKey('worldbank', countryCode);
  // ... reste identique mais passer codeToUse à fetchIndicator
```

**Step 2: Modifier crisisScore.service.ts pour passer iso3**

Dans `lib/services/scoring/crisisScore.service.ts`, fonction `calcGeopolitical` :

```typescript
async function calcGeopolitical(c: CountryInfo): Promise<SubScore> {
  const [r_perp, r_wb] = await Promise.allSettled([
    getPerplexityGeoScore(c.code, c.name),
    getWorldBankScore(c.code, c.iso3),  // ← ajouter c.iso3
  ]);
```

**Step 3: Vérifier que le build passe**

```bash
cd "c:\Users\asus\Desktop\01_PROJETS_ACTIFS\appli voyage\crisis-travel"
npx tsc --noEmit
```
Expected: 0 erreurs

---

## Task 2 — Photos Wikimedia Commons

**Problème:** Picsum donne des photos aléatoires non représentatives. Wikimedia Commons retourne la vraie photo de la page Wikipedia du pays via `https://en.wikipedia.org/api/rest_v1/page/summary/{EnglishName}`.

**Files:**
- Modify: `lib/utils/countryPhoto.ts` — remplacer toute la logique Picsum par Wikimedia
- Modify: `lib/utils/countries.ts` — ajouter champ `wikiName` (nom anglais pour l'API Wikipedia)
- No change needed: `components/crisis/CountryCard.tsx`, `app/destination/[country]/page.tsx` — ils appellent déjà `getCountryPhotoUrl` / `getCountryPhotoUrlLarge`

**Step 1: Ajouter wikiName dans TARGET_COUNTRIES**

Dans `lib/utils/countries.ts`, ajouter `wikiName` à chaque entrée (nom anglais exact de la page Wikipedia). Exemples :
```typescript
{ code: 'PT', name: 'Portugal', wikiName: 'Portugal', ... },
{ code: 'GE', name: 'Géorgie', wikiName: 'Georgia_(country)', ... },
{ code: 'TH', name: 'Thaïlande', wikiName: 'Thailand', ... },
{ code: 'MA', name: 'Maroc', wikiName: 'Morocco', ... },
// Pour les noms ambigus, utiliser le disambiguateur Wikipedia : Georgia_(country), Congo_(Republic)
```

Cas ambigus importants :
- GE → `Georgia_(country)`
- CG → `Republic_of_the_Congo`
- CD → `Democratic_Republic_of_the_Congo`
- GR → `Greece`
- MK → `North_Macedonia`

**Step 2: Réécrire countryPhoto.ts**

```typescript
// lib/utils/countryPhoto.ts

// Map code pays → URL Wikimedia (fetchée au runtime, mise en cache côté client)
// Fallback : Picsum avec seed fixe si Wikimedia échoue

const WIKI_NAME: Record<string, string> = {
  PT: 'Portugal', GE: 'Georgia_(country)', AL: 'Albania',
  RS: 'Serbia', BA: 'Bosnia_and_Herzegovina', MD: 'Moldova',
  MK: 'North_Macedonia', AM: 'Armenia', TR: 'Turkey', ME: 'Montenegro',
  XK: 'Kosovo', GR: 'Greece', HR: 'Croatia', HU: 'Hungary',
  MA: 'Morocco', TN: 'Tunisia', EG: 'Egypt', SN: 'Senegal',
  CI: 'Ivory_Coast', GH: 'Ghana', KE: 'Kenya', TZ: 'Tanzania',
  RW: 'Rwanda', ET: 'Ethiopia', ZA: 'South_Africa', MU: 'Mauritius',
  MG: 'Madagascar', CM: 'Cameroon', CG: 'Republic_of_the_Congo',
  CD: 'Democratic_Republic_of_the_Congo', NG: 'Nigeria', AO: 'Angola',
  TH: 'Thailand', VN: 'Vietnam', JP: 'Japan', ID: 'Indonesia',
  KG: 'Kyrgyzstan', UZ: 'Uzbekistan', KH: 'Cambodia', LK: 'Sri_Lanka',
  PH: 'Philippines', MY: 'Malaysia', SG: 'Singapore', MM: 'Myanmar',
  NP: 'Nepal', IN: 'India', KZ: 'Kazakhstan',
  MX: 'Mexico', CO: 'Colombia', PE: 'Peru', EC: 'Ecuador', BO: 'Bolivia',
  PY: 'Paraguay', UY: 'Uruguay', GT: 'Guatemala', CR: 'Costa_Rica',
  PA: 'Panama', CU: 'Cuba', DO: 'Dominican_Republic', BR: 'Brazil',
  AR: 'Argentina', CL: 'Chile', JO: 'Jordan', AE: 'United_Arab_Emirates',
  OM: 'Oman',
};

const PICSUM_FALLBACK: Record<string, number> = {
  PT: 1018, GE: 167, AL: 338, RS: 432, /* ... garder les seeds existants */
};

// Cache en mémoire côté client pour éviter les refetch
const _cache: Record<string, string> = {};

export async function fetchWikimediaPhoto(code: string): Promise<string> {
  if (_cache[code]) return _cache[code];
  const wikiName = WIKI_NAME[code];
  if (!wikiName) return getPicsumFallback(code, 800, 300);
  try {
    const res = await fetch(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${wikiName}`,
      { headers: { 'Api-User-Agent': 'CrisisTravel/1.0 (contact@crisis-travel.app)' } }
    );
    if (!res.ok) throw new Error('not ok');
    const data = await res.json();
    const url = data?.thumbnail?.source ?? data?.originalimage?.source;
    if (!url) throw new Error('no image');
    // Remplacer la taille dans l'URL Wikimedia (format: /320px- → /800px-)
    const resized = url.replace(/\/\d+px-/, '/800px-');
    _cache[code] = resized;
    return resized;
  } catch {
    return getPicsumFallback(code, 800, 300);
  }
}

function getPicsumFallback(code: string, w: number, h: number): string {
  const seed = PICSUM_FALLBACK[code] ?? 15;
  return `https://picsum.photos/seed/${seed}/${w}/${h}`;
}

// Version synchrone pour SSR (retourne Picsum, Wikimedia chargé côté client)
export function getCountryPhotoUrl(code: string, width = 800, height = 300): string {
  return getPicsumFallback(code, width, height);
}

export function getCountryPhotoUrlLarge(code: string): string {
  return getPicsumFallback(code, 1200, 500);
}
```

**Step 3: Créer un hook useCountryPhoto pour les composants client**

```typescript
// lib/utils/useCountryPhoto.ts
'use client';
import { useState, useEffect } from 'react';
import { fetchWikimediaPhoto, getCountryPhotoUrl } from './countryPhoto';

export function useCountryPhoto(code: string, fallbackWidth = 800, fallbackHeight = 300): string {
  const [url, setUrl] = useState(getCountryPhotoUrl(code, fallbackWidth, fallbackHeight));
  useEffect(() => {
    fetchWikimediaPhoto(code).then(setUrl);
  }, [code]);
  return url;
}
```

**Step 4: Mettre à jour CountryCard pour utiliser le hook**

Dans `components/crisis/CountryCard.tsx` :
```typescript
import { useCountryPhoto } from '@/lib/utils/useCountryPhoto';
// Remplacer :
// const photoUrl = getCountryPhotoUrl(score.countryCode);
// Par :
const photoUrl = useCountryPhoto(score.countryCode);
```

**Step 5: Mettre à jour ProposalCard dans SmartSearchHub**

Dans `components/crisis/SmartSearchHub.tsx`, dans `ProposalCard` :
```typescript
import { useCountryPhoto } from '@/lib/utils/useCountryPhoto';
// Remplacer :
// const photoUrl = getCountryPhotoUrl(score.countryCode, 800, 220);
// Par :
const photoUrl = useCountryPhoto(score.countryCode, 800, 220);
```

**Step 6: Page destination — photo Wikimedia côté server**

La page `/destination/[country]/page.tsx` est un Server Component. On ne peut pas utiliser le hook. On va faire un fetch direct dans `getData()` :

```typescript
// Dans getData(), après avoir calculé score et narrative :
let photoUrl = getCountryPhotoUrlLarge(code);
try {
  const wikiRes = await fetch(
    `https://en.wikipedia.org/api/rest_v1/page/summary/${WIKI_NAME[code] ?? code}`,
    { headers: { 'Api-User-Agent': 'CrisisTravel/1.0' }, next: { revalidate: 86400 } }
  );
  if (wikiRes.ok) {
    const wikiData = await wikiRes.json();
    const src = wikiData?.thumbnail?.source ?? wikiData?.originalimage?.source;
    if (src) photoUrl = src.replace(/\/\d+px-/, '/1200px-');
  }
} catch { /* garder fallback */ }
return { score, narrative, photoUrl };
```

Importer `WIKI_NAME` depuis `countryPhoto.ts` (l'exporter).

**Step 7: Vérifier le build**

```bash
npx tsc --noEmit
```

---

## Task 3 — CrisisScore Tooltip

**Objectif:** Un tooltip discret, disponible partout où le score est affiché. Au hover (desktop) ou tap (mobile), affiche : la formule, une barre de décomposition colorée, et une phrase d'explication simple.

**Files:**
- Create: `components/crisis/ScoreTooltip.tsx`
- Modify: `components/crisis/CountryCard.tsx` — wrapper du score total
- Modify: `components/crisis/CrisisScoreGauge.tsx` — wrapper de la gauge
- Modify: `app/destination/[country]/page.tsx` — wrapper des sous-scores

**Step 1: Créer ScoreTooltip.tsx**

```typescript
// components/crisis/ScoreTooltip.tsx
'use client';
import { useState, useRef, useEffect } from 'react';

interface ScoreTooltipProps {
  children: React.ReactNode;
  security?: number;
  geopolitical?: number;
  budget?: number;
  practicality?: number;
  total?: number;
}

const BARS = [
  { label: 'Sécurité',     key: 'security',     weight: 40, color: '#3ddc97' },
  { label: 'Géopolitique', key: 'geopolitical',  weight: 30, color: '#4a9eff' },
  { label: 'Budget',       key: 'budget',        weight: 20, color: '#ffb224' },
  { label: 'Praticité',    key: 'practicality',  weight: 10, color: '#c084fc' },
];

export function ScoreTooltip({ children, security, geopolitical, budget, practicality, total }: ScoreTooltipProps) {
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setVisible(false);
    }
    if (visible) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [visible]);

  const vals: Record<string, number | undefined> = { security, geopolitical, budget, practicality };

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      {/* Curseur "?" subtil */}
      <div style={{ cursor: 'help' }}>{children}</div>

      {visible && (
        <div style={{
          position: 'absolute', bottom: 'calc(100% + 8px)', left: '50%',
          transform: 'translateX(-50%)',
          background: '#11111c', border: '1px solid #2a2a3e',
          borderRadius: 10, padding: '12px 14px', width: 240, zIndex: 200,
          boxShadow: '0 8px 32px rgba(0,0,0,0.7)',
          pointerEvents: 'none',
        }}>
          {/* Flèche */}
          <div style={{
            position: 'absolute', bottom: -5, left: '50%', transform: 'translateX(-50%)',
            width: 10, height: 10, background: '#11111c',
            border: '1px solid #2a2a3e', borderTop: 'none', borderLeft: 'none',
            rotate: '45deg',
          }} />

          {/* Titre */}
          <div style={{
            fontFamily: 'var(--ct-mono, monospace)', fontSize: 9,
            letterSpacing: '0.18em', color: '#6b6b85', textTransform: 'uppercase',
            marginBottom: 10, paddingBottom: 8, borderBottom: '1px solid #1f1f30',
          }}>
            COMMENT EST CALCULÉ CE SCORE ?
          </div>

          {/* Barres */}
          {BARS.map((b) => {
            const v = vals[b.key];
            return (
              <div key={b.key} style={{ marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                  <span style={{ fontFamily: 'var(--ct-mono, monospace)', fontSize: 9, color: '#9898b0', letterSpacing: '0.08em' }}>
                    {b.label} <span style={{ color: '#6b6b85' }}>×{b.weight}%</span>
                  </span>
                  {v !== undefined && (
                    <span style={{ fontFamily: 'var(--ct-mono, monospace)', fontSize: 9, color: b.color, fontWeight: 700 }}>
                      {v}/100
                    </span>
                  )}
                </div>
                <div style={{ height: 3, background: '#1f1f30', borderRadius: 2 }}>
                  <div style={{
                    height: '100%', borderRadius: 2, background: b.color,
                    width: `${b.weight}%`, opacity: 0.6,
                  }} />
                </div>
              </div>
            );
          })}

          {/* Formule */}
          <div style={{
            marginTop: 10, paddingTop: 8, borderTop: '1px solid #1f1f30',
            fontFamily: 'var(--ct-mono, monospace)', fontSize: 8,
            color: '#6b6b85', letterSpacing: '0.06em', lineHeight: 1.5,
          }}>
            Plus le score est élevé, plus la destination est recommandée pour un voyageur français.
          </div>

          {total !== undefined && (
            <div style={{
              marginTop: 6,
              fontFamily: 'var(--ct-mono, monospace)', fontSize: 10,
              color: '#f0f0f5', fontWeight: 700, letterSpacing: '0.04em',
              textAlign: 'center',
            }}>
              SCORE FINAL : {total}/100
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

**Step 2: Wrapper le score total dans CountryCard**

Dans `components/crisis/CountryCard.tsx`, entourer le badge score (top-left dans la photo hero) avec `<ScoreTooltip>` :

```typescript
import { ScoreTooltip } from './ScoreTooltip';

// Remplacer le badge score existant :
<ScoreTooltip
  security={score.security.value}
  geopolitical={score.geopolitical.value}
  budget={score.budget.value}
  practicality={score.practicality.value}
  total={score.total}
>
  <div style={{ background: totalColor, color: '#07070c', padding: '4px 7px', borderRadius: 4, ... }}>
    {score.total}/100
  </div>
</ScoreTooltip>
```

**Step 3: Wrapper la gauge sur la page destination**

Dans `app/destination/[country]/page.tsx`, la CrisisScoreGauge est un Server Component mais ScoreTooltip est client. Créer un wrapper client minimal :

```typescript
// components/crisis/GaugeWithTooltip.tsx
'use client';
import { ScoreTooltip } from './ScoreTooltip';
import { CrisisScoreGauge } from './CrisisScoreGauge';
import type { CrisisScore } from '@/types/crisis.types';

export function GaugeWithTooltip({ score }: { score: CrisisScore }) {
  return (
    <ScoreTooltip
      security={score.security.value}
      geopolitical={score.geopolitical.value}
      budget={score.budget.value}
      practicality={score.practicality.value}
      total={score.total}
    >
      <CrisisScoreGauge score={score.total} size="lg" showLabel={false} animate />
    </ScoreTooltip>
  );
}
```

Puis dans la page destination, remplacer `<CrisisScoreGauge .../>` par `<GaugeWithTooltip score={score} />`.

**Step 4: Build check**

```bash
npx tsc --noEmit
```

---

## Task 4 — CountrySearchBar enrichi

**Objectif:** Chaque résultat dans le dropdown affiche : photo Wikimedia (40×40, ronde) + nom pays + continent + badge statut (IDÉALE/RECOMMANDÉE/POSSIBLE/DÉCONSEILLÉE) basé sur STATIC_HINTS. Zéro appel API supplémentaire — la photo se charge async.

**Files:**
- Modify: `components/crisis/CountrySearchBar.tsx`

**Step 1: Importer STATIC_HINTS et useCountryPhoto, ajouter statut**

Les STATIC_HINTS sont dans `SmartSearchHub.tsx`. Les déplacer dans un fichier partagé :

```typescript
// lib/utils/staticHints.ts
export const STATIC_HINTS: Record<string, { score: number; security: number; budget: number }> = {
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

export function getHint(code: string) {
  return STATIC_HINTS[code] ?? { score: 55, security: 55, budget: 55 };
}

export function hintToStatus(score: number): { label: string; color: string } {
  if (score >= 70) return { label: 'IDÉALE',       color: '#3ddc97' };
  if (score >= 58) return { label: 'RECOMMANDÉE',  color: '#ffb224' };
  if (score >= 45) return { label: 'POSSIBLE',     color: '#ff8c42' };
  return              { label: 'DÉCONSEILLÉE', color: '#ff3b2f' };
}
```

**Step 2: Créer CountryResultItem — sous-composant avec photo async**

Dans `CountrySearchBar.tsx`, ajouter un sous-composant qui charge la photo Wikimedia :

```typescript
function CountryResultItem({
  country, focused, onClick, onHover
}: {
  country: Country;
  focused: boolean;
  onClick: () => void;
  onHover: () => void;
}) {
  const photoUrl = useCountryPhoto(country.code, 80, 80);
  const hint = getHint(country.code);
  const status = hintToStatus(hint.score);

  return (
    <button
      onClick={onClick}
      onMouseEnter={onHover}
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        width: '100%', padding: '10px 14px',
        background: focused ? 'rgba(255,77,46,0.08)' : 'transparent',
        border: 'none', borderBottom: '1px solid #1e1e2e',
        cursor: 'pointer', textAlign: 'left', transition: 'background 0.1s',
      }}
    >
      {/* Photo ronde */}
      <img
        src={photoUrl}
        alt={country.name}
        style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: '1px solid #2a2a3e' }}
      />

      {/* Infos */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '0.88rem', color: focused ? '#fff' : '#e8e8e8', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {country.name}
        </div>
        <div style={{ fontFamily: 'var(--font-space-mono)', fontSize: '0.58rem', color: '#6b7280', letterSpacing: '0.06em', marginTop: 2 }}>
          {continentLabel[country.continent] ?? country.continent}
        </div>
      </div>

      {/* Badge statut */}
      <div style={{
        fontFamily: 'var(--font-space-mono)', fontSize: '0.55rem',
        letterSpacing: '0.08em', fontWeight: 700,
        color: status.color, background: `${status.color}18`,
        border: `1px solid ${status.color}40`,
        padding: '2px 6px', borderRadius: 4, flexShrink: 0,
      }}>
        {status.label}
      </div>
    </button>
  );
}
```

**Step 3: Utiliser CountryResultItem dans le dropdown**

Remplacer le bloc `{results.map(...)}` par :
```typescript
{results.map((country, i) => (
  <CountryResultItem
    key={country.code}
    country={country}
    focused={focused === i}
    onClick={() => navigate(country)}
    onHover={() => setFocused(i)}
  />
))}
```

**Step 4: Mettre à jour les imports dans SmartSearchHub**

```typescript
// Remplacer getHint défini localement par :
import { getHint } from '@/lib/utils/staticHints';
// Et supprimer STATIC_HINTS du fichier
```

**Step 5: Build check**

```bash
npx tsc --noEmit
```

---

## Task 5 — Dates transmises à l'API

**Objectif:** Les dates `dateDepart` / `dateRetour` saisies dans le SmartSearchHub sont transmises à `/api/analyze` et affichées dans le header des résultats.

**Files:**
- Modify: `components/crisis/SmartSearchHub.tsx` — passer dates dans URL pour /results et dans body pour /api/analyze
- Modify: `app/api/analyze/route.ts` — accepter departureDate et returnDate dans le schéma Zod
- Modify: `app/results/ResultsContent.tsx` — lire et afficher les dates

**Step 1: Modifier le schéma Zod dans route.ts**

```typescript
const Schema = z.object({
  profile: z.object({
    // ... champs existants ...
    departureDate: z.string().optional(),
    returnDate: z.string().optional(),
  }),
});
```

**Step 2: Passer les dates dans handleRegionAnalyze et DiscoveryTab**

Dans `SmartSearchHub.tsx`, l'aéroport et les dates sont dans le composant parent. Les dates sont actuellement des états locaux `dateDepart` / `dateRetour`.

Dans `handleRegionAnalyze` (tab région), ajouter aux params URL :
```typescript
router.push(`/results?continent=${continent}&mode=${sortMode}&budget=1500&duration=7&travelType=solo&airport=${airport}&from=${dateDepart}&to=${dateRetour}`);
```

Dans `DiscoveryTab.handleGenerate`, ajouter au body :
```typescript
body: JSON.stringify({ profile: {
  // ... existant ...
  departureDate: dateDepart || undefined,
  returnDate: dateRetour || undefined,
}})
```

Mais `dateDepart` / `dateRetour` sont dans le composant parent `SmartSearchHub`. Il faut les passer en props à `DiscoveryTab` et `RegionTab`.

**Step 3: Modifier les props de DiscoveryTab et RegionTab**

```typescript
function DiscoveryTab({ airport, dateDepart, dateRetour }: {
  airport: string;
  dateDepart: string;
  dateRetour: string;
}) { ... }

function RegionTab({ onAnalyze, airport }: { ... }) { ... }
// RegionTab reçoit les dates via onAnalyze callback
```

Mise à jour de l'appel dans SmartSearchHub :
```typescript
{tab === 'discovery' && <DiscoveryTab airport={airport} dateDepart={dateDepart} dateRetour={dateRetour} />}
```

**Step 4: Afficher les dates dans ResultsContent.tsx**

```typescript
const dateFrom = params.get('from') ?? '';
const dateTo = params.get('to') ?? '';

// Dans le sous-titre de la page :
const dateLabel = dateFrom
  ? ` · Du ${new Date(dateFrom).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })} au ${dateTo ? new Date(dateTo).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }) : '?'}`
  : '';
```

Afficher `dateLabel` dans le `pageSubtitle`.

**Step 5: Build check**

```bash
npx tsc --noEmit
```

---

## Task 6 — Performance /results

**Objectif:** Réduire le temps de réponse de `/api/analyze`. Timeout Perplexity à 8s (au lieu de 15s). Batch réduit à 6. Si Perplexity timeout → fallback immédiat (score WorldBank seul).

**Files:**
- Modify: `lib/services/geopolitical/perplexity.service.ts` — timeout 8000
- Modify: `app/api/analyze/route.ts` — BATCH = 6 (au lieu de 8)
- Modify: `lib/services/scoring/crisisScore.service.ts` — Promise.race avec timeout sur Perplexity

**Step 1: Réduire timeout Perplexity à 8s**

Dans `perplexity.service.ts` :
```typescript
timeout: 8000,  // ← était 15000
```

**Step 2: Réduire batch à 6 dans route.ts**

```typescript
const BATCH = profile.continent ? countries.length : 6;  // ← était 8
```

**Step 3: Ajouter un timeout de sécurité sur calcGeopolitical**

Dans `crisisScore.service.ts`, créer un helper :
```typescript
function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}

// Dans calcGeopolitical :
async function calcGeopolitical(c: CountryInfo): Promise<SubScore> {
  const PERP_FALLBACK = { data: { stabilityScore: 50, summary: '', mainRisks: [], recentEvents: [], trend: 'stable' as const }, source: 'fallback' as const };
  const [r_perp, r_wb] = await Promise.allSettled([
    withTimeout(getPerplexityGeoScore(c.code, c.name), 9000, PERP_FALLBACK),
    getWorldBankScore(c.code, c.iso3),
  ]);
  // ... reste identique
}
```

**Step 4: Nettoyer le double NEXT_PUBLIC_APP_URL dans .env.local**

Ouvrir `.env.local` et supprimer les lignes 90-92 (les doublons en fin de fichier).

**Step 5: Build final complet**

```bash
npx tsc --noEmit
npx next build 2>&1 | tail -20
```

Expected: build réussi, 0 erreurs TypeScript.

---

## Ordre d'exécution recommandé

1. Task 1 (WorldBank) — 5 min, impact immédiat sur les scores
2. Task 2 (Photos Wikimedia) — 15 min, impact visuel majeur
3. Task 3 (Tooltip) — 10 min, UX/compréhension
4. Task 4 (SearchBar) — 10 min, UX recherche
5. Task 5 (Dates) — 8 min, feature complète
6. Task 6 (Performance) — 5 min, robustesse

**Total estimé : ~55 minutes**
