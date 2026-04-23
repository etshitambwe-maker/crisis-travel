# PRD — Crisis Travel
## Product Requirements Document v1.0
*Date : Avril 2026 — Statut : MVP en développement*

---

## 1. Vision Produit

Crisis Travel est le **premier outil de voyage qui place le contexte mondial au cœur de la décision de voyage**.

Ce n'est pas un comparateur de vols. Ce n'est pas un guide touristique. C'est un **système d'intelligence géopolitique et économique appliqué au voyage**, propulsé par l'IA.

### Problème résolu
Les voyageurs manquent d'un outil qui synthétise en temps réel :
- Les alertes de sécurité officielles (dispersées sur 3+ sites gouvernementaux)
- Le contexte géopolitique réel (pas les clichés touristiques)
- Les opportunités économiques liées aux fluctuations de change
- Un budget réaliste tout-compris

### Proposition de valeur unique
> "Voyage mieux, voyage plus sûr, voyage moins cher — parce que tu comprends le monde."

**Ordre de priorité absolu :** Sécurité → Stabilité géopolitique → Budget optimisé → Praticité

---

## 2. Utilisateurs Cibles

### Persona 1 — Le Budget Traveler
- 25-35 ans, voyage 2-3 fois par an
- Budget : 800-1500€ tout compris
- Motivations : découverte, authenticité, prix
- Douleur : "Je veux voyager moins cher, pas moins bien"
- Crisis Travel lui donne : les destinations où son argent vaut 2x plus en ce moment

### Persona 2 — La Famille en Budget Serré
- Parents 30-45 ans, 1-3 enfants
- Budget : 2000-4000€ pour la famille
- Motivations : sécurité maximale, activités adaptées
- Douleur : "Je ne veux pas prendre de risques avec mes enfants"
- Crisis Travel lui donne : confirmation objective de la sécurité + budget optimisé

### Persona 3 — Le Digital Nomad
- 28-40 ans, travaille à distance
- Budget : 1000-2000€/mois tout compris
- Motivations : pays stable, internet fiable, coût de vie bas
- Douleur : "Je veux un pays calme et pas cher pour 3-6 mois"
- Crisis Travel lui donne : scoring géopolitique + coût de vie + infrastructure

### Persona 4 — Le Voyageur Anxieux
- Tout âge, peu d'expérience internationale
- Motivations : partir mais besoin de réassurance
- Douleur : "Les médias me font peur, je ne sais pas si c'est vraiment dangereux"
- Crisis Travel lui donne : données officielles claires, verdict factuel sans sensationnalisme

---

## 3. L'Algorithme Central — CrisisScore

### Formule

```
CrisisScore = (Sécurité × 0.40) + (Géopolitique × 0.30) + (Budget × 0.20) + (Praticité × 0.10)
```

Score de **0 à 100**. Plus c'est élevé, plus la destination est recommandée.

### Grille de lecture

| Score | Statut | Signification |
|-------|--------|---------------|
| 80-100 | 🟢 IDÉALE | Destination idéale actuellement |
| 60-79 | 🟡 RECOMMANDÉE | Recommandée avec vigilance normale |
| 40-59 | 🟠 POSSIBLE | Possible avec préparation sérieuse |
| 0-39 | 🔴 DÉCONSEILLÉE | Fortement déconseillée actuellement |

### Score Sécurité (40%)

Sources et pondération :
- **Alerte MEAE France Diplomatie** (35%) — niveau 1-4 converti en score /100
  - Niveau 1 (vigilance normale) → 100
  - Niveau 2 (vigilance renforcée) → 70
  - Niveau 3 (déconseillé sauf raison impérative) → 30
  - Niveau 4 (déconseillé formellement) → 0
- **ACLED — conflits armés actifs** (30%) — nb d'incidents 30 derniers jours → malus
- **US State Department Advisory** (20%) — niveaux 1-4 similaires MEAE
- **UK FCDO Travel Advice** (10%) — validation croisée
- **ReliefWeb — crises humanitaires actives** (5%) — malus si crise en cours

### Score Géopolitique (30%)

Sources et pondération :
- **Perplexity Sonar API** (40%) — analyse temps réel des tensions politiques
- **World Bank Governance Indicators** (25%) — stabilité politique, état de droit
- **GDELT** (20%) — intensité médiatique des tensions récentes
- **Conditions visa** (15%) — e-visa/VOA = favorable, visa bloqué = malus fort

### Score Budget (20%)

Sources et pondération :
- **Taux de change Frankfurter** (30%) — EUR vs monnaie locale vs moyenne 12 mois
- **Amadeus — coût vol** (30%) — prix réel depuis pays de départ
- **Numbeo — coût de vie** (25%) — repas, hébergement, transport locaux
- **Booking.com — hébergement** (15%) — disponibilité dans la fourchette budget

