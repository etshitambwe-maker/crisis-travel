# PREMIUM-FLOW-001C — Gate 1 (diagnostic read-only)

> Audit uniquement. Aucun fichier de code modifié. Contrat Gate 2 en fin de document.

## 1. État du dépôt

- **Branche courante** : `main`
- **HEAD** : `295fd1c8c424da3f046f2046b4d334dda595ece0` (= attendu)
  - `295fd1c fix(auth): preserve return path after login` (PREMIUM-FLOW-001A)
  - `ae19529 PREMIUM-UX-001: PremiumGate variant card …`
- **git status** : working tree **propre** (rien à committer)
- Le projet réel est dans le sous-dossier `crisis-travel/` (le dossier parent `appli voyage/` n'est pas un repo git).

## 2. Cartographie des états (source de vérité serveur)

`getUserWithSubscription()` (`lib/auth/supabase-server.ts`) renvoie `{ user, isPremium }` :
- non connecté → `{ user: null, isPremium: false }`
- connecté gratuit → `{ user: <User>, isPremium: false }`
- connecté premium → `{ user: <User>, isPremium: true }` (`subscription_tier === 'premium'` + abonnement actif)

| État | `user` | `isPremium` | CTA attendu | Action attendue |
|------|--------|-------------|-------------|-----------------|
| Non connecté | `null` | `false` | « Se connecter » | ouvrir AuthModal (`next` sécurisé) |
| Connecté gratuit | `<User>` | `false` | « Voir les offres Premium / Passer à Premium » | aller vers `/pricing` |
| Connecté premium | `<User>` | `true` | fonctionnalité débloquée | Générer PDF / Préparer itinéraire |

### Deux patterns coexistent dans le code

**Pattern A — gate SSR pré-calculé (`PremiumGate`)** : reçoit `isPremium` + `isLoggedIn` en props depuis le Server Component (page destination). Affiche un état avant tout appel réseau.

**Pattern B — gate piloté par le statut HTTP (`PdfExportButton`, `ItineraryBlock`)** : ne connaît PAS `isLoggedIn`/`isPremium`. Tente l'appel API, puis branche sur `401` (connexion) ou `402` (premium). C'est le pattern correct et déjà conforme.

## 3. Diagnostic précis

### 🔴 BUG PRINCIPAL — `PremiumGate` : le CTA ouvre toujours AuthModal

`components/auth/PremiumGate.tsx`
- **Variant `card`** : bouton ligne **76-91**. Le **label** bascule correctement
  (`{isLoggedIn ? '⚡ Passer à Premium →' : '🔐 Se connecter →'}`, ligne 90) **MAIS**
  le **`onClick` est `() => setShowAuth(true)` (ligne 77)** — inconditionnel.
- **Variant `overlay`** : bouton ligne **164-178**. Même défaut : label conditionnel
  (ligne 177), `onClick={() => setShowAuth(true)}` (ligne 165) inconditionnel.

**Conséquence exacte du symptôme rapporté** : un utilisateur **connecté non premium**
voit le bon libellé « Passer à Premium », clique, et obtient **la modale de connexion**
(AuthModal) au lieu de `/pricing`. C'est précisément « renvoyé vers une fiche de connexion
alors qu'il est déjà connecté ». Le composant **n'a pas confondu `isLoggedIn` et `isPremium`
dans le rendu** (les props sont correctes et bien câblées par la page) — il **confond les
deux dans l'action** : la seule action câblée est « ouvrir la connexion », quel que soit l'état.

### 🟠 Où l'affichage des prix « disparaît »

- `PremiumGate` affiche seulement « À PARTIR DE 9€/MOIS » (card l.73, overlay l.161). **79€/an n'est jamais mentionné** dans le gate.
- Le détail des prix (9€/mois, 79€/an, features) vit **uniquement** sur `/pricing` (`app/pricing/page.tsx`, `PLANS`). Comme le CTA n'amène pas l'utilisateur connecté sur `/pricing`, il **ne voit jamais la grille de prix** → impression que « l'affichage des prix disparaît ».

### Réponses aux questions Gate 1

1. **Détermination connecté/premium** :
   - `PremiumGate` : props `isPremium` + `isLoggedIn` (fournies par la page destination).
   - `PdfExportButton` / `ItineraryBlock` : **aucune** prop d'état ; pilotage par statut HTTP 401/402.
   - `page destination` : `getUserWithSubscription()` côté serveur (l.122), passe `isPremium` et `isLoggedIn={!!user}`.
   - `ResultsContent` : pas d'état auth ; le quota vient du payload `/api/analyze` (`data.meta.quota.isPremium`).
2. **`PremiumGate` reçoit-il `isLoggedIn` ?** Oui — page destination l.489 (Synthèse) et l.536 (Export PDF).
3. **`PremiumGate` connaît-il premium ?** Oui — prop `isPremium` (l.488, l.535). Si `isPremium`, il rend le children directement (l.24-26).
4. **Confusion `isLoggedIn`/`isPremium` ?** Pas dans le *rendu*. Dans l'*action* : oui — l'action est toujours « connexion », jamais « pricing », même pour un connecté non premium.
5. **Le bouton « Passer à Premium » ouvre-t-il AuthModal par erreur ?** **OUI** — c'est le bug central (l.77 et l.165).
6. **Pourquoi un connecté est-il envoyé vers la connexion ?** Parce que le `onClick` du CTA est codé en dur sur `setShowAuth(true)`, sans brancher sur `isLoggedIn`.
7. **Où les prix 9€/79€ sont-ils affichés ?** 9€/mois et 79€/an : seulement sur `/pricing` (PLANS). `PremiumGate` n'affiche que « à partir de 9€/mois ».
8. **CTA → `/pricing` quand connecté non premium ?** **NON** dans `PremiumGate`. **OUI** dans `PdfExportButton` (l.101-111) et `ItineraryBlock` (l.292-303) via le 402.
9. **401/402 distincts partout ?** Oui dans `PdfExportButton`, `ItineraryBlock`, `ResultsContent` (402 quota). `PremiumGate` ne raisonne pas en 401/402 — il décide en amont (props), et c'est là que la branche pricing manque.
10. **Wording premium clair ?** Partiel. `PremiumGate` : « 9€/mois » oui, « 79€/an » non, « PDF illimité » non, « Préparer mon itinéraire » non. `/pricing` : mentionne « Export PDF rapport voyage » et « Analyses illimitées » mais **pas** « PDF illimité » ni « itinéraire IA » nommément.
11. **Bouton itinéraire premium au bon endroit après analyse ?** Oui — `ResultsContent` rend `ItineraryBlock` sous `ranked[0]` (l.502-526). Libellé bouton : « Générer mon itinéraire → ». Le gating se fait au clic (402 → `/pricing`).
12. **Page destination : « Préparer mon itinéraire » ou seulement `/results` ?** Actuellement la **page destination n'a PAS** de bloc itinéraire — l'itinéraire vit uniquement sur `/results`. Décision produit à trancher en Gate 2 (hors correction du bug, voir non-goals).

## 4. Fichiers concernés

**À corriger (Gate 2)** :
- `components/auth/PremiumGate.tsx` — router le CTA selon `isLoggedIn` (connexion vs `/pricing`) ; enrichir le wording (79€/an, bénéfices premium).

**Conformes, à NE PAS modifier (référence du bon pattern)** :
- `components/crisis/PdfExportButton.tsx` — 401→AuthModal local, 402→`/pricing`. ✅
- `components/crisis/ItineraryBlock.tsx` — 401→AuthModal local, 402→`/pricing`. ✅
- `app/destination/[country]/page.tsx` — câblage props correct.
- `app/results/ResultsContent.tsx` — quota 402→`/pricing`. ✅
- `app/pricing/page.tsx` — source des prix (intacte ; ne pas toucher plans/prix).
- `components/auth/AuthModal.tsx`, `components/auth/AuthTrigger.tsx`, `components/auth/UserMenu.tsx`, `lib/auth/safe-next.ts`.

## 5. Tests

**Existants** :
- `__tests__/components/PremiumGate.test.ts` — vérifie variant card/overlay, largeur fluide, présence du `isLoggedIn ?` (≥2 occurrences), distinction 401/402 par label. **Ne teste PAS l'action `onClick`** → le bug est passé sous le radar.
- `__tests__/components/ItineraryBlock.test.ts` — couvre 401 (AuthModal), 402 (`/pricing`), PDF, wording.
- (PdfExportButton est couvert dans le même fichier, section 7.)

**Manquants (à ajouter en Gate 2)** :
- `PremiumGate` : quand `isLoggedIn=true` et `isPremium=false`, le CTA déclenche une navigation vers `/pricing` (lien `<a href="/pricing">` ou `window.location`), **PAS** `setShowAuth(true)`.
- `PremiumGate` : quand `isLoggedIn=false`, le CTA ouvre AuthModal (`setShowAuth(true)`).
- `PremiumGate` : présence du wording « 79€/an » et des bénéfices (« PDF illimité », « Préparer mon itinéraire ») — si validé.
- (style source-assertion, cohérent avec le repo : pas de jsdom/testing-library.)

## 6. Contrat Gate 2 (proposition — sans code)

**Goal** : dans `PremiumGate`, brancher l'action du CTA sur `isLoggedIn` —
non connecté → ouvre AuthModal ; connecté non premium → navigue vers `/pricing` ;
et clarifier le wording premium (79€/an + bénéfices). Premium continue de rendre le children.

**Non-goals** :
- Ne PAS implémenter le quota « 3 PDF gratuits ».
- Ne PAS toucher Stripe / webhooks / prix / plans.
- Ne PAS toucher `/api/analyze`, `/api/itinerary`, `/api/export-pdf` (audit seul).
- Ne PAS modifier le pattern HTTP 401/402 de `PdfExportButton` / `ItineraryBlock` (déjà corrects).
- Ne PAS réintroduire `/login`. Ne PAS casser `safeNext()`.
- Ne PAS ajouter un bloc itinéraire à la page destination (décision produit séparée).

**Acceptance criteria (vérifiables)** :
1. `isLoggedIn=false` → clic CTA → AuthModal s'ouvre.
2. `isLoggedIn=true, isPremium=false` → clic CTA → navigation `/pricing`, **AuthModal ne s'ouvre pas**.
3. `isPremium=true` → children rendu (inchangé).
4. Le gate mentionne « 9€/mois », « 79€/an » (+ bénéfices si validés).
5. 401/402 restent distincts dans tous les composants ; `safeNext()` toujours utilisé pour les flows connexion.
6. `tsc`, `vitest`, `build` verts.

## 7. Recommandation

**GO** pour Gate 2, périmètre **minimal** : la correction tient en un seul fichier
(`PremiumGate.tsx`), bug isolé et à faible risque. Le pattern correct existe déjà
(`PdfExportButton` 402→`/pricing`) et sert de modèle. Enrichissement du wording =
ajout optionnel à valider, sans impact sur la logique.

**Point à trancher avant Gate 2** : pour le CTA « connecté non premium », préférer un
`<a href="/pricing">` (simple, SSR-friendly, cohérent avec PdfExportButton) plutôt qu'un
`window.location` ou un routeur — recommandé.
