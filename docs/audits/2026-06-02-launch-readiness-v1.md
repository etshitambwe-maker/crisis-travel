# Launch Readiness V1 — Crisis Travel

> Audit GOAL-039 — 2026-06-02 · origin/main = `c4403fc` · audit read-only (aucun code modifié)
> Preuves par lecture de code (chemin:ligne). Aucun secret/clé/token dans ce rapport.

---

## Score global de préparation

**≈ 78 / 100 — Lançable cette semaine sous conditions.**

| Pilier | Statut | Note |
|---|---|---|
| Stabilité technique (/api/analyze) | ✅ Prêt | Robuste, codes d'erreur propres, pas de double appel |
| Légal / confiance | ✅ Prêt | privacy + terms complets, disclaimers, contact, RGPD |
| Monétisation (Stripe) | 🟡 Partiel | Code prêt ; dépend de la config dashboard + env vars prod |
| Partenariats / affiliation | 🟡 Partiel | Architecture prête ; 0 ID d'affiliation réel connecté (liens publics) |
| Parcours utilisateur V1 | ✅ Prêt | 2 onglets, repositionnement découverte (GOAL-038) |
| SEO / lancement | 🟠 Faible | Pas d'OpenGraph, pas de robots, favicon par défaut |

Le produit **fonctionne et est légalement présentable**. Ce qui manque pour un lancement "propre" relève surtout de la **configuration** (env vars prod, comptes partenaires) et du **polish SEO/partage**, pas du code applicatif.

---

## A. Bloquants lancement (P0 — à régler avant de publier)

### A1. Variables d'environnement critiques en production — **à vérifier**
- **Statut** : partiel (impossible à confirmer côté code ; dépend de Vercel).
- **Preuve** : `app/api/analyze/route.ts` dépend de `ANTHROPIC_API_KEY`, `OPENROUTER_API_KEY`, `UPSTASH_REDIS_REST_*`, Supabase ; `lib/stripe/stripe.service.ts:8` jette `STRIPE_SECRET_KEY manquant` si absent.
- **Risque** : sans ces clés en prod, `/api/analyze` dégrade (cache cold, fallbacks) et le paiement échoue.
- **Reco** : valider la checklist env vars (section dédiée plus bas) dans Vercel **Production** avant publication. Rappel mémoire projet : valider tout host Upstash par `nslookup 8.8.8.8` avant de coller dans Vercel.
- **Priorité : P0.**

### A2. Cohérence promesse pricing ↔ réalité (FAQ B2B 299€/mois)
- **Statut** : incohérence.
- **Preuve** : `app/pricing/page.tsx:296` annonce un « plan B2B à 299€/mois », mais « Accès API B2B » est `included: false` sur **les trois** plans (`pricing/page.tsx:39,57`). Aucune route ni offre B2B réelle.
- **Risque** : promesse commerciale sans produit en face → risque de réclamation / perte de confiance.
- **Reco** : soit retirer la mention B2B de la FAQ, soit la formuler en « sur demande / nous contacter » sans tarif ferme. (Texte uniquement — non codé ici.)
- **Priorité : P0** (légalement et commercialement sensible).

### A3. Confirmer le flux paiement de bout en bout en prod
- **Statut** : code prêt, non vérifié en conditions réelles.
- **Preuve** : checkout `app/api/stripe/checkout/route.ts`, webhook `app/api/stripe/webhook/route.ts` (signature vérifiée l.85, mapping free/premium l.36-48), prix lus depuis `STRIPE_PRICE_PREMIUM_MONTHLY/ANNUAL` (`lib/stripe/stripe.service.ts:20-22`).
- **Risque** : un `priceId` vide (env absente) → checkout échoue silencieusement ; webhook non configuré côté Stripe → premium jamais activé après paiement.
- **Reco** : test réel en mode test Stripe (paiement → webhook reçu → `subscription_tier=premium`), puis bascule live. Endpoint webhook à déclarer dans le dashboard Stripe.
- **Priorité : P0** (si la monétisation fait partie du lancement ; sinon rétrogradable en P1 si lancement free-first).

