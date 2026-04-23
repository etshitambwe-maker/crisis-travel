# CrisisScore — Documentation Technique de l'Algorithme

## Vue d'ensemble

Le CrisisScore est le moteur central de Crisis Travel. C'est un score composite de **0 à 100** qui synthétise la situation actuelle d'une destination pour un voyageur donné, en agrégeant des données provenant de sources hétérogènes (alertes officielles, IA temps réel, données économiques).

**Plus le score est élevé, plus la destination est recommandée.**

---

## Formule Principale

```
CrisisScore = (S × 0.40) + (G × 0.30) + (B × 0.20) + (P × 0.10)
```

| Variable | Composante | Poids |
|----------|-----------|-------|
| S | Score Sécurité | 40% |
| G | Score Géopolitique | 30% |
| B | Score Budget | 20% |
| P | Score Praticité | 10% |

Chaque composante est un score de **0 à 100** avant pondération.

---

## Score Sécurité (S) — 40% du CrisisScore

### Sous-composantes

```
S = (MEAE × 0.35) + (ACLED × 0.30) + (StateDept × 0.20) + (FCDO × 0.10) + (ReliefWeb × 0.05)
```

### MEAE — France Diplomatie (35%)

Source : Flux RSS `https://www.diplomatie.gouv.fr/fr/conseils-aux-voyageurs/`

| Niveau MEAE | Libellé | Score brut |
|-------------|---------|-----------|
| 1 | Vigilance normale | 100 |
| 2 | Vigilance renforcée | 70 |
| 3 | Déconseillé sauf raison impérative | 25 |
| 4 | Déconseillé formellement | 0 |

Normalisation : score direct selon tableau ci-dessus.

### ACLED — Conflits Armés (30%)

Source : API ACLED `https://api.acleddata.com/acled/read`

Paramètres : pays, 30 derniers jours, types d'événements = Battles, Explosions, Violence against civilians

```
score_acled = max(0, 100 - (nb_incidents × facteur_gravité))
```

| Nb incidents (30j) | Score |
|--------------------|-------|
| 0 | 100 |
| 1-5 | 80 |
| 6-20 | 50 |
| 21-50 | 20 |
| > 50 | 0 |

Facteur gravité : × 1.5 si "Fatalities > 10" dans le dernier incident.

### US State Department (20%)

Source : API `https://travel.state.gov/content/travel/en/travelinformationsheetxml.html`

| Niveau | Libellé | Score |
|--------|---------|-------|
| 1 | Exercise Normal Precautions | 100 |
| 2 | Exercise Increased Caution | 70 |
| 3 | Reconsider Travel | 25 |
| 4 | Do Not Travel | 0 |

### UK FCDO (10%)

Source : RSS `https://www.gov.uk/foreign-travel-advice`

Même logique de mapping niveau → score que MEAE.

### ReliefWeb (5%)

Source : API `https://api.reliefweb.int/v1/reports`

```
score_reliefweb = crise_active ? 30 : 100
```

Si une crise humanitaire majeure est active (tremblement de terre, famine, épidémie), malus fort.

---

## Score Géopolitique (G) — 30% du CrisisScore

### Sous-composantes

```
G = (Perplexity × 0.40) + (WorldBank × 0.25) + (GDELT × 0.20) + (Visa × 0.15)
```

### Perplexity Sonar (40%)

Prompt structuré envoyé à l'API Perplexity :

```
Analyse la situation géopolitique actuelle de [pays] pour un voyageur français.
Retourne un JSON avec :
{
  "stability_score": 0-100,
  "summary": "résumé 2 phrases",
  "main_risks": ["risque1", "risque2"],
  "recent_events": ["événement1"],
  "trend": "improving|stable|deteriorating"
}
Soit factuel et basé sur les dernières actualités.
```

Le `stability_score` retourné est utilisé directement.

### World Bank Governance Indicators (25%)

Source : API `https://api.worldbank.org/v2/country/{code}/indicator/`

Indicateurs utilisés :
- `PV.EST` — Political Stability and Absence of Violence
- `RL.EST` — Rule of Law
- `GE.EST` — Government Effectiveness

