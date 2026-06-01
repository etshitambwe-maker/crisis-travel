# GOAL-018 — Destination Visual Experience

**Date:** 2026-06-01  
**Status:** Approved — ready for implementation  
**Scope:** CountryCard.tsx + globals.css only

---

## Goal

Transform CountryCard from a flag-on-gradient card into a destination photo card that creates immediate travel desire, while preserving full analytical readability across all viewports (320px → desktop).

---

## Problem

The primary emotional gap in Crisis Travel is at the CountryCard level. Results page visitors see a flag centered on a color-gradient background (120px tall). This communicates data but creates zero travel projection. The infrastructure for real destination photos already exists (`/api/photo/[code]`) but is never called client-side.

---

## Architecture

### Image source

Reuse existing `/api/photo/[code]` route (no new API, no new dependency):
- Returns Wikipedia thumbnail if available (real destination photo)
- Falls back to `picsum.photos/seed/{N}/800/450` (deterministic, coherent per country)
- 50+ country seeds already defined in `app/api/photo/[code]/route.ts`

### Client fetch pattern

Local `useEffect` inside `CountryCard` only:

```ts
const [photoUrl, setPhotoUrl] = useState<string | null>(null);
useEffect(() => {
  fetch(`/api/photo/${score.countryCode}`)
    .then(r => r.json())
    .then(d => setPhotoUrl(d.url ?? null))
    .catch(() => {});
}, [score.countryCode]);
```

Fallback while loading or on error: existing color gradient — no flash, no layout shift, card always clean.

---

## CountryCard redesign

### Hero zone

| Property | Before | After |
|----------|--------|-------|
| Height | 120px | 200px |
| Background | `linear-gradient(colors)` | `background-image: url(photo)` + `background-size: cover` |
| Overlay | None | `rgba(0,0,0,0.30)` uniform + bottom gradient `rgba(7,7,12,0.88)` over 80px |
| Fallback | gradient + centered flag | gradient + centered flag (identical — no regression) |

### Flag repositioning

| Property | Before | After |
|----------|--------|-------|
| Position | Centered, 64px tall | Bottom-left badge, 36px tall |
| Style | `objectFit: contain` alone | `drop-shadow` + rounded corners |
| Purpose | Main visual | Country identifier badge |

### Visual hierarchy (reading order after change)

1. Destination photo (emotion, projection)
2. Country name 18px bold + flag badge (identification)
3. Score badge top-right (quick rating)
4. 4 sub-score chips (analytical detail)
5. Meta row FX + status + implicit CTA

### Score chips — readability fix

| Property | Before | After |
|----------|--------|-------|
| Label fontSize | 8px | 10px |
| Value fontSize | 13px | 15px |
| Padding | 7px 6px | 9px 6px |
| Grid below 360px | 4×1 (overflow risk) | 2×2 via `ct-score-chips` class |

### ScoreTooltip — touch support

Add `onTouchStart` toggle on the wrapping element inside CountryCard. Show tooltip on tap, auto-dismiss after 2.5s or on outside tap. Desktop hover unchanged.

---

## Files changed

| File | Change |
|------|--------|
| `components/crisis/CountryCard.tsx` | Hero 200px, photo BG, overlay, flag badge, chip fix, touch tooltip |
| `app/globals.css` | `.ct-score-chips` 2×2 grid breakpoint at 360px |

**Not touched:** ResultsContent, page.tsx, any API route, any business logic, Stripe, Supabase, scoring engine.

---

## Mobile-first constraints

Explicit render checks required at:
- **320px** — no overflow, chips readable, name not clipped
- **375px** — photo visible, hero proportions correct
- **430px** — full layout, all elements accessible

Priority rule: **readability > visual impact**. If photo + overlay reduces text legibility, increase overlay opacity rather than reduce font size.

---

## Acceptance criteria

1. CountryCard shows a real destination photo (or coherent Picsum fallback) as hero background
2. If photo fetch fails, card renders identically to current state (gradient + centered flag)
3. Flag visible as bottom-left badge overlaying the photo
4. Score badge (top-right) remains fully legible over any photo
5. Sub-score chips: label ≥ 10px, value ≥ 15px, no overflow at 320px
6. ScoreTooltip responds to tap on mobile
7. `npx tsc --noEmit` exits 0
8. `npx vitest run` 31/31

---

## Out of scope

- OpportunityCards visual enrichment
- Results Hero visual redesign
- Home stats dynamic data
- Minor cosmetic cleanup outside CountryCard
- Any new API, dependency, route, or page
