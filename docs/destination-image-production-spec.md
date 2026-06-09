# Destination Image Production Specification — 65 destinations

> FRONT-024B — specification only. No image is generated, converted, integrated
> or registered by this document. It is the brief that later phases
> (024C / 024D / 024E) and any image-generation tool (Anti-Gravity, Gemini,
> or a human photographer/editor) will follow.

Source of truth for the destination list: `lib/utils/countries.ts`
(`TARGET_COUNTRIES`). Every `code`, `name`, `meaeSlug` and `continent` in the
manifest below was extracted from that file — nothing is invented. The catalogue
is **65 destinations** (not the 18 scored per analysis request; see CANDIDATE_CAP
in `lib/utils/selectCandidates.ts`).

---

## 1. Purpose

Crisis Travel is a decision-aid product, not a travel blog. Today every
destination slot renders a premium duotone fallback (flag-derived gradient); no
real photography exists yet. The 65 destination images give each country a
calm, recognizable, editorial visual identity that:

- helps a user recognize and trust a destination at a glance;
- reinforces the serious, analytical positioning (context, not catastrophe);
- coexists with the dark ctv3 UI and the existing duotone fallback without a
  visual rupture.

Images carry **place and atmosphere**. The crisis-aware dimension is carried by
the **score and data**, never by anxiety-inducing imagery. Photography must make
the product feel credible and premium — never sensationalist, never a generic
stock travel feed.

---

## 2. Visual art direction

Target feel: **premium editorial travel photography**, realistic, calm, analytical.

Do:

- realistic landscapes, cityscapes, recognizable local context (architecture,
  coastline, relief, urban texture);
- natural, plausible light (golden hour, soft overcast, blue hour) — no heavy
  HDR, no oversaturation;
- restrained, coherent color grading that sits well next to the ctv3 palette
  and reads under a dark overlay;
- composition that leaves the **bottom third usable** (text/scrim safe area);
- a documentary, grounded tone — a place a thoughtful traveller would assess.

Do not:

- war, riots, disaster scenes, ruins-as-subject, poverty porn, suffering,
  propaganda, fear-based or sensational imagery;
- generic stock-photo travel-blog aesthetic (identical sunsets, empty beaches,
  cocktail-by-the-pool clichés);
- exaggerated national stereotypes or caricature;
- embedded text, captions, logos, watermarks;
- a flag inside the photo (flags are a separate system, `CountryFlag`);
- an identifiable individual as the main subject (incidental, non-identifiable
  crowds or silhouettes in context are acceptable);
- a political symbol as the primary subject.

Compatibility constraints (from the live UI):

- images sit under `SCRIMS` (soft/strong bottom gradients) in
  `components/design/DestinationImage.tsx` — keep the lower third low-contrast;
- the fallback duotone uses flag-derived colors; favour images whose dominant
  hue is not wildly off from the country identity so photo-to-fallback transitions
  stay coherent.

---

## 3. Image types

Each destination produces a **pair**:

- **hero** — wide, immersive establishing shot. Used on the destination detail
  page hero and large home surfaces. Full-bleed, generous sky/landscape, strong
  sense of place.
- **card** — tighter, readable thumbnail composition for list/grid cards
  (results, home rails). Single clear focal subject that survives at small size.

The hero and card of a destination must be visually coherent (same place, same
grade) but not identical crops — the card is a tighter, more legible read.

---

## 4. Technical specifications

| Variant | Dimensions | Aspect | Target size | Format (future) |
|---|---|---|---|---|
| hero | 1600 x 900 | 16:9 | < 300 KB | WebP (see note) |
| card | 800 x 500 | 16:10 | < 120 KB | WebP (see note) |

Rules:

- **safe area**: keep the bottom third free of critical subject (scrim/text);
- **no embedded text, no logo, no watermark, no flag in the image**;
- **no identifiable person** as main subject; political symbols never the subject;
- consistent grade across the set; avoid extreme contrast that breaks under the
  dark overlay;
- keep a high-resolution **source/original** archived outside `public/` for
  re-export; ship only the optimized web variant.

> **Format note (do not act on it in 024B).** The current registry
> (`lib/design/destinationImagery.ts`) resolves `.jpg` paths
> (`/images/destinations/<slug>/{hero,card}.jpg`). FRONT-024A recommends
> **pre-generated WebP** as the future target. This spec therefore states the
> WebP target, but the registry change from `.jpg` to `.webp` is **out of scope
> here** and belongs to FRONT-024C/024D. Do not edit the registry in 024B.

