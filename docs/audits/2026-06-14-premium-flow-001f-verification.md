# PREMIUM-FLOW-001F — Vérification (Gate 3, Mode D)

**Goal :** sur `/destination/[country]`, regrouper les surfaces premium en un seul bloc
« 07 — Aller plus loin avec Premium ». Non-premium → un seul CTA ; premium → narrative
complète + 2 actions réelles (itinéraire + PDF). Synthèse gratuite (06) intacte.

**Type projet :** web app (Next.js) → Mode D (browser E2E + visual).
**Branche :** `main` · HEAD avant travaux : `cc0f705`.
**Statut gates :** ✅ Contrat ✅ Inventaire ✅ Vérification.

---

## Commandes exécutées

| Commande | Résultat |
|---|---|
| `npx tsc --noEmit` | ✅ exit 0, aucune erreur |
| `npx vitest run` | ✅ **469/469** tests, 22 fichiers |
| `npm run build` | ✅ Compiled successfully (5.4s), `/destination/[country]` compilé. 1 warning **pré-existant** (`app/api/stripe/webhook/route.ts`, non touché) |
| `curl -m 180 /destination/jp` | ✅ HTTP 200, 10.1s (cold), 150 KB |
| `node verification-screenshots/run.mjs` | ✅ Playwright desktop 1280 + mobile 375 |

---

## Critères d'acceptation

### C1 — Section 06 gratuite inchangée
DOM : `free-summary = 1`, `basic-synthesis = 1` (desktop **et** mobile).
Screenshot : verdict + paragraphe + points forts/vigilance + conseils, hors gate. ✅

### C2 — Section 07 = un seul bloc premium unifié
DOM : `<PremiumGate> = 1`, `FONCTIONNALITÉ PREMIUM = 1`, `Aller plus loin avec Premium = 1`. ✅

### C3 — Non-premium : exactement 1 CTA premium principal
DOM : `ctaConnecter (🔐 Se connecter →) = 1` sur les deux viewports.
Avant : 3 surfaces (gate Synthèse IA + CTA itinéraire + gate Export PDF). ✅

### C4 — Bénéfices listés une seule fois
DOM : `Préparer mon itinéraire = 1` (dans la liste du gate unique, plus de bloc autonome).
Bénéfices (PDF illimité · Préparer mon itinéraire · Analyses illimitées) rendus 1× via
le seul `<PremiumGate>`. ✅

### C5 — Premium : narrative complète visible immédiatement
Vérifié par **assertion source** + structure : la narrative est rendue en children du
`PremiumGate` (rendu tel quel si `isPremium`), au-dessus de `PremiumActions`.
⚠️ **Limite honnête** : l'état premium n'a pas été exercé en E2E (pas de session Supabase
premium en environnement de test). Le rendu non-premium est vérifié en vrai (screenshots) ;
le rendu premium est garanti par les tests source + la logique `PremiumGate` (`if (isPremium)
return children`). `premiumActions = 0` côté non-premium confirme que les actions sont bien
réservées au premium.

### C6 — Premium : 2 boutons sous le texte (itinéraire + PDF)
Source `PremiumActions.tsx` : bouton « Préparer mon itinéraire » → `router.push('/results')`
+ `<PdfExportButton scoreSnapshot=… narrative=… />`. Tests verts. ✅

### C7 — Aucun upsell pour un premium
`PremiumGate` ne rend que `children` si premium (pas de carte upsell). `PremiumActions` ne
contient aucun wording d'upsell. ✅

### C8 — Plus de double bloc
Tests : `feature="Export PDF"` absent, `<PrepareItineraryCta` absent de la page, un seul gate. ✅

### C9 — Tests anti-régression doublon
`DestinationPremiumFlow.test.ts` : « un seul `<PremiumGate` », « pas de gate Export PDF »,
« pas de `PrepareItineraryCta` monté », « bénéfices rendus 1× ». ✅

### C10 — Playwright desktop + mobile
`dest-desktop-full.png`, `dest-desktop-block07.png`, `dest-mobile-full.png`,
`dest-mobile-block07.png`. Inspectés visuellement (voir verdicts ci-dessous). ✅

### C11 — tsc + vitest + build verts
Voir tableau commandes. ✅

---

## Inspection visuelle des screenshots

| Screenshot | Verdict |
|---|---|
| `dest-desktop-block07.png` | ✅ 06 gratuite complète hors gate ; 07 = **une** carte premium centrée, bénéfices 1×, pricing, 1 CTA « Se connecter ». Aucune carte dupliquée. Alignement propre. |
| `dest-mobile-block07.png` (375) | ✅ Carte premium full-width, centrée, CTA full-width, **pas de coupure** (non-régression PREMIUM-UX-001). Listes empilées lisibles. |

---

## Contraintes respectées (non-régression)

`basicSynthesis`/`buildFreeSummary`, `app/api/*`, `/api/export-pdf`, `/api/itinerary`,
`/api/analyze`, Stripe/webhooks/prix/plans, Supabase : **non modifiés**.
`safeNext()` : non touché. `/login` : non réintroduit. 401/402 de `PdfExportButton` : intacts.

---

## Points ouverts

- **`components/crisis/PrepareItineraryCta.tsx` est désormais du code mort** (plus monté
  nulle part). Conservé volontairement (contrainte « ne pas casser PrepareItineraryCta » +
  « pas de refonte »). Suppression possible en suivi si souhaité.
- Rendu **premium** non exercé en E2E réel (pas de session premium de test) — couvert par
  tests source + logique `PremiumGate`. À confirmer manuellement avec un compte premium si
  besoin d'une preuve visuelle premium.