Chaque indicateur va de -2.5 à +2.5.

```typescript
function normalizeWorldBankScore(value: number): number {
  // -2.5 → 0, +2.5 → 100
  return Math.round(((value + 2.5) / 5) * 100);
}

// Moyenne des 3 indicateurs normalisés
score_wb = (norm(PV) + norm(RL) + norm(GE)) / 3;
```

Note : Ces données sont annuelles (lag d'un an). TTL cache : 24h.

### GDELT (20%)

Source : API `https://api.gdeltproject.org/api/v2/doc/doc`

On mesure le "tone" médiatique moyen des 7 derniers jours pour le pays.

```
score_gdelt = max(0, min(100, 50 + (tone_moyen × 5)))
```

Tone GDELT : -100 (très négatif) à +100 (très positif). Un tone de 0 → score 50 (neutre).

### Conditions Visa (15%)

| Condition | Score |
|-----------|-------|
| Sans visa (ressortissants français) | 100 |
| E-visa (en ligne, immédiat) | 85 |
| Visa on arrival | 70 |
| Visa ambassade (simple) | 40 |
| Visa ambassade (complexe/long) | 20 |
| Visa refusé/impossible | 0 |

Source : base de données interne mise à jour manuellement + Perplexity pour vérification.

---

## Score Budget (B) — 20% du CrisisScore

### Sous-composantes

```
B = (Change × 0.30) + (Vol × 0.30) + (VieLocale × 0.25) + (Hébergement × 0.15)
```

### Taux de Change — Frankfurter (30%)

```typescript
function scoreCurrency(currentRate: number, avgRate12m: number): number {
  const variation = ((currentRate - avgRate12m) / avgRate12m) * 100;
  // Si la monnaie locale a baissé vs EUR → favorable pour le voyageur
  // variation positive = EUR vaut plus = bon pour le voyageur
  return Math.min(100, Math.max(0, 50 + variation * 2));
}
```

Exemple : EUR/TRY a augmenté de 20% en 12 mois → score change = 90 (très favorable).

### Coût Vol — Amadeus (30%)

```typescript
function scoreFlightCost(priceCurrent: number, budget: number): number {
  const ratio = priceCurrent / budget;
  if (ratio < 0.15) return 100; // vol < 15% du budget
  if (ratio < 0.25) return 80;
  if (ratio < 0.35) return 60;
  if (ratio < 0.50) return 40;
  return 10; // vol > 50% du budget
}
```

### Coût de Vie — Numbeo (25%)

Indicateur : "Cost of Living Index" de Numbeo (base : New York = 100).

```typescript
function scoreCostOfLiving(numbeoIndex: number): number {
  // Index bas = vie pas chère = bon score
  if (numbeoIndex < 30) return 100;  // très bon marché
  if (numbeoIndex < 50) return 80;
  if (numbeoIndex < 70) return 60;
  if (numbeoIndex < 90) return 40;
  return 20; // très cher
}
```

### Hébergement — Booking.com (15%)

```typescript
function scoreAccommodation(avgPrice: number, budget: number): number {
  const nightlyBudget = budget / (duration * 0.35); // 35% du budget hébergement
  const ratio = avgPrice / nightlyBudget;
  if (ratio < 0.5) return 100;
  if (ratio < 0.8) return 80;
  if (ratio < 1.0) return 60;
  if (ratio < 1.3) return 40;
  return 10;
}
```

---

## Score Praticité (P) — 10% du CrisisScore

### Sous-composantes

```
P = (Visa × 0.40) + (Vols × 0.30) + (Santé × 0.20) + (Internet × 0.10)
```

Voir tableau visa dans Score Géopolitique (réutilisé).

**Connexions aériennes :**
- Vol direct : 100
- 1 escale : 70
- 2 escales : 40
- 3 escales+ : 20

**Infrastructure sanitaire :**
- Score de 0 à 100 basé sur l'index de santé Numbeo.

**Connectivité :**
- Speedtest Global Index pour le pays (normalisé 0-100).

---

## Méthode de Normalisation

**Règle d'or** : toutes les sources sont normalisées en score de 0 à 100 avant agrégation.

```typescript
function normalize(value: number, min: number, max: number): number {
  return Math.round(((value - min) / (max - min)) * 100);
}
```

**Cas particuliers :**
- Valeur manquante → 50 (neutre), flag `partial: true`
- Valeur aberrante (< 0 ou > 100 après normalisation) → clamp à [0, 100]

---

## Gestion des Sources Indisponibles

Si une API est en erreur ou timeout (> 5 secondes) :

```typescript
const fallbackScore = {
  value: 50,        // valeur neutre
  source: 'fallback',
  reason: 'API indisponible',
  confidence: 'low'
};
```

Le CrisisScore final est marqué :
- `confidence: 'high'` si toutes les sources sont disponibles
- `confidence: 'medium'` si 1-2 sources manquantes
- `confidence: 'low'` si 3+ sources manquantes (avertissement affiché)

---

## Exemples de Calcul

### Exemple 1 — Géorgie (Tbilisi), Budget 1200€, Solo

| Composante | Sources | Score brut | Pondéré |
|-----------|---------|-----------|---------|
| Sécurité | MEAE niv.2(70), ACLED 2 incidents(80), StateDept niv.2(70), FCDO OK(80) | **74** | 29.6 |
| Géopolitique | Perplexity(72), WorldBank(65), GDELT(58), Visa e-visa(85) | **71** | 21.3 |
| Budget | Change +30%(90), Vol 280€(80), Numbeo 32(95), Hébergement 25€/nuit(90) | **89** | 17.8 |
| Praticité | E-visa(85), 1 escale(70), Santé(65), Internet(70) | **74** | 7.4 |
| **TOTAL** | | | **76.1** |

Résultat : 🟡 **76/100 — Recommandée avec vigilance**

### Exemple 2 — Thaïlande (Bangkok), Budget 2000€, Famille

| Composante | Score brut | Pondéré |
|-----------|-----------|---------|
| Sécurité | MEAE niv.1(100), ACLED 0(100), StateDept niv.1(100) | **98** | 39.2 |
| Géopolitique | Perplexity(80), WorldBank(60), GDELT(65), Visa VOA(70) | **71** | 21.3 |
| Budget | Change +5%(55), Vol 650€(60), Numbeo 45(80), Hébergement(75) | **68** | 13.6 |
| Praticité | VOA(70), Direct(100), Santé(75), Internet(80) | **80** | 8.0 |
| **TOTAL** | | | **82.1** |

Résultat : 🟢 **82/100 — Destination idéale**

### Exemple 3 — Soudan, Budget 1500€, Solo

| Composante | Score brut | Pondéré |
|-----------|-----------|---------|
| Sécurité | MEAE niv.4(0), ACLED 120+(0), StateDept niv.4(0) | **0** | 0.0 |
| Géopolitique | Perplexity(5), WorldBank(8), GDELT(3), Visa(30) | **10** | 3.0 |
| Budget | Change(70), Vol pas de vols directs(10), Numbeo N/A(50) | **40** | 8.0 |
| Praticité | Visa(30), Pas de vols(10), Santé(5) | **15** | 1.5 |
| **TOTAL** | | | **12.5** |

Résultat : 🔴 **12/100 — Fortement déconseillée**

---

## Plan d'Évolution

### V2 — Machine Learning
- Entraînement sur les incidents réels survenus vs CrisisScore prédit
- Ajustement automatique des pondérations par région géographique
- Intégration du retour utilisateurs ("c'était vraiment comme ça ?")

### V3 — Personnalisation avancée
- CrisisScore personnalisé par nationalité du voyageur (pas seulement français)
- Score ajusté selon la période (haute saison = surcoût, saison des pluies = malus)
- Intégration des données d'assurance voyage (refus de couverture = signal fort)

### V4 — Prédictif
- Analyse des tendances (CrisisScore J+30, J+60)
- Alertes préventives "cette destination va se dégrader"
- Intégration données climatiques (El Niño, saisons cycloniques)