---

## 5. Naming convention

The `meaeSlug` from `lib/utils/countries.ts` is the single source of truth for
the asset folder name.

Current registry path (today):

```
/public/images/destinations/<slug>/hero.jpg
/public/images/destinations/<slug>/card.jpg
```

Future target (recommended by 024A, applied later in 024C/024D):

```
/public/images/destinations/<slug>/hero.webp
/public/images/destinations/<slug>/card.webp
```

`<slug>` is exactly the `meaeSlug` column in the manifest below
(e.g. `portugal`, `bosnie-herzegovine`, `republique-democratique-du-congo`,
`cote-d-ivoire`). Never derive the folder from the display name — always from
the slug.

---

## 6. Slug manifest — 65 destinations

Extracted from `lib/utils/countries.ts`. Hero/card directions and anchors are
**descriptive only** (landscape, architecture, city, coastline, relief, travel
atmosphere). They are suggestions to guide generation, not facts to assert.
The "avoid" column lists clichés and sensational traps, in addition to the
global prohibitions in sections 2 and 4.

### Europe (14)

| Code | Name | meaeSlug | Hero direction | Card direction | Visual anchors | Avoid |
|---|---|---|---|---|---|---|
| PT | Portugal | portugal | Atlantic coastline, tiled old town under soft light | Tiled facade or coastal viewpoint | Lisbon hills, azulejo, Atlantic cliffs | Generic beach-resort cliché |
| GE | Géorgie | georgie | Caucasus valley with hillside town | Old town lane or mountain ridge | Caucasus relief, stone architecture, vineyards | Over-rustic stereotype |
| AL | Albanie | albanie | Adriatic/Ionian coast with mountains behind | Coastal cove or stone village | Riviera coastline, Ottoman-era towns | Empty-beach stock |
| RS | Serbie | serbie | River-city skyline at blue hour | Old quarter street | Danube/Sava confluence, urban texture | Drab grey-city cliché |
| BA | Bosnie | bosnie-herzegovine | River gorge town with stone bridge | Stone bridge or hillside roofs | River canyons, Ottoman bridges | Conflict/ruin imagery |
| MD | Moldavie | moldavie | Rolling vineyard country under wide sky | Vineyard rows or quiet town square | Wine country, gentle hills | Bleak post-Soviet trope |
| MK | Macédoine du Nord | macedoine-du-nord | Lake and mountains, lakeside town | Lakeside rooftops | Ohrid-type lake, hill towns | Generic alpine swap |
| AM | Arménie | armenie | Highland plateau with distant peak | Stone monastery or mountain road | Volcanic highlands, ancient stone | Religious symbol as subject |
| TR | Turquie | turquie | Coastal city or Anatolian landscape | Domed skyline or coastline | Bosphorus, Anatolian relief, bazaars | Touristic over-cliché |
| ME | Monténégro | montenegro | Fjord-like bay ringed by mountains | Bay viewpoint or old town wall | Kotor-type bay, dramatic relief | Yacht-luxury cliché |
| XK | Kosovo | kosovo | Green valley with small town | Old bazaar street | Valleys, mountain backdrop | Conflict association |
| GR | Grèce | grece | Aegean coastline, whitewashed hillside | Whitewashed lane or harbour | Aegean light, island architecture | Postcard-saturated cliché |
| HR | Croatie | croatie | Adriatic walled town from above | Harbour or stone street | Dalmatian coast, red rooftops | Crowded-tourism shot |
| HU | Hongrie | hongrie | River city with bridges at blue hour | Riverfront facade | Danube, grand architecture, baths | Party-city cliché |

### Africa (18)

