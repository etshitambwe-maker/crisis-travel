# Architecture Technique — Crisis Travel

## Vue d'ensemble

Crisis Travel est une application **Next.js 14 full-stack** déployée sur Vercel.
Tout le backend (services, APIs) est dans les API Routes de Next.js — pas de serveur séparé.

```
┌─────────────────────────────────────────────────────────────┐
│                        VERCEL                               │
│  ┌──────────────────┐         ┌──────────────────────────┐  │
│  │   FRONTEND       │         │   BACKEND (API Routes)   │  │
│  │   Next.js 14     │ ──────► │   /api/analyze           │  │
│  │   App Router     │         │   /api/destination/[id]  │  │
│  │   TailwindCSS    │         │   /api/opportunities      │  │
│  │   shadcn/ui      │         │   /api/health             │  │
│  └──────────────────┘         └────────────┬─────────────┘  │
└───────────────────────────────────────────┼─────────────────┘
                                            │
              ┌─────────────────────────────┼──────────────────┐
              │                             │                   │
        ┌─────┴──────┐             ┌────────┴───────┐   ┌──────┴──────┐
        │  SUPABASE  │             │  UPSTASH REDIS  │   │  APIS EXT.  │
        │  PostgreSQL│             │  Cache 30min    │   │  MEAE, ACLED│
        │  Auth      │             │  Serverless     │   │  Perplexity │
        └────────────┘             └─────────────────┘   └─────────────┘
```

---

## Structure des Dossiers

```
crisis-travel/
├── app/                              # Next.js App Router
│   ├── layout.tsx                    # Layout racine (dark theme, fonts)
│   ├── page.tsx                      # Page d'accueil
│   ├── globals.css                   # Variables CSS, base styles
│   ├── results/
│   │   └── page.tsx                  # Page résultats analyse
│   ├── destination/
│   │   └── [country]/
│   │       └── page.tsx              # Fiche destination complète
│   └── api/                          # API Routes (backend)
│       ├── analyze/
│       │   └── route.ts              # POST — analyse complète
│       ├── destination/
│       │   └── [code]/
│       │       ├── route.ts          # GET — données destination
│       │       └── explain/
│       │           └── route.ts      # GET — analyse narrative Claude
│       ├── opportunities/
│       │   └── route.ts              # GET — fenêtres d'opportunité
│       ├── custom-check/
│       │   └── route.ts              # POST — analyse custom
│       └── health/
│           └── route.ts              # GET — statut APIs
│
├── components/
│   ├── ui/                           # shadcn/ui (auto-généré, ne pas éditer)
│   ├── crisis/                       # Composants métier Crisis Travel
│   │   ├── CrisisScoreGauge.tsx     # Gauge circulaire animée
│   │   ├── CountryCard.tsx          # Carte destination compacte
│   │   ├── SecurityAlert.tsx        # Bandeau alerte sécurité
│   │   ├── OpportunityBadge.tsx     # Badge opportunité économique
│   │   ├── BudgetBreakdown.tsx      # Décomposition budget
│   │   ├── WorldMap.tsx             # Carte SVG interactive
│   │   └── TickerBanner.tsx         # Fil d'actualité défilant
│   └── layout/
│       ├── Header.tsx               # Navigation + ticker
│       └── Footer.tsx
│
├── lib/                              # Logique métier (côté serveur)
│   ├── services/
│   │   ├── security/
│   │   │   ├── meae.service.ts
│   │   │   ├── fcdo.service.ts
│   │   │   ├── stateDept.service.ts
│   │   │   ├── acled.service.ts
│   │   │   └── reliefweb.service.ts
│   │   ├── geopolitical/
│   │   │   ├── perplexity.service.ts
│   │   │   ├── worldbank.service.ts
│   │   │   └── gdelt.service.ts
│   │   ├── budget/
│   │   │   ├── frankfurter.service.ts
│   │   │   ├── numbeo.service.ts
│   │   │   ├── amadeus.service.ts    # Phase 2
│   │   │   └── booking.service.ts    # Phase 2
│   │   └── scoring/
│   │       └── crisisScore.service.ts
│   ├── claude/
│   │   └── claude.service.ts         # Intégration Claude AI
│   ├── cache/
│   │   └── redis.ts                  # Client Upstash Redis
│   └── utils/
│       ├── normalize.ts              # Fonctions normalisation 0-100
│       ├── countries.ts              # Liste pays ISO codes
│       └── logger.ts                 # Logger structuré
│
├── types/
│   ├── crisis.types.ts               # CrisisScore, UserProfile, etc.
│   ├── api.types.ts                  # Types réponses APIs externes
│   └── components.types.ts           # Props composants
│
├── docs/                             # Documentation (ce dossier)
├── public/
│   ├── world-map.svg                 # Carte SVG du monde
│   └── fonts/                        # Bebas Neue, Space Mono, DM Sans
├── CLAUDE.md
├── PRD.md
├── .env.example
├── .env.local                        # Variables locales (gitignored)
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

---

## Flux de Données — Analyse Complète

```
Utilisateur soumet formulaire
        │
        ▼
