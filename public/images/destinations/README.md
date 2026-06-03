# Curated destination photography

Drop curated, license-clear local photos here. The imagery contract in
`lib/design/destinationImagery.ts` resolves each destination to:

```
/images/destinations/<slug>/hero.jpg   (16:9, full-bleed hero)
/images/destinations/<slug>/card.jpg   (smaller, list/grid card)
```

`<slug>` is the country's `meaeSlug` from `lib/utils/countries.ts`
(e.g. `georgie`, `albanie`, `maroc`, `portugal`, …).

## Rules

- **Local files only.** No `source.unsplash.com`, no hotlinking, no
  unstable external photo services in production.
- License must be clear (your own, properly-licensed stock, or
  attribution-compatible). Keep proof of license alongside the asset set.
- If a photo is missing, `DestinationImage` renders a premium duotone
  fallback automatically — **no broken images, no blank slots**. Adding the
  real photo later requires no code change: just drop the file at the path
  above.

## Recommended specs

- `hero.jpg`: ~1600×900, optimized JPEG (<300 KB), subject framed so the
  bottom third stays usable under the legibility scrim.
- `card.jpg`: ~800×500, optimized JPEG (<120 KB).