| Code | Name | meaeSlug | Hero direction | Card direction | Visual anchors | Avoid |
|---|---|---|---|---|---|---|
| MA | Maroc | maroc | Medina rooftops with mountains beyond | Riad courtyard or souk lane | Atlas range, medinas, desert edge | Camel-cliché, poverty framing |
| TN | Tunisie | tunisie | Mediterranean white-and-blue village | Blue door or coastal terrace | Sidi-type villages, coastline | Desert-only cliché |
| EG | Égypte | egypte | Nile and desert plateau at golden hour | River felucca or stone detail | Nile, desert, ancient stone | Tourist-pyramid postcard only |
| SN | Sénégal | senegal | Atlantic coast with colourful low town | Coastal street or fishing boats | Dakar coast, baobab plains | Poverty porn |
| CI | Côte d'Ivoire | cote-d-ivoire | Lagoon city skyline, green coast | Cathedral skyline or lagoon | Abidjan lagoon, tropical coast | Stereotype framing |
| GH | Ghana | ghana | Atlantic coast with fort and palms | Coastal fort or market colour | Gulf-of-Guinea coast, forts | Poverty framing |
| KE | Kenya | kenya | Savannah plateau under wide sky | Acacia silhouette or highland town | Rift Valley, savannah, highlands | Safari-only cliché |
| TZ | Tanzanie | tanzanie | Highland plain with distant volcano | Coastal Swahili door or plain | Kilimanjaro relief, Swahili coast | Safari-only cliché |
| RW | Rwanda | rwanda | Green terraced hills under mist | Hill town or tea terraces | "Land of a thousand hills", terraces | Conflict association |
| ET | Éthiopie | ethiopie | Highland escarpment at golden hour | Rock-hewn detail or highland town | Simien-type relief, ancient stone | Famine/crisis trope |
| ZA | Afrique du Sud | afrique-du-sud | Coastal city beneath a flat-topped mountain | Coastline or vineyard valley | Table-type mountain, Cape coast, winelands | Township-poverty framing |
| MU | Maurice | maurice | Lagoon and volcanic peaks | Lagoon water or green interior | Turquoise lagoon, basalt peaks | Honeymoon-resort cliché |
| MG | Madagascar | madagascar | Avenue of tall endemic trees at dusk | Baobab silhouette or highland town | Baobabs, highland terraces, coast | Exotic-othering |
| CM | Cameroun | cameroun | Green volcanic highland and coast | Highland town or coastal palms | Mount-Cameroon relief, green coast | Stereotype framing |
| CG | Congo | congo-brazzaville | River and rainforest edge | Riverfront or forest canopy | Congo River, rainforest | Conflict association |
| CD | RD Congo | republique-democratique-du-congo | Vast river and forested hills | River barge or green hills | Congo River, rainforest, volcanoes | Conflict/poverty framing |
| NG | Nigeria | nigeria | Lagos-type lagoon skyline at dusk | Skyline or market colour | Coastal megacity, lagoon | Crime/poverty framing |
| AO | Angola | angola | Atlantic coast with modern skyline | Coastal promenade or cliffs | Luanda bay, Atlantic cliffs | Stereotype framing |

### Asia (15)

| Code | Name | meaeSlug | Hero direction | Card direction | Visual anchors | Avoid |
|---|---|---|---|---|---|---|
| TH | Thaïlande | thailande | Temple silhouette or coastal karst | Temple roofline or longtail bay | Temples, karst islands, river city | Party-island cliché |
| VN | Vietnam | vietnam | Limestone bay or terraced highlands | Old-town lane or rice terraces | Halong-type bay, rice terraces | Conical-hat cliché |
| JP | Japon | japon | Mountain-and-city or temple in season | Temple detail or neon street | Fuji-type peak, temples, cityscape | Over-neon cliché |
| ID | Indonésie | indonesie | Volcanic ridge or rice terraces | Terrace steps or temple gate | Volcanoes, rice terraces, coast | Resort-only cliché |
| KG | Kirghizistan | kirghizistan | Alpine lake ringed by peaks | Yurt-on-plateau or lake shore | Tien-Shan range, alpine lakes | Exotic-othering |
| UZ | Ouzbékistan | ouzbekistan | Tiled domes against desert sky | Tiled portal or madrasa facade | Silk Road domes, tilework | Over-saturated postcard |
| KH | Cambodge | cambodge | Temple complex at dawn through trees | Stone face or temple causeway | Angkor-type temples, river plains | Single-temple postcard only |
| LK | Sri Lanka | sri-lanka | Tea highlands or southern coast | Tea terraces or coastal train | Hill country, tea, coastline | Over-touristed cliché |
| PH | Philippines | philippines | Island seascape with limestone | Boat-and-cove or terraces | Archipelago seas, rice terraces | Empty-beach stock |
| MY | Malaisie | malaisie | Skyline against rainforest or coast | Tower skyline or old shophouses | Twin-tower skyline, rainforest, coast | Mall-tourism cliché |
| SG | Singapour | singapour | Bay skyline at blue hour | Skyline or garden architecture | Marina-bay skyline, green architecture | Generic skyscraper stock |
| MM | Myanmar | myanmar | Plain of stupas at dawn mist | Stupa silhouette or river | Bagan-type plain, river life | Conflict association |
| NP | Népal | nepal | Himalayan range above foothill town | Prayer-stupa detail or peaks | Himalaya, hill towns, terraces | Trekker-cliché |
| IN | Inde | inde | Monumental architecture or hill country | Architectural detail or street colour | Monuments, varied relief, cities | Crowd/poverty framing |
| KZ | Kazakhstan | kazakhstan | Steppe under wide sky or modern skyline | Steppe horizon or skyline | Steppe, mountains, modern capital | Empty-steppe-only cliché |