POST /api/analyze
        │
        ├── Validation Zod du payload
        │
        ├── Sélection des pays candidats (50-100 pays)
        │
        ├── Pour chaque pays (en parallèle via Promise.allSettled) :
        │   │
        │   ├── Vérifier cache Redis
        │   │   └── Si hit → retourner depuis cache
        │   │
        │   └── Si miss → appels parallèles :
        │       ├── calculateSecurityScore(country)
        │       │   ├── meae.service.ts
        │       │   ├── acled.service.ts
        │       │   ├── stateDept.service.ts
        │       │   ├── fcdo.service.ts
        │       │   └── reliefweb.service.ts
        │       │
        │       ├── calculateGeopoliticalScore(country)
        │       │   ├── perplexity.service.ts
        │       │   ├── worldbank.service.ts
        │       │   └── gdelt.service.ts
        │       │
        │       └── calculateBudgetScore(country, profile)
        │           ├── frankfurter.service.ts
        │           └── numbeo.service.ts
        │
        ├── Agrégation CrisisScore final pour chaque pays
        │
        ├── Tri par CrisisScore décroissant
        │
        ├── Sélection Top 5
        │
        └── Retourner résultats au client
```

---

## Flux — Analyse Narrative Claude

```
GET /api/destination/[code]/explain
        │
        ├── Vérifier cache Redis (TTL: 1h)
        │
        ├── Récupérer CrisisScore existant (depuis cache ou recalcul)
        │
        ├── Construire prompt avec données structurées
        │
        ├── Appel Claude Sonnet API
        │
        ├── Parser et valider la réponse
        │
        ├── Stocker en cache
        │
        └── Retourner au client
```

---

## Stratégie de Cache

| Type de données | Service | TTL |
|-----------------|---------|-----|
| Alertes sécurité MEAE | Redis | 30 min |
| Alertes FCDO/State Dept | Redis | 30 min |
| Incidents ACLED | Redis | 6h |
| Analyse Perplexity | Redis | 30 min |
| World Bank indicators | Redis | 24h |
| Taux de change | Redis | 1h |
| Coût de vie Numbeo | Redis | 24h |
| Prix vols Amadeus | Redis | 5 min |
| Analyse narrative Claude | Redis | 1h |
| CrisisScore complet | Redis | 30 min |

**Clé de cache standard :**
```
crisis-travel:{service}:{countryCode}:{YYYY-MM-DD-HH}
```

---

## Gestion des Erreurs

### Pattern standard pour chaque service

```typescript
async function fetchWithFallback<T>(
  fetcher: () => Promise<T>,
  fallback: T,
  serviceName: string
): Promise<{ data: T; source: 'live' | 'fallback'; error?: string }> {
  try {
    const data = await Promise.race([
      fetcher(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Timeout')), 5000)
      ),
    ]);
    return { data, source: 'live' };
  } catch (error) {
    console.error(`[${serviceName}] Erreur:`, error);
    return { data: fallback, source: 'fallback', error: String(error) };
  }
}
```

### Timeout global : 5 secondes par service
### Timeout total analyse : 15 secondes

---

## Sécurité

- **Toutes les clés API** sont dans les variables d'environnement, jamais dans le code
- **API Routes Next.js** = exécution server-side uniquement, clés jamais exposées au client
- **Validation Zod** sur toutes les entrées utilisateur (payload `/api/analyze`)
- **Rate limiting** : à implémenter avec Upstash Rate Limit (MVP+)
- **CORS** : configuré dans `next.config.ts` pour n'accepter que les origines connues
- **Headers sécurité** : CSP, X-Frame-Options via `next.config.ts`

---

## Performance

- **Promise.allSettled** : tous les appels APIs d'un pays sont parallèles
- **Promise.all sur les pays** : les 5-10 pays candidats principaux analysés en parallèle
- **Cache agressif** : la plupart des données sont stables 30min-24h
- **Streaming** (optionnel Phase 2) : affichage progressif avec React Suspense

Temps de réponse cible :
- Analyse complète (cache chaud) : < 2 secondes
- Analyse complète (cache froid) : < 10 secondes
- Fiche destination seule : < 1 seconde
