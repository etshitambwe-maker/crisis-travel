# Crisis Travel — Contexte Projet pour Claude Code

## Vision
Crisis Travel est une application web AI-powered qui aide les voyageurs à prendre des décisions de voyage intelligentes en tenant compte du contexte géopolitique, sécuritaire et économique mondial en temps réel.

Ce n'est pas un comparateur de vols. C'est un système d'intelligence appliqué au voyage.

**Ordre de priorité absolu : Sécurité → Géopolitique → Budget → Praticité**

---

## Stack Technique

### Frontend
- **Next.js 14** (App Router) — framework principal, SSR + API Routes
- **TailwindCSS** — styling utilitaire
- **shadcn/ui** — composants UI accessibles et personnalisables
- **Framer Motion** — animations
- **Recharts** — visualisations de données

### Backend (API Routes Next.js)
- **Next.js API Routes** — backend intégré, pas de serveur Express séparé
- **TypeScript strict** — typage obligatoire partout
- **Zod** — validation des entrées API

### Base de données & Auth
- **Supabase** — PostgreSQL managé + authentification + Row Level Security

### Cache
- **Upstash Redis** — cache serverless (compatible Vercel Edge)
- **TTL standard : 30 minutes** pour les données géopolitiques
- **TTL court : 5 minutes** pour les prix de vols
- **TTL long : 24h** pour les données World Bank / coût de vie

### AI
- **Claude Sonnet API** (Anthropic) — analyse narrative, recommandations
- **Perplexity Sonar API** — actualité géopolitique temps réel

### Déploiement
- **Vercel** — frontend + API Routes (un seul déploiement)

---

## Règles de Développement OBLIGATOIRES

- TypeScript `strict: true` — aucune exception, jamais de `any`
- Zod pour valider toutes les entrées utilisateur et réponses API
- **Jamais de clé API côté client** — uniquement dans les API Routes
- Toujours paralléliser les appels API indépendants avec `Promise.allSettled`
- Cache Redis avant chaque appel API externe
- Logger chaque appel API externe (service, pays, durée, cache hit/miss)
- Fallback neutre (score 50) si une source est indisponible

---

## Algorithme CrisisScore

```
CrisisScore = (Sécurité × 0.40) + (Géopolitique × 0.30) + (Budget × 0.20) + (Praticité × 0.10)
```

Score de 0 à 100. Plus c'est élevé, plus la destination est recommandée.
Détail complet → voir `docs/crisis-score.md`

---

## Design System

- **Thème** : Dark obligatoire
- **Fond** : `#0a0a0f` | **Danger** : `#ff4d2e` | **Warning** : `#ffd23f` | **Safe** : `#00e5a0`
- **Titres** : Bebas Neue | **Données** : Space Mono | **Corps** : DM Sans
