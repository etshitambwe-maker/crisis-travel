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

## Photo availability (opt-in)

A destination is only treated as having a curated local photo once its ISO-2
code is listed in `DESTINATION_PHOTO_AVAILABILITY` in
`lib/design/destinationImagery.ts`. That set is **empty today**, so every
destination renders the duotone fallback. The flow to add a batch:

1. Drop the real `hero` / `card` files at the path above.
2. Add the country's ISO-2 code to `DESTINATION_PHOTO_AVAILABILITY`.
3. `hasDestinationPhoto(code)` then returns `true` centrally — no per-page edit.

This is independent from the results page, which pulls a remote photo via
`/api/photo/<code>` and is not governed by this set.

## Future WebP migration

The file extension lives in a single constant, `DESTINATION_PHOTO_EXT`
(currently `'jpg'`), used by both `heroImagePath` / `cardImagePath`. When the
curated assets are re-authored as WebP, flip that one constant to `'webp'`
**after** the `.webp` files exist on disk — every registry path follows in
lockstep, so the registry and the assets never drift apart.