---

## B. À faire avant lancement si rapide (P1 — fortement recommandé, non bloquant)

### B1. OpenGraph / Twitter Card absents
- **Statut** : absent.
- **Preuve** : `app/layout.tsx:18-22` ne définit que `title` + `description`. Pas de `metadataBase`, `openGraph`, `twitter`, ni image de partage.
- **Risque** : tout partage (réseaux, messageries) affiche un aperçu nu sans image ni titre formaté → mauvaise première impression au lancement.
- **Reco** : ajouter `metadataBase` + `openGraph` (title, description, image 1200×630) + `twitter: { card: 'summary_large_image' }`. ~15 lignes dans `layout.tsx` + 1 image.
- **Priorité : P1.**

### B2. robots.txt / robots.ts absent
- **Statut** : absent (sitemap présent : `app/sitemap.ts`).
- **Preuve** : aucun `app/robots.ts` trouvé.
- **Risque** : pas de directive d'indexation explicite ni de lien vers le sitemap pour les crawlers.
- **Reco** : ajouter `app/robots.ts` (allow `/`, référencer le sitemap). ~10 lignes.
- **Priorité : P1.**

### B3. Favicon / branding par défaut Next
- **Statut** : par défaut.
- **Preuve** : `public/` ne contient que `file.svg`, `globe.svg`, `next.svg`, `vercel.svg`, `window.svg` (assets de démo Next). `app/favicon.ico` = défaut.
- **Risque** : onglet navigateur affiche un favicon générique → perçu comme non fini.
- **Reco** : favicon + icône PWA aux couleurs Crisis Travel (`#ff4d2e` sur `#0a0a0f`). Supprimer les SVG démo inutilisés.
- **Priorité : P1.**

### B4. Logs temporaires `[API/analyze]` encore en place
- **Statut** : présent, marqué « à retirer ».
- **Preuve** : `app/api/analyze/route.ts:170` (`country`), `:174` (`batch`), `:213-217` (`timing` + cache stats). Commentaires explicites « temporaire (GOAL-032/033) — à retirer une fois le goulot confirmé ».
- **Risque** : faible — bruit dans les logs Vercel, fuite de timing interne. Pas bloquant.
- **Reco** : nettoyage dans un GOAL dédié (cf. mémoire projet GOAL-036). Garder tant que le diagnostic cache n'est pas clos peut être un choix volontaire.
- **Priorité : P1 (ou P2 si on garde pour diagnostic).**

