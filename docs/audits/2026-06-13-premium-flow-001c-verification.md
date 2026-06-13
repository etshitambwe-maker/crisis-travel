# PREMIUM-FLOW-001C — Verification (Gate 3)

Contrat : dans `PremiumGate`, router l'action du CTA selon `isLoggedIn` (non connecté → AuthModal ;
connecté non premium → `/pricing`) et clarifier le wording premium (9€/mois, 79€/an, PDF illimité,
Préparer mon itinéraire). Premium → children inchangé.

Type de projet : web app (Next.js) → Mode D (browser E2E + inspection visuelle) + tests source-assertion + tsc + build.

## Critère 1 — Non connecté → CTA ouvre AuthModal

- **Source-assertion** (`vitest`) : `setShowAuth(true)` + `<AuthModal>` présents. ✅
- **Playwright (page réelle `/destination/jp`, logged-out)** :
  - `button:has-text('Se connecter')` count = **2** (Synthèse IA + Export PDF)
  - `a[href='/pricing']` avec label premium = **0**
  - Capture `cta-region-1.png` : bouton « 🔐 SE CONNECTER → » plein écran, carte complète visible.
- **Verdict : ✅** le non-connecté reçoit bien le bouton de connexion.

## Critère 2 — Connecté non premium → CTA va vers /pricing, jamais AuthModal

- **Playwright (composant réel, `isLoggedIn isPremium={false}`, 2 variants)** :
  ```
  a[href='/pricing'] count = 2  (card + overlay)
  link labels = ['⚡ VOIR LES OFFRES PREMIUM →', '⚡ VOIR LES OFFRES PREMIUM →']
  Se-connecter buttons = 0
  ```
- Capture `loggedin-both-variants.png` : les deux gates affichent le CTA gold
  « ⚡ VOIR LES OFFRES PREMIUM → » ; aucun bouton de connexion.
- **Verdict : ✅** le bug « connecté mais on me redemande de me connecter » est corrigé.
  Le CTA est un `<a href="/pricing">`, jamais `setShowAuth` pour un utilisateur connecté.

## Critère 3 — Le gate affiche 9€/mois, 79€/an, PDF illimité, Préparer mon itinéraire

- **Playwright (page réelle logged-out + composant logged-in)** : les 4 mentions présentes dans le DOM rendu.
  ```
  9€/MOIS · 79€/AN = True
  PDF illimité = True
  Préparer mon itinéraire = True
  ```
- Captures : benefits list (`+ PDF illimité · Préparer mon itinéraire · Analyses illimitées`)
  + ligne « 9€/MOIS · 79€/AN » visibles sur les deux variants.
- **Verdict : ✅** wording court (pas de grille dupliquée ; FAQ/PLANS restent sur `/pricing`).

## Critère 4 — Bug corrigé

- DOM logged-in : **0** bouton « Se connecter », **2** liens `/pricing`. ✅

## Critère 5 — Variants card et overlay fonctionnels

- Les deux rendent le CTA correct dans les deux états (4 captures). Carte PDF non coupée (PREMIUM-UX-001 préservé). ✅

## Critère 6 — tsc, vitest, build verts

```
vitest : Test Files 20 passed (20) · Tests 438 passed (438)
tsc --noEmit : exit 0
next build : exit 0 (23 routes, /destination/[country] + /pricing OK)
```
✅

## Non-régression / contraintes respectées

- `git diff --stat` sur `app/api/`, `app/pricing/page.tsx`, `lib/auth/safe-next.ts` = **vide** (aucune modification).
- Pas de quota PDF implémenté. Pas de bloc itinéraire ajouté à la page destination.
- Pas de `/login` réintroduit. `safeNext()` intact. Route temporaire de vérification supprimée.

## Fichiers modifiés

```
M components/auth/PremiumGate.tsx
M __tests__/components/PremiumGate.test.ts
?? docs/audits/2026-06-13-premium-flow-001c-gate1.md
?? docs/audits/2026-06-13-premium-flow-001c-verification.md
```

## Captures (c:\tmp\verification-screenshots\)

- `cta-region-1.png` — Export PDF card, logged-out, CTA « SE CONNECTER ».
- `pdf-card-full.png` — gate Synthèse IA logged-out, wording premium.
- `loggedin-both-variants.png` — card + overlay logged-in non-premium, CTA « VOIR LES OFFRES PREMIUM ».

**Résultat : 6/6 critères ✅.**