### Score Praticité (10%)

- **Type de visa requis** (40%) — sans visa > e-visa > visa on arrival > ambassade
- **Connexions aériennes** (30%) — vol direct > 1 escale > 2 escales+
- **Infrastructure sanitaire** (20%) — hôpitaux accessibles, assurance couverte
- **Connectivité internet** (10%) — pertinent pour digital nomads

### Gestion des sources indisponibles

Si une source est indisponible, la valeur neutre **50/100** est utilisée pour ce sous-composant, et le résultat est marqué `partial: true`. L'interface affiche clairement quelles sources ont été utilisées.

---

## 4. Fonctionnalités MVP

### F1 — Formulaire Profil Voyageur
**Champs :**
- Pays de départ (autocomplete)
- Budget total (slider : 500€ → 10 000€)
- Durée du voyage (curseur : 3j → 90j)
- Période souhaitée (mois / flexible)
- Profil voyageur (solo / couple / famille / nomad)
- Priorités (sécurité / budget / découverte — tri drag & drop)
- Continents exclus (optionnel)
- Mode spécial : Bunker / Crise de Portefeuille / Standard

**UX :** Formulaire en étapes progressives (3 étapes max), pas de page longue.

### F2 — Moteur de Scan Mondial
- Analyse en parallèle de 50-100 pays cibles
- Appels APIs parallèles via Promise.allSettled
- Cache Redis pour éviter les appels redondants
- Temps de réponse cible : < 8 secondes
- Affichage progressif (streaming des résultats)

### F3 — Page Résultats
- Top 3-5 destinations avec CrisisScore visuel (gauge circulaire animée)
- Pour chaque destination : résumé sécurité, contexte géopolitique, budget estimé
- Badge spéciaux : "Fenêtre d'opportunité", "Coup de coeur budget", "Ultra-safe"
- Comparateur rapide entre destinations (tableau)
- Bouton "En savoir plus" → fiche complète

### F4 — Fiche Destination Complète
- CrisisScore global + breakdown des 4 sous-scores
- Section Sécurité : sources officielles, dernières alertes, verdict
- Section Géopolitique : contexte simplifié, tensions actuelles, stabilité
- Section Budget : vol estimé + hébergement + vie quotidienne + total 7j
- Analyse narrative Claude AI : "Pourquoi maintenant, pourquoi là"
- Section honnête "Risques résiduels" (pas de greenwashing sécuritaire)
- Bouton "Créer une alerte pour cette destination"

### F5 — Mode "Fenêtre d'Opportunité"
Détecte automatiquement les pays où :
- La monnaie locale a chuté > 15% vs EUR sur 3 mois (opportunité change)
- Le niveau de sécurité vient de s'améliorer (hausse CrisisScore)
- Les vols sont anormalement bas (détection Amadeus)
- Combinaison des 3 = "Jackpot"

### F6 — Mode "Bunker"
- Filtre strict : CrisisScore Sécurité > 85 uniquement
- Destinations niveau 1 MEAE uniquement
- Aucun conflit actif ACLED
- Idéal pour familles avec enfants, voyageurs anxieux

### F7 — Mode "Crise de Portefeuille"
- Budget < 1 000€ tout compris
- Recherche dans les destinations "oubliées" sûres (hors top tourisme)
- Focus sur les pays à monnaie faible + sécurité acceptable
- Exemples typiques : Géorgie, Kosovo, Moldavie, Kirghizistan, Albanie

### F8 — Analyse Custom "Pourquoi pas [Pays X] ?"
- L'utilisateur saisit n'importe quel pays
- Analyse complète immédiate avec CrisisScore détaillé
- Argumentaire Claude AI complet
- Comparaison avec la moyenne mondiale

---

## 5. Fonctionnalités Phase 2

- **Alertes push** : notification quand une destination sauvegardée devient accessible/sûre
- **Pack voyage IA** : budget jour par jour, tips locaux, restaurants, quartiers
- **Comparateur de crises** : mettre 2-3 destinations côte à côte
- **Historique des scores** : évolution du CrisisScore d'un pays sur 6 mois
- **Communauté** : retours d'expérience de voyageurs récents (validation humaine)
- **Export PDF** : rapport de voyage complet pour l'employeur (voyages pros)

---

## 6. Modèle Économique

### Freemium
- **Gratuit** : 3 recherches complètes / mois, accès lecture fiches destinations
- **Premium (9€/mois)** : recherches illimitées + alertes + analyse deep dive + export PDF
- **Premium Annuel (79€/an)** : économie 29%, même fonctionnalités