### Americas (15)

| Code | Name | meaeSlug | Hero direction | Card direction | Visual anchors | Avoid |
|---|---|---|---|---|---|---|
| MX | Mexique | mexique | Colonial town or coastal cliffs | Colourful facade or coastline | Colonial centres, cenotes, coast | Cartel/crime framing |
| CO | Colombie | colombie | Andean city or Caribbean old town | Colourful old-town wall | Andes, colonial coast, coffee hills | Crime/drug framing |
| PE | Pérou | perou | Andean ruins or highland valley | Stone terraces or llama-free ridge | Andes, ancient terraces, valleys | Single-Machu-Picchu postcard only |
| EC | Équateur | equateur | Volcanic Andes or colonial centre | Colonial street or volcano | Andes volcanoes, colonial cores | Galapagos-only cliché |
| BO | Bolivie | bolivie | Salt flat reflection or altiplano | Salt-flat horizon or market colour | Salar, altiplano, highland towns | Poverty framing |
| PY | Paraguay | paraguay | River-plain town under wide sky | Colonial facade or riverside | Rivers, plains, colonial towns | Bleak framing |
| UY | Uruguay | uruguay | Atlantic promenade at golden hour | Old-town street or coast | Rambla coast, old quarters | Generic beach stock |
| GT | Guatemala | guatemala | Volcano above colonial town | Colourful facade or volcano | Volcanoes, colonial Antigua-type, lakes | Poverty framing |
| CR | Costa Rica | costa-rica | Rainforest canopy or two-coast view | Canopy or coastline | Cloud forest, volcanoes, coasts | Eco-resort cliché |
| PA | Panama | panama | Skyline beside old town and canal | Skyline or colonial street | Modern skyline, canal, old town | Canal-only cliché |
| CU | Cuba | cuba | Colonial seafront at golden hour | Colourful facade or seafront | Havana seafront, colonial colour | Vintage-car-only cliché |
| DO | République Dominicaine | republique-dominicaine | Coastline and green interior | Coastal palms or old town | Caribbean coast, colonial Santo-Domingo | All-inclusive-resort cliché |
| BR | Brésil | bresil | Coastal city between hills and sea | Coastline or rainforest | Coastal cities, Amazon, relief | Carnival/favela framing |
| AR | Argentine | argentine | Andean lakes or wide pampas | City facade or mountain lake | Patagonia, pampas, grand city | Tango-cliché only |
| CL | Chili | chili | Desert, fjords or Andes | Desert horizon or coastal city | Atacama, Andes, southern fjords | Single-cliché framing |

### Middle East (3)

| Code | Name | meaeSlug | Hero direction | Card direction | Visual anchors | Avoid |
|---|---|---|---|---|---|---|
| JO | Jordanie | jordanie | Desert canyon or rock-carved facade | Canyon detail or desert camp | Wadi-type desert, rock architecture | Conflict association |
| AE | Émirats Arabes Unis | emirats-arabes-unis | Skyline at blue hour or desert dunes | Skyline or dune ridge | Modern skyline, desert, coast | Luxury-excess cliché |
| OM | Oman | oman | Coastal mountains or desert wadi | Fort detail or wadi pool | Hajar mountains, wadis, coast | Generic-Gulf swap |

**Total: 65 destinations** (Europe 14 + Africa 18 + Asia 15 + Americas 15 + Middle East 3).

---

## 7. Prompt template — Anti-Gravity / Gemini

Reusable master prompt. Replace the bracketed fields per destination using the
manifest. Produce a hero and a card variant from the same direction.

