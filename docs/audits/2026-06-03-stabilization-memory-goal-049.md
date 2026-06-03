# Crisis Travel — Stabilization Memory / Handoff after GOAL-049

> **Statut :** stabilisation technique V1 close (GOAL-042 → GOAL-049).
> **Date :** 2026-06-03 · **Baseline :** `main` = `origin/main` = `49e2963`
> **Nature :** document de handoff / mémoire de stabilisation. Aucune action runtime.
> **Prochain grand chantier :** refonte frontend complète via Claude Design — **PAS** de polish incrémental.

---

## 1. Baseline technique actuelle

- `main` = `origin/main` = **`49e2963`** (GOAL-048 surface secondary affiliate CTAs), working tree propre.
- **Stripe** : monétisation directe active (checkout + webhook validés). J1 active.
- **Travelpayouts Drive** : actif, piloté par `NEXT_PUBLIC_TRAVELPAYOUTS_DRIVE_SRC` (env publique Vercel) via `components/TravelpayoutsDriveScript.tsx`.
- **Schéma affiliate Supabase stabilisé** : migrations `003` (baseline 3 tables) → `004` (colonne `redirect_url`) → `005` (CHECK élargi à 6 catégories) toutes appliquées. 7 lignes dans `affiliate_partners`.
- **`/api/affiliate/click`** : actif. Valide `category` (z.enum 6) → résout le partenaire → log best-effort → `302` vers la destination.
- **`TravelPackBlock`** : expose 6 CTA (3 principaux Vol/Hôtel/Assurance + 3 secondaires Transfert/Activités/eSIM « Préparer le voyage »).
- **`TravelPackMiniBlock`** : volontairement limité à 3 CTA (Vol/Hôtel/Assurance) — n'expose **aucun** partenaire secondaire.
- Stack : Next.js App Router (version à vérifier dans `package.json` si nécessaire), Supabase (Postgres + Auth + RLS), Upstash Redis (cache), Anthropic + OpenRouter (AI). Déploiement Vercel.

## 2. Historique des GOALs 042 → 049

| GOAL | Objet | Résultat |
|---|---|---|
| **042** | Partner & Affiliate Configuration Audit | Archi identifiée : `affiliate_partners` / `affiliate_clicks` / `affiliate_conversions` + `/api/affiliate/click` + `affiliate.service.ts`. Constat : liens publics fonctionnels mais **non monétisés**. |
| **043** | Travelpayouts Drive Verification Script | Loader Drive ajouté ; env var `NEXT_PUBLIC_TRAVELPAYOUTS_DRIVE_SRC` configurée en Vercel ; Drive détecté en prod. |
| **044** | Affiliate `redirect_url` support | Deep-links réseau complets supportés via `redirect_url` (prioritaire). Comportement `url_param`+`affiliate_id` et fallback public préservés. Aucun lien d'affiliation en dur dans le front. |
| **045** | Kiwi activation (flight slot) | DDL `redirect_url` appliquée ; `skyscanner/flight` → `redirect_url = https://kiwi.tpo.mx/7NkQdf4N`, active. Test prod manuel confirmé. **Aucun code.** |
| **046** | Affiliate category extension (code) | `AffiliateCategory` étendu à 6 valeurs (+`transfer`/`activity`/`esim`). z.enum + FALLBACK_URL à 6. Migration `005` préparée. **Mergé** (`6643765`). |
| **047** | Migration 005 + partenaires secondaires | Migration `005` appliquée ; upsert de 4 partenaires secondaires (welcome-pickups, gettransfer, tiqets, airalo). skyscanner/booking/chapka inchangés. **Aucun code.** |
| **048** | Secondary CTA exposure (TravelPackBlock) | Rangée « Préparer le voyage » (Transfert/Activités/eSIM) ajoutée au seul `TravelPackBlock`. MiniBlock intact. **Mergé** (`49e2963`). Test prod manuel confirmé. |
| **049** | Read-only Affiliate Monetization Audit | Audit read-only : 7 lignes DB confirmées, 302 live vérifié par catégorie, 0 modif. Rapport en chat. |

## 3. Carte de monétisation actuelle

| Levier | Catégorie | `redirect_url` (DB) | Statut |
|---|---|---|---|
| **Stripe** | — | — | ✅ Monétisation directe active |
| **Kiwi** (skyscanner) | flight | `https://kiwi.tpo.mx/7NkQdf4N` | ✅ Monétisé + visible |
| **Welcome Pickups** | transfer | `https://tpo.mx/TCPlpV7c` | ✅ Monétisé + visible |
| **Tiqets** | activity | `https://tiqets.tpo.mx/byHaQ9qu` | ✅ Monétisé + visible |
| **Airalo** | esim | `https://airalo.tpo.mx/GrWkh7qE` | ✅ Monétisé + visible |
| **GetTransfer** | transfer | `https://gettransfer.tpo.mx/8iDdan4t` | 🟡 DB/API actif, **non exposé en UI** (atteignable uniquement par slug explicite) |
| **Booking** | hotel | `null` | 🔴 Fallback public — CJ Affiliate en attente |
| **Chapka** | insurance | `null` | 🔴 Fallback public — partenaire en attente |

> Toutes les lignes `active=true`. `affiliate_id`/`url_param` = NULL partout (monétisation par `redirect_url`, pas par injection de param). Résolution `transfer` sans slug → premier actif = welcome-pickups (gettransfer reste en réserve).