### Affiliation
- **Vols Amadeus** : commission sur les clics/réservations via liens affiliés
- **Hébergement Booking** : commission standard programme affilié
- **Assurance voyage** : partenariat à négocier (AXA, Chapka, etc.)

### B2B (Phase 2)
- **Licence entreprise** : accès équipe pour DRH, gestion voyages pros en zones sensibles
- **Tarif** : 299€/mois pour 10 utilisateurs
- **Cas d'usage** : ONG, cabinets de conseil, grands groupes avec présence internationale

---

## 7. Stack Technique Détaillée

### Frontend
```
Next.js 14 (App Router)
TailwindCSS + shadcn/ui
TypeScript strict
Framer Motion (animations)
Recharts (graphiques)
react-hook-form + Zod (formulaires)
```

### Backend (API Routes Next.js)
```
Next.js API Routes (server-side uniquement)
TypeScript strict
Zod (validation)
axios (appels HTTP externes)
xml2js (parsing RSS/XML)
```

### Infrastructure
```
Supabase (PostgreSQL + Auth + Storage)
Upstash Redis (cache serverless)
Vercel (déploiement)
```

### AI
```
Anthropic Claude Sonnet (analyse narrative)
Perplexity Sonar (temps réel géopolitique)
```

---

## 8. Design Direction

### Esthétique
"Salle de crise" — dashboard sobre, chiffres clairs, codes couleur explicites.
Pas de photos de plages. Pas de clichés touristiques. Des données.

### Palette
```css
--color-background: #0a0a0f;
--color-surface: #13131a;
--color-border: #1e1e2e;
--color-danger: #ff4d2e;
--color-warning: #ffd23f;
--color-safe: #00e5a0;
--color-text: #e8e8e8;
--color-text-muted: #6b7280;
--color-accent: #ff4d2e;
```

### Typographie
- **Titres** : Bebas Neue (impact, lisibilité à distance)
- **Données/Chiffres** : Space Mono (monospace, précision)
- **Corps de texte** : DM Sans (lisibilité longue durée)

### Composants clés
- `CrisisScoreGauge` — gauge circulaire animée avec couleur dynamique
- `CountryCard` — carte destination compacte avec mini-score
- `SecurityAlert` — bandeau rouge/orange si niveau élevé
- `OpportunityBadge` — badge vert avec explication inline
- `WorldMap` — carte SVG interactive colorée par CrisisScore
- `BudgetBreakdown` — décomposition visuelle vol/hébergement/vie
- `TickerBanner` — fil d'actualité géopolitique défilant en header

---

## 9. Métriques de Succès MVP

### Acquisition
- 500 utilisateurs inscrits à 3 mois
- 50 conversions Premium à 3 mois

### Engagement
- Temps moyen sur la fiche destination > 3 minutes
- 40%+ des utilisateurs créent une alerte

### Technique
- Temps de réponse analyse complète < 8 secondes (P95)
- Disponibilité > 99%
- CrisisScore cohérent avec les alertes officielles (validation manuelle mensuelle)

### Monétisation
- MRR cible 6 mois : 500€
- Commission affiliation cible 6 mois : 200€/mois

---

## 10. Risques et Mitigation

| Risque | Impact | Mitigation |
|--------|--------|------------|
| API MEAE indisponible | Haut | Fallback UK FCDO + State Dept |
| Faux sentiment de sécurité | Très haut | Disclaimer légal clair, toujours recommander vérification officielle |
| Coût APIs AI élevé | Moyen | Cache agressif, prompt optimization, limite requêtes/utilisateur |
| Données géopolitiques obsolètes | Haut | TTL court (30min), badge "données actualisées il y a X minutes" |
| Responsabilité légale si incident | Très haut | CGU claires : outil d'aide à la décision, pas de responsabilité engagée |

---

## 11. Roadmap

### MVP (Mois 1-2)
- [x] Architecture et documentation
- [ ] Setup Next.js + Supabase + Redis
- [ ] Services sécurité (MEAE, FCDO, State Dept)
- [ ] Services géopolitique (Perplexity, World Bank)
- [ ] Services budget (Frankfurter, Numbeo)
- [ ] Algorithme CrisisScore
- [ ] Intégration Claude AI (narratifs)
- [ ] Interface complète (formulaire → résultats → fiche)
- [ ] Déploiement Vercel

### Phase 2 (Mois 3-4)
- [ ] Amadeus (vols réels)
- [ ] Booking.com (hébergement)
- [ ] Système d'alertes push
- [ ] Authentification et comptes utilisateurs
- [ ] Monétisation Premium (Stripe)

### Phase 3 (Mois 5-6)
- [ ] App mobile (React Native ou PWA)
- [ ] B2B dashboard
- [ ] Communauté et retours d'expérience
- [ ] Historique des scores (time series)