### B5. Env vars orphelines dans `.env.example`
- **Statut** : incohérence mineure.
- **Preuve** : `.env.example` déclare `AMADEUS_API_KEY/SECRET/ENV`, `ACLED_EMAIL`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` — **aucune** référencée par `process.env.*` dans `app/`, `lib/`, `components/`.
- **Risque** : confusion lors de la config prod (on provisionne des clés inutiles ; ou on croit Amadeus actif alors que les prix vol sont des estimations statiques — `TravelPackBlock.tsx:6-23`).
- **Reco** : nettoyer `.env.example` (retirer les orphelines ou les commenter « réservé futur »).
- **Priorité : P1.**

---

## C. Peut attendre après lancement (P2 — polish / non urgent)

### C1. UX front-end fine (GOAL UX dédié, déjà acté)
- Textes parfois trop petits, boutons/onglets peu visibles, hiérarchie visuelle, surbrillance — relevés lors de la validation GOAL-038.
- **Preuve** : tailles `fontSize` basses récurrentes (ex. `TravelPackBlock.tsx:115` `0.68rem`, `:129` `0.58rem` ; `pricing/page.tsx:113` `9.5px`).
- **Priorité : P2** — à traiter dans le GOAL UX prévu, pas avant lancement.

### C2. Cache fallback non corrigé (connu)
- Diagnostic posé (mémoire GOAL-036 : H2 fallbacks non cachés dominante). Non corrigé, mais l'app reste fonctionnelle (cold-cache = plus lent, pas cassé).
- **Preuve** : point d'entrée `lib/cache/redis.ts` ; logs `cache.hits/misses/errors` dans `analyze/route.ts:213-217`.
- **Priorité : P2** — GOAL « Cache Fallbacks » séparé (hors scope GOAL-039).

### C3. Drift documentaire « Next 14 » vs réalité
- **Preuve** : `CLAUDE.md` et `PRD.md` indiquent Next.js 14 ; `package.json` = `next: 16.2.4`.
- **Risque** : nul pour l'utilisateur final, source de confusion interne.
- **Priorité : P2.**

### C4. Branches non mergées 036 / 037
- `goal-036-cache-instrumentation` (worktree C:/tmp) et `goal-037-destination-search` non mergées.
- **Reco** : décider explicitement (merge, archive, ou abandon) — hors scope de ce GOAL, ne pas toucher sans demande.
- **Priorité : P2.**

---

## D. Décisions business à prendre (non techniques)

| # | Décision | Détail / preuve | Impact |
|---|---|---|---|
| D1 | **Programmes d'affiliation** | Booking, Skyscanner/aviation, Chapka : ouvrir les comptes et obtenir les `affiliate_id`. Le code injecte l'ID **en base** (`affiliate_partners`) sans toucher au front (`affiliate.service.ts:86-100`). Tant que vide → liens publics nus, **0 revenu affilié**. | Revenu |
| D2 | **Choix assurance** | UI câblée sur **Chapka** (`TravelPackBlock.tsx:78,213-221` ; fallback `affiliate/click/route.ts:22`). Confirmer Chapka ou alternative. | Revenu / partenaire |
| D3 | **Travelpayouts vs liens directs** | Travelpayouts mentionné dans tes contraintes mais **absent du code** (vols = Skyscanner direct). Décider si on intègre Travelpayouts (agrégateur multi-partenaires) ou on garde liens directs. | Stratégie monétisation |
| D4 | **Modèle premium au lancement** | Lancer avec Stripe actif (paiement dès J1) ou en **free-first** (premium désactivé, focus acquisition) ? Le code supporte les deux (quota free=3/mois, `analysisQuota.ts:3`). | Go-to-market |
| D5 | **Offre B2B** | Réelle (à construire) ou retirée du discours (cf. A2) ? | Cohérence / légal |
| D6 | **Tracking clics affiliés** | Table `affiliate_clicks` alimentée best-effort (`affiliate.service.ts:116-147`). Décider si on exploite ces données (analytics revenus) dès le lancement. | Mesure |

---

## Checklist partenaire (pré-lancement)

- [ ] **Booking** — compte affilié ouvert → `affiliate_id` + `url_param` insérés dans `affiliate_partners` (slug `booking`).
- [ ] **Vols (Skyscanner ou Travelpayouts)** — décision D3 prise, compte ouvert, ID inséré (slug `skyscanner`).
- [ ] **Chapka** (assurance) — décision D2 confirmée, compte ouvert, ID inséré (slug `chapka`).
- [ ] Table Supabase `affiliate_partners` peuplée + `active=true` pour chaque partenaire.
- [ ] Vérifier qu'un clic sans ID redirige toujours proprement (fallback public — déjà géré code).
- [ ] (Optionnel) Tableau de bord interne sur `affiliate_clicks`.

> Note : aucune de ces étapes ne nécessite de modifier le front. L'injection se fait en base (design `affiliate.service.ts`).

---

## Checklist env vars (production Vercel)

| Variable | Rôle | Comportement si absente | Criticité |
|---|---|---|---|
| `ANTHROPIC_API_KEY` | Claude (opportunités) | opportunités omises / dégradées | P0 |
| `OPENROUTER_API_KEY` | LLM (selon usage) | dégradation analyse | P0 |
| `NEXT_PUBLIC_SUPABASE_URL` | DB + auth | quota/affiliate/stripe inopérants (fallback dev "laisser passer") | P0 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | auth client | auth cassée | P0 |
| `SUPABASE_SERVICE_ROLE_KEY` | écritures admin (quota, clics, webhook) | quota non appliqué, clics non tracés, premium non activé | P0 |
| `STRIPE_SECRET_KEY` | paiement serveur | `getStripe()` jette (`stripe.service.ts:8`) → checkout 500 | P0 (si monétisation J1) |
| `STRIPE_WEBHOOK_SECRET` | vérif webhook | webhook rejette tout (`webhook/route.ts:72`) → premium jamais activé | P0 (si monétisation J1) |
| `STRIPE_PRICE_PREMIUM_MONTHLY` | prix mensuel | priceId vide → checkout échoue | P0 (si monétisation J1) |
| `STRIPE_PRICE_PREMIUM_ANNUAL` | prix annuel | idem annuel | P0 (si monétisation J1) |
| `UPSTASH_REDIS_REST_URL` | cache | cold-cache permanent (lent, pas cassé) | P1 |
| `UPSTASH_REDIS_REST_TOKEN` | cache | idem | P1 |
| `NEXT_PUBLIC_APP_URL` | base URL (sitemap, redirections) | défaut `https://crisis-travel.app` (`sitemap.ts:4`) | P1 |
| `CRON_SECRET` | auth cron alerts | cron check-alerts non sécurisé/inopérant | P1 |
| `RESEND_API_KEY` | emails (alertes) | alertes email KO | P1 |
| `NUMBEO_API_KEY` | coût de la vie | fallback budget | P1 |
| `ACLED_ACCESS_KEY` | sécurité (ACLED) | fallback neutre score 50 | P1 |
| `AMADEUS_*`, `ACLED_EMAIL`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | **orphelines** | aucun (non utilisées) | — à nettoyer (B5) |