## 4. Statut frontend

- Le frontend **fonctionne** mais est jugé **visuellement / UX insatisfaisant**.
- ⛔ **Ne pas poursuivre par du polish incrémental.** Tout ajustement UI ponctuel est explicitement proscrit jusqu'à la phase de refonte.
- ➡️ La prochaine étape frontend **doit être une refonte complète via un workflow Claude Design dédié** (brief → spec → implémentation), pas une série de petites retouches.
- 🔒 Pendant la refonte, le **comportement backend / affiliate / Stripe doit être préservé** (contrats API stables).

## 5. À NE PAS casser pendant la refonte

- **Stripe** : checkout + webhook validés.
- **`/api/analyze`** (cœur produit : CrisisScore).
- **`/api/affiliate/click`** (statut 302, validation z.enum 6 catégories, logique de résolution).
- **Patterns de href des CTA TravelPack** : `/api/affiliate/click?category=…&partner=…&url=…&country=…&countryName=…&total=…`.
- **Mapping catégorie/partenaire** : flight→skyscanner, hotel→booking, insurance→chapka, transfer→welcome-pickups, activity→tiqets, esim→airalo (+ gettransfer en réserve).
- **Schéma affiliate Supabase** (`affiliate_partners`/`clicks`/`conversions`, RLS, CHECK 6 catégories).
- **Script Travelpayouts Drive** (env-driven, vérification de site).
- **Routes SEO / légales** : `robots.txt`, `sitemap.xml`, `/privacy`, `/terms`, OpenGraph.
- **Responsivité mobile** : à **redessiner**, mais ne pas casser fonctionnellement entre-temps.

## 6. Notes de rollback

| Levier | Rollback |
|---|---|
| **Kiwi** | `UPDATE affiliate_partners SET redirect_url=NULL WHERE slug='skyscanner'` → repli public ; ou `active=false`. Data-only, réversible. |
| **Partenaires secondaires** (welcome-pickups/tiqets/airalo/gettransfer) | `redirect_url=NULL` (repli public) ou `active=false` (coupe la résolution). Data-only. |
| **UI GOAL-048** | `git revert 49e2963` ou retour à `6643765` → masque la rangée secondaire de TravelPackBlock. MiniBlock non concerné. |
| **Migration 005** | ⚠️ **Pas de rollback trivial** : revenir au CHECK 3 catégories échouerait tant que des lignes transfer/activity/esim existent → il faudrait d'abord les supprimer/réaffecter. `004` (colonne) : DROP COLUMN destructif → éviter. Ne pas tenter sans plan dédié. |
| **Travelpayouts Drive** | Retirer/vider `NEXT_PUBLIC_TRAVELPAYOUTS_DRIVE_SRC` en Vercel + redeploy → le `<Script>` ne se charge plus. |
| **Booking / Chapka** | Aucun rollback de monétisation nécessaire (toujours en fallback public, jamais monétisés). |

## 7. Points ouverts

- 🔴 **Booking CJ** en attente d'acceptation → hôtels non monétisés.
- 🔴 **Chapka** partenaire en attente → assurance non monétisée.
- 🟡 **`affiliate_conversions` non câblé** : aucun postback/webhook → on mesure les clics, pas les conversions ni le revenu réel.
- 🟡 **GetTransfer** actif en DB mais non surfacé (redondant avec Welcome Pickups sur `transfer`).
- 🟡 **Analytics affiliate non implémenté** : `affiliate_clicks` se remplit mais n'est pas exploité.
- 🟡 **Refonte frontend nécessaire** (cf. §4).
- 🟡 **Attribution Travelpayouts** : validée pleinement uniquement par des **clics prod réels** (non vérifiable depuis le poste de dev).

## 8. Phases recommandées (suite)

**Phase A — Préparation de la refonte frontend** *(prochain chantier)*
- Capturer les écrans actuels (états clés du parcours).
- Définir le nouveau récit UX / produit.
- Briefer Claude Design.
- Produire une spec de refonte.
- **Préserver les contrats backend** (cf. §5).

**Phase B — Implémentation frontend**
- Intégrer le frontend redesigné via Claude Code.
- Garder les contrats API stables.
- Tester les flux affiliate (302 par catégorie) et Stripe (checkout/webhook).

**Phase C — Monétisation / analytics ultérieures**
- Booking CJ (dès acceptation).
- Chapka (dès disponibilité).
- Analytics des clics affiliés.
- Tracking de conversions / postbacks (`affiliate_conversions`).
- Contenu SEO destinations.

## 9. Règles d'opération pour les sessions futures

- **Un seul GOAL à la fois.**
- **Workflow par gates** (contrat → inventaire → vérification réelle → handoff).
- **Pas de push/merge sans GO explicite.**
- **Supabase en read-only d'abord** ; aucune écriture de données prod sans approbation explicite.
- **Aucune dérive de polish UI** avant la phase de refonte complète.
- Commits via `git commit -F <fichier>` (jamais heredoc PowerShell).
- Accès Supabase depuis ce poste : `NODE_OPTIONS=--use-system-ca` (proxy TLS local) ; **jamais** `NODE_TLS_REJECT_UNAUTHORIZED=0`.

---

*Document de stabilisation. Prochain sujet recommandé : « Claude Design Frontend Redesign Brief ».*