```
Premium editorial travel photograph of [COUNTRY_NAME].
Subject: [VISUAL_ANCHOR — e.g. coastline, cityscape, mountain town, landmark].
Composition: [hero = wide immersive establishing shot, generous sky/landscape
| card = tighter single-focal composition readable at small size].
Style: realistic documentary travel photography, calm and analytical mood,
natural plausible light (golden hour / soft overcast / blue hour), restrained
coherent color grading, compatible with a dark UI overlay.
Framing: keep the bottom third low-contrast and free of critical subject
(reserved for a dark scrim and text).
Strictly exclude: any text, caption, logo, watermark, or flag in the image;
identifiable person as main subject; political symbol as subject; war, riots,
disaster, ruins-as-subject, poverty, suffering, propaganda, or any sensational
or fear-based imagery; exaggerated national stereotype; generic stock-photo
travel-blog look.
Output:
- hero: 1600x900, 16:9, web-optimized, under 300 KB.
- card: 800x500, 16:10, web-optimized, under 120 KB.
```

Field sources per destination: `COUNTRY_NAME` = manifest `Name`;
`VISUAL_ANCHOR` = manifest "Visual anchors" / "Hero|Card direction";
apply the manifest "Avoid" column on top of the global exclusions.

---

## 8. Quality control checklist

Accept an image only if **every** item passes:

- [ ] correct country (matches the manifest row, not a look-alike place);
- [ ] visually recognizable but not cliché-heavy;
- [ ] no wrong or mismatched landmark (no famous landmark from another country);
- [ ] no embedded text, caption, watermark or logo;
- [ ] no flag inside the image;
- [ ] no identifiable person as main subject; no political symbol as subject;
- [ ] no sensational/crisis imagery (war, disaster, poverty, suffering);
- [ ] reads correctly under the dark bottom scrim (bottom third usable);
- [ ] file size within budget (hero < 300 KB, card < 120 KB);
- [ ] correct aspect ratio (hero 16:9 1600x900, card 16:10 800x500);
- [ ] maps to the correct `meaeSlug` folder;
- [ ] hero and card of the destination are visually coherent (same place/grade).

Reject and regenerate on any failure. Keep the rejected prompt note to refine
the next attempt.

---

## 9. Implementation roadmap

This document started as FRONT-024B (specification). It feeds the later phases:

- **FRONT-024C — registry / fallback / opt-in hardening.** ✅ DONE. Added the
  per-destination "photo available" opt-in (`DESTINATION_PHOTO_AVAILABILITY` +
  `hasDestinationPhoto`) so `DestinationImage` opts in without editing call-sites;
  fixed stale comments; introduced `DESTINATION_PHOTO_EXT`.
- **FRONT-024D — WebP pilot batch.** ✅ DONE (merged). Pipeline established and a
  5-destination pilot shipped under `/public/images/destinations/<slug>/`, registry
  path switched to `.webp`. Pilot: GR, TH, TN, PT, MX. Weight budgets and duotone
  fallback verified.
- **FRONT-025A — scale-up planning.** ✅ DONE (read-only). Full 5→65 plan, per-
  continent batching, QC protocol.
- **FRONT-025B — Europe batch.** ✅ DONE (merged, main `aedbc39`, PR #31). 12 Europe
  destinations activated (GE, AL, RS, BA, MD, MK, AM, TR, ME, XK, HR, HU) → **17 of
  65 active, 48 still on duotone fallback**. Images generated off-repo
  (Anti-Gravity + Nano Banana), QC'd pre-integration, weight re-encoded under the
  decimal budget where needed, baseline tests rewritten (17 true / 48 false),
  tsc/vitest/build green.
- **FRONT-025C+ — remaining continents.** PENDING. Middle East / Americas / Asia /
  Africa, same spec and same off-repo → QC → integration workflow.

GO/NO-GO for each phase: strict file scope, no backend/API/scoring/auth/Stripe/
Supabase/affiliate changes, no unexpected route or copy changes, image coverage
and fallback verified, performance checked where relevant.

### Delivery status (as of FRONT-025B)

| Variant | Active | Fallback (duotone) | Total |
|---|---|---|---|
| Destinations | 17 | 48 | 65 |

Active codes: GR, TH, TN, PT, MX (024D pilot) · GE, AL, RS, BA, MD, MK, AM, TR, ME,
XK, HR, HU (025B Europe). Paths: `/images/destinations/<meaeSlug>/{hero,card}.webp`
— hero 1600×900 (<300 000 B), card 800×500 (<120 000 B).

---

## What this document does NOT change

Code, the imagery registry, `lib/utils/countries.ts`, any asset, any image, any
flag, backend/API/scoring, auth/Stripe/Supabase, affiliate, routing, typography,
homepage sections, business logic. FRONT-024B is documentation only.