---

## Ordre d'exécution recommandé (pré-lancement)

1. **P0 — Décider le modèle de lancement (D4)** : monétisation J1 ou free-first. Ça détermine si les env vars Stripe sont P0 ou P1.
2. **P0 — Provisionner les env vars** correspondantes en prod Vercel + valider Upstash (`nslookup`).
3. **P0 — Corriger l'incohérence B2B (A2)** : retirer ou requalifier la FAQ 299€.
4. **P0 (si monétisation J1) — Tester le flux Stripe** test→live (A3).
5. **P1 — SEO de partage** : OpenGraph + robots + favicon (B1/B2/B3).
6. **P1 — Nettoyer `.env.example`** (B5) et décider du sort des logs temporaires (B4).
7. **Lancer.**
8. **Post-lancement** : GOAL UX (C1), GOAL Cache Fallbacks (C2), nettoyage doc (C3), branches 036/037 (C4).

---

## Prochain GOAL conseillé

**GOAL-040 — Launch Config & SEO Pack (P0/P1 non-destructif)**
Périmètre proposé (à valider) :
- A2 (texte B2B), B1 (OpenGraph), B2 (robots.ts), B3 (favicon/branding), B5 (.env.example).
- Volontairement **hors** : Stripe (config dashboard, pas du code), affiliation (décisions business D1-D3), cache (GOAL séparé), UX (GOAL séparé).
- Tous mini-fix de code → branche dédiée + `npx tsc --noEmit` + `npx vitest run` + `npx next build`.

> Les décisions business (section D) ne sont **pas** un GOAL de code : ce sont des actions à mener côté comptes partenaires / Stripe / go-to-market.

---

## Méthode & limites de cet audit

- Audit **read-only** : aucun fichier de code modifié. Seul fichier produit = ce rapport.
- Preuves = lecture de code (chemins:lignes ci-dessus). Pas d'exécution runtime ni de test de déploiement (hors scope d'un audit).
- Non audité en profondeur (surface découverte > brief V1, à explorer si pertinent pour le lancement) : `/api/alerts`, `/api/cron/check-alerts`, `/api/export-pdf`, `/api/score-history`, `/api/photo`, `/auth/callback`, page `/status`.
- Contraintes respectées : scoring/pondérations/N=18/TARGET_COUNTRIES/cache/Stripe/partenaires **non touchés** ; « Destination précise » non réintroduit ; aucun merge ; branches 036/037 non touchées.
