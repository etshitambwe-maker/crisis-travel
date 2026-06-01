# GOAL-018 Destination Visual Experience — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enrich CountryCard with real destination photos (via existing `/api/photo/[code]`), fix chip readability on narrow screens, and add touch support to ScoreTooltip — all without touching any business logic, routes, or layout outside CountryCard.

**Architecture:** `CountryCard` fetches `/api/photo/{code}` client-side on mount; result used as `background-image` in the 200px hero zone with a two-layer overlay (uniform dark + bottom gradient) for text legibility. Color-gradient fallback is always pre-rendered so there is never a flash. ScoreTooltip gains `onTouchStart` toggle. Chip font sizes increase, with a CSS 2×2 grid below 360px.

**Tech Stack:** Next.js 14 App Router, React 18 hooks (`useState`, `useEffect`), TypeScript strict, CSS-in-JS inline styles + globals.css utility classes, existing `/api/photo/[code]` route (Picsum + Wikipedia).

**Design doc:** `docs/plans/2026-06-01-goal-018-destination-visual-experience.md`

---

## Task 1: Add touch support to ScoreTooltip

**Files:**
- Modify: `components/crisis/ScoreTooltip.tsx`

**Context:** `ScoreTooltip` currently only responds to `onMouseEnter`/`onMouseLeave`. On mobile, hover events don't fire. The fix is a tap-toggle: `onTouchStart` toggles `visible`, a 2.5s auto-dismiss timer resets it, and the existing `handleClickOutside` already handles tapping outside (it listens to `mousedown` — we add `touchstart` too).

**Step 1: Add touch toggle handler**

Replace the `onMouseEnter`/`onMouseLeave` block and the `handleClickOutside` effect in `ScoreTooltip.tsx`:

```tsx
// Add timerRef alongside the existing ref:
const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

// Replace the existing useEffect:
useEffect(() => {
  function handleOutside(e: MouseEvent | TouchEvent) {
    if (ref.current && !ref.current.contains(e.target as Node)) setVisible(false);
  }
  if (visible) {
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('touchstart', handleOutside);
  }
  return () => {
    document.removeEventListener('mousedown', handleOutside);
    document.removeEventListener('touchstart', handleOutside);
  };
}, [visible]);

// Add a cleanup effect for the timer:
useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);
```

Replace the wrapper `<div>` props:
```tsx
<div
  ref={ref}
  style={{ position: 'relative', display: 'inline-block' }}
  onMouseEnter={() => setVisible(true)}
  onMouseLeave={() => setVisible(false)}
  onTouchStart={(e) => {
    e.preventDefault(); // prevent ghost click
    if (timerRef.current) clearTimeout(timerRef.current);
    setVisible((v) => {
      if (!v) timerRef.current = setTimeout(() => setVisible(false), 2500);
      return !v;
    });
  }}
>
```

**Step 2: Run type-check**

```bash
cd "c:\Users\asus\Desktop\01_PROJETS_ACTIFS\appli voyage\crisis-travel"
npx tsc --noEmit
```

Expected: no errors.

**Step 3: Run tests**

```bash
npx vitest run
```

Expected: 31/31.

**Step 4: Commit**

```bash
git add components/crisis/ScoreTooltip.tsx
git commit -m "feat: add touch support to ScoreTooltip (tap-toggle, 2.5s auto-dismiss)"
```

---

## Task 2: Add `ct-score-chips` responsive class to globals.css

**Files:**
- Modify: `app/globals.css`

**Context:** The 4-column chip grid in CountryCard uses `fontSize: 8` for labels — illegible at 320px. We increase font sizes inline (Task 3), and add a CSS breakpoint to switch the grid to 2×2 below 360px so chips have room to breathe.

**Step 1: Add breakpoint in the existing `@media (max-width: 375px)` block**

Locate the `/* ── Responsive utilities ────────────────────────── */` section at the bottom of `globals.css`. Add inside the existing `@media (max-width: 375px)` block:

```css
  /* CountryCard score chips: 4-col → 2×2 below 360px */
  .ct-score-chips { grid-template-columns: repeat(2, 1fr) !important; }
```

Also add a dedicated 360px breakpoint after the existing blocks:

```css
@media (max-width: 360px) {
  .ct-score-chips { grid-template-columns: repeat(2, 1fr) !important; }
}
```

**Step 2: Run type-check + tests** (CSS change, no TS impact expected)

```bash
npx tsc --noEmit && npx vitest run
```

Expected: 0 errors, 31/31.

**Step 3: Commit**

```bash
git add app/globals.css
git commit -m "style: ct-score-chips 2x2 grid below 360px"
```

---

## Task 3: Rewrite CountryCard with photo hero

**Files:**
- Modify: `components/crisis/CountryCard.tsx`

**Context:** This is the main task. Three changes in one component:
1. `useState<string | null>(null)` for `photoUrl` + `useEffect` fetch
2. Hero zone: 120px → 200px, `background-image` from `photoUrl`, two-layer overlay, flag repositioned to bottom-left badge
3. Chip grid: font sizes increased, `className="ct-score-chips"` added

**Step 1: Add photo state and fetch**

At the top of the `CountryCard` function body (after existing variable declarations), add:

```tsx
const [photoUrl, setPhotoUrl] = useState<string | null>(null);

useEffect(() => {
  fetch(`/api/photo/${score.countryCode}`)
    .then((r) => r.json())
    .then((d: { url?: string }) => { if (d.url) setPhotoUrl(d.url); })
    .catch(() => {});
}, [score.countryCode]);
```

Also add `useState` and `useEffect` to the import from `'react'` at the top of the file:
```tsx
import { useState, useEffect } from 'react';
```

**Step 2: Replace the hero zone**

Replace the entire `{/* Hero : fond couleurs du pays + drapeau centré */}` div (lines 57–109 in current file) with:

```tsx
{/* Hero : photo destination + overlay lisibilité */}
<div style={{
  position: 'relative', width: '100%', height: 200,
  overflow: 'hidden', borderRadius: '14px 14px 0 0',
  // Photo as background when loaded, color gradient as instant placeholder
  background: photoUrl
    ? `url(${photoUrl}) center/cover no-repeat, linear-gradient(135deg, ${color1}55 0%, ${color2}33 100%), #0d0d18`
    : `linear-gradient(135deg, ${color1}55 0%, ${color2}33 100%), #0d0d18`,
}}>
  {/* Uniform dark overlay — improves legibility over any photo */}
  <div style={{
    position: 'absolute', inset: 0,
    background: photoUrl ? 'rgba(0,0,0,0.30)' : 'transparent',
    transition: 'background 0.4s ease',
  }} />

  {/* Bottom gradient — ensures name + flag readable regardless of photo */}
  <div style={{
    position: 'absolute', bottom: 0, left: 0, right: 0, height: 90,
    background: 'linear-gradient(0deg, rgba(7,7,12,0.92) 0%, rgba(7,7,12,0.4) 60%, transparent 100%)',
  }} />

  {/* Score badge — top right, unchanged */}
  <div style={{ position: 'absolute', top: 10, right: 10, zIndex: 2 }}>
    <ScoreTooltip
      security={score.security.value}
      geopolitical={score.geopolitical.value}
      budget={score.budget.value}
      practicality={score.practicality.value}
      total={score.total}
    >
      <div style={{
        background: totalColor, color: '#07070c',
        padding: '4px 8px', borderRadius: 4,
        fontFamily: 'var(--ct-mono, var(--font-space-mono), monospace)',
        fontSize: 9, letterSpacing: '0.12em', fontWeight: 700,
      }}>
        {score.total}/100
      </div>
    </ScoreTooltip>
  </div>

  {/* Bottom row: flag badge (left) + country name (right of flag) + code (far right) */}
  <div style={{
    position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 2,
    padding: '0 12px 10px',
    display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 8,
  }}>
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, minWidth: 0 }}>
      {/* Flag badge */}
      <img
        src={flagUrl}
        alt=""
        aria-hidden="true"
        style={{
          height: 24, width: 'auto', maxWidth: 36,
          objectFit: 'contain', flexShrink: 0,
          filter: 'drop-shadow(0 1px 4px rgba(0,0,0,0.7))',
          borderRadius: 2,
        }}
      />
      {/* Country name */}
      <div style={{
        fontSize: 18, fontWeight: 700, color: '#fff',
        letterSpacing: '-0.01em', lineHeight: 1,
        textShadow: '0 1px 4px rgba(0,0,0,0.8)',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {score.country}
      </div>
    </div>
    {/* ISO code */}
    <div style={{
      fontFamily: 'var(--ct-mono, var(--font-space-mono), monospace)',
      fontSize: 9, letterSpacing: '0.14em', color: 'rgba(255,255,255,0.5)',
      flexShrink: 0,
    }}>
      {score.countryCode}
    </div>
  </div>
</div>
```

**Step 3: Fix chip grid font sizes and add className**

In the chip grid div, change:
- `display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6` → add `className="ct-score-chips"`
- Inside each chip `<div>`, change label `fontSize: 8` → `fontSize: 10`
- Inside each chip `<div>`, change value `fontSize: 13` → `fontSize: 15`
- Chip padding `7px 6px` → `9px 6px`

Full chip grid replacement:

```tsx
{/* Score chips */}
<div className="ct-score-chips" style={{
  display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginBottom: 12,
}}>
  {[
    { lbl: 'SÉC',  val: score.security.value },
    { lbl: 'GEO',  val: score.geopolitical.value },
    { lbl: 'BUD',  val: score.budget.value },
    { lbl: 'PRAT', val: score.practicality.value },
  ].map((chip) => (
    <div key={chip.lbl} style={{
      padding: '9px 6px', background: 'rgba(10,10,18,0.6)',
      border: '1px solid #1f1f30', borderRadius: 6, textAlign: 'center',
    }}>
      <div style={{
        fontFamily: 'var(--ct-mono, var(--font-space-mono), monospace)',
        fontSize: 10, letterSpacing: '0.12em', color: '#6b6b85',
        textTransform: 'uppercase', marginBottom: 2,
      }}>
        {chip.lbl}
      </div>
      <div className={scoreChipClass(chip.val)} style={{
        fontFamily: 'var(--ct-mono, var(--font-space-mono), monospace)',
        fontSize: 15, fontWeight: 700, letterSpacing: '-0.02em',
      }}>
        {chip.val}
      </div>
    </div>
  ))}
</div>
```

**Step 4: Run type-check**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

**Step 5: Run tests**

```bash
npx vitest run
```

Expected: 31/31.

**Step 6: Commit**

```bash
git add components/crisis/CountryCard.tsx
git commit -m "feat: CountryCard photo hero 200px, flag badge, chip readability fix"
```

---

## Task 4: Full build + push

**Step 1: Next.js production build**

```bash
npx next build
```

Expected: `✓ Compiled successfully`, 0 errors. Pre-existing warnings about `@react-pdf/renderer` and Stripe `config` export are acceptable (existed before this GOAL).

**Step 2: Push to GitHub → trigger Vercel**

```bash
git push origin main
```

**Step 3: Smoke-check on production**

Navigate to `https://www.crisistravel.fr/results?mode=standard&budget=1500&duration=7&travelType=solo` and confirm:
- CountryCards show destination photos (or coherent Picsum fallback)
- Score badge visible top-right over photo
- Country name + flag badge readable at bottom of hero
- Chips readable

---

## Acceptance checklist

- [ ] `npx tsc --noEmit` → exit 0
- [ ] `npx vitest run` → 31/31
- [ ] `npx next build` → compiled successfully
- [ ] CountryCard hero shows photo (or gradient fallback if photo unavailable)
- [ ] Card renders cleanly if `/api/photo` fetch fails (gradient + centered flag)
- [ ] Flag visible as bottom-left badge
- [ ] Score badge legible top-right over any photo
- [ ] Chip labels ≥ 10px, values ≥ 15px
- [ ] No overflow at 320px
- [ ] ScoreTooltip responds to tap on mobile (tap-toggle, 2.5s dismiss)

---

## Mobile check points

After Task 3, mentally (or in DevTools) verify at each breakpoint:

| Viewport | Check |
|----------|-------|
| 320px | Hero renders, name not clipped, chips 2×2, no horizontal scroll |
| 375px | Photo visible, overlay readable, all text accessible |
| 430px | Full layout, badges proportionate, flag badge not oversized |
| Desktop | 4-col chips, full hero, hover tooltip works |
