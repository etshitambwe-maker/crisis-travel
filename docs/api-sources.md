# API Sources — Documentation Technique

## Vue d'ensemble

Ce document liste toutes les APIs externes intégrées dans Crisis Travel, avec les détails d'implémentation, les endpoints utilisés, et les stratégies de fallback.

---

## 1. France Diplomatie — MEAE

| Champ | Valeur |
|-------|--------|
| **Usage** | Alertes sécurité officielles françaises par pays |
| **URL de base** | `https://www.diplomatie.gouv.fr/fr/conseils-aux-voyageurs/` |
| **Auth** | Aucune (scraping RSS) |
| **Format** | RSS/XML |
| **TTL cache** | 30 minutes |
| **Coût** | Gratuit |
| **Docs** | https://www.diplomatie.gouv.fr/fr/conseils-aux-voyageurs/ |

**Endpoint principal :**
```
GET https://www.diplomatie.gouv.fr/fr/conseils-aux-voyageurs/conseils-par-pays-destination/[pays]/
```

**Structure RSS :**
```xml
<item>
  <title>Thaïlande - Sécurité</title>
  <description>Vigilance normale</description>
  <level>1</level>
</item>
```

**Fallback :** UK FCDO + US State Department si indisponible.

**Note implémentation :** Parser le HTML/RSS avec `xml2js`. Les niveaux d'alerte sont dans les balises `<level>` ou dans le texte de la description à parser avec regex.

---

## 2. UK FCDO Travel Advice

| Champ | Valeur |
|-------|--------|
| **Usage** | Alertes sécurité britanniques (validation croisée) |
| **URL de base** | `https://www.gov.uk/foreign-travel-advice` |
| **Auth** | Aucune |
| **Format** | RSS + JSON API |
| **TTL cache** | 30 minutes |
| **Coût** | Gratuit |
| **Docs** | https://www.gov.uk/foreign-travel-advice |

**Endpoint RSS :**
```
GET https://www.gov.uk/foreign-travel-advice/[country-slug].atom
```

**Endpoint JSON (GOV.UK Content API) :**
```
GET https://www.gov.uk/api/content/foreign-travel-advice/[country-slug]
```

**Fallback :** Valeur neutre (50) si indisponible.

---

## 3. US State Department Travel Advisory

| Champ | Valeur |
|-------|--------|
| **Usage** | Niveaux d'alerte américains (1-4) |
| **URL de base** | `https://travel.state.gov` |
| **Auth** | Aucune (API publique) |
| **Format** | JSON |
| **TTL cache** | 1 heure |
| **Coût** | Gratuit |
| **Docs** | https://travel.state.gov/content/travel/en/travelinformationsheetxml.html |

**Endpoint :**
```
GET https://travel.state.gov/content/dam/NEWTravelAssets/pdfs/travel-advisories.pdf
```

**Alternative (scraping) :**
```
GET https://travel.state.gov/content/travel/en/travelinformationsheetxml.html
```

**Structure réponse (XML) :**
```xml
<TravelAdvisory>
  <CountryName>Thailand</CountryName>
  <AdvisoryLevel>1</AdvisoryLevel>
  <LastUpdated>2024-01-15</LastUpdated>
</TravelAdvisory>
```

**Fallback :** UK FCDO si indisponible.

---

## 4. ACLED — Armed Conflict Location & Event Data

| Champ | Valeur |
|-------|--------|
| **Usage** | Conflits armés géolocalisés, incidents 30 derniers jours |
| **URL de base** | `https://api.acleddata.com` |
| **Auth** | Email + Access Key (inscription gratuite) |
| **Format** | JSON |
| **TTL cache** | 6 heures |
| **Coût** | Gratuit avec inscription |
| **Docs** | https://acleddata.com/acleddatanew/wp-content/uploads/2021/11/ACLED_API-User-Guide_2021.pdf |
| **Inscription** | https://developer.acleddata.com |

**Endpoint :**
```
GET https://api.acleddata.com/acled/read
  ?key={ACCESS_KEY}
  &email={EMAIL}
  &country={COUNTRY_NAME}
  &event_date={DATE_START}|{DATE_END}
  &event_date_where=BETWEEN
  &event_type=Battles|Explosions/Remote violence|Violence against civilians
  &fields=event_date,event_type,fatalities,country
  &limit=500
```

**Structure réponse :**
```json
{
  "status": 200,
  "count": 15,
  "data": [
    {
      "event_date": "2024-01-10",
      "event_type": "Battles",
      "fatalities": 3,
      "country": "Sudan"
    }
  ]
}
```

**Fallback :** Score 50 (neutre) si indisponible. Flag `acled_unavailable: true`.

---

## 5. ReliefWeb — OCHA

| Champ | Valeur |
|-------|--------|
| **Usage** | Crises humanitaires actives par pays |
| **URL de base** | `https://api.reliefweb.int` |
| **Auth** | Aucune |
| **Format** | JSON |
| **TTL cache** | 2 heures |
| **Coût** | Gratuit |
| **Docs** | https://apidoc.reliefweb.int |

**Endpoint :**
```
POST https://api.reliefweb.int/v1/reports?appname=crisis-travel
Content-Type: application/json

{
  "filter": {
    "operator": "AND",
    "conditions": [
      {"field": "country.iso3", "value": "THA"},
      {"field": "date.created", "value": {"from": "now-30d"}}
    ]
  },
  "fields": {"include": ["title", "date", "status"]},
  "limit": 10
}
```

**Fallback :** Score 100 (pas de crise détectée) si indisponible.

---

## 6. Perplexity Sonar API

| Champ | Valeur |
|-------|--------|
| **Usage** | Analyse géopolitique temps réel, actualité mondiale |
| **URL de base** | `https://api.perplexity.ai` |
| **Auth** | Bearer Token (API Key) |
| **Format** | JSON (OpenAI-compatible) |
| **TTL cache** | 30 minutes |
| **Coût** | Payant à l'usage (~$5/1M tokens) |
| **Docs** | https://docs.perplexity.ai |
| **Inscription** | https://www.perplexity.ai/api |

**Endpoint :**
```
POST https://api.perplexity.ai/chat/completions
Authorization: Bearer {PERPLEXITY_API_KEY}

{
  "model": "sonar",
  "messages": [
    {
      "role": "user",
      "content": "Analyse géopolitique de [PAYS] pour un voyageur en [DATE]..."
    }
  ],
  "max_tokens": 500
}
```

**Fallback :** Claude API seul (sans données temps réel) si indisponible.

---

## 7. World Bank API

| Champ | Valeur |
|-------|--------|
| **Usage** | Indicateurs de gouvernance (stabilité politique, état de droit) |
| **URL de base** | `https://api.worldbank.org/v2` |
| **Auth** | Aucune |
| **Format** | JSON |
| **TTL cache** | 24 heures (données annuelles) |
| **Coût** | Gratuit |
| **Docs** | https://datahelpdesk.worldbank.org/knowledgebase/articles/889392 |

**Endpoints utilisés :**
```
# Stabilité politique
GET https://api.worldbank.org/v2/country/{CODE}/indicator/PV.EST?format=json&mrv=1

# État de droit
GET https://api.worldbank.org/v2/country/{CODE}/indicator/RL.EST?format=json&mrv=1

# Efficacité gouvernement
GET https://api.worldbank.org/v2/country/{CODE}/indicator/GE.EST?format=json&mrv=1
```

**Structure réponse :**
```json
[
  {"page": 1, "pages": 1, "per_page": 50, "total": 1},
  [{"countryiso3code": "THA", "date": "2022", "value": 0.15}]
]
```

**Fallback :** Score 50 si pays non trouvé ou données manquantes.

---

## 8. GDELT Project

| Champ | Valeur |
|-------|--------|
| **Usage** | Analyse du ton médiatique mondial sur un pays |
| **URL de base** | `https://api.gdeltproject.org` |
| **Auth** | Aucune |
| **Format** | JSON/CSV |
| **TTL cache** | 1 heure |
| **Coût** | Gratuit |
| **Docs** | https://blog.gdeltproject.org/gdelt-doc-2-0-api-debuts/ |

**Endpoint Doc 2.0 :**
```
GET https://api.gdeltproject.org/api/v2/doc/doc
  ?query={COUNTRY_NAME}+sourcelang:French+OR+sourcelang:English
  &mode=ArtList
  &maxrecords=25
  &startdatetime={DATE-7j}000000
  &enddatetime={DATE}235959
  &format=json
```

**Note :** L'API retourne des articles. Le "tone" est dans les métadonnées GDELT GKG (Global Knowledge Graph), endpoint séparé. Utiliser l'endpoint TV API ou News API pour le tone agrégé.

**Fallback :** Score 50 (neutre) si indisponible.

---

## 9. Frankfurter API — Taux de Change

| Champ | Valeur |
|-------|--------|
| **Usage** | Taux de change EUR → monnaie locale |
| **URL de base** | `https://api.frankfurter.app` |
| **Auth** | Aucune |
| **Format** | JSON |
| **TTL cache** | 1 heure |
| **Coût** | Gratuit |
| **Docs** | https://www.frankfurter.app/docs |

**Endpoints :**
```
# Taux actuel EUR → TRY
GET https://api.frankfurter.app/latest?from=EUR&to=TRY

# Historique 12 mois pour comparaison
GET https://api.frankfurter.app/2023-01-01..2024-01-01?from=EUR&to=TRY
```

**Structure réponse :**
```json
{
  "amount": 1.0,
  "base": "EUR",
  "date": "2024-01-15",
  "rates": {"TRY": 32.45}
}
```

**Fallback :** Score 50 si devise non trouvée. Couvrir les principales devises hardcodées.

---

## 10. Numbeo API — Coût de Vie

| Champ | Valeur |
|-------|--------|
| **Usage** | Coût de vie, prix hébergement, restaurants par ville |
| **URL de base** | `https://www.numbeo.com/api` |
| **Auth** | API Key |
| **Format** | JSON |
| **TTL cache** | 24 heures |
| **Coût** | Freemium (plan gratuit limité) |
| **Docs** | https://www.numbeo.com/api/doc.jsp |
| **Inscription** | https://www.numbeo.com/api/ |

**Endpoints :**
```
# Indices de coût de vie
GET https://www.numbeo.com/api/city_prices
  ?api_key={KEY}
  &city={CITY_NAME}
  &currency=EUR

# Coût de vie par pays
GET https://www.numbeo.com/api/country_prices
  ?api_key={KEY}
  &country={COUNTRY_NAME}
```

**Structure réponse :**
```json
{
  "name": "Bangkok, Thailand",
  "currency": "EUR",
  "contributors12months": 1250,
  "prices": [
    {"item_id": 1, "item_name": "Meal, Inexpensive Restaurant", "average_price": 3.5}
  ]
}
```

**Items pertinents :** Repas (ID 1, 2), Hôtel 3* (ID 26), Transport (ID 20, 21).

**Fallback :** Données statiques hardcodées pour top 50 pays si API indisponible.

---

## 11. Amadeus for Developers — Vols

| Champ | Valeur |
|-------|--------|
| **Usage** | Prix vols en temps réel, disponibilité |
| **URL de base** | `https://test.api.amadeus.com` (sandbox) / `https://api.amadeus.com` (prod) |
| **Auth** | OAuth 2.0 (Client Credentials) |
| **Format** | JSON |
| **TTL cache** | 5 minutes (prix volatils) |
| **Coût** | Freemium (sandbox gratuit, prod payant à l'usage) |
| **Docs** | https://developers.amadeus.com/self-service |
| **Inscription** | https://developers.amadeus.com |

**Auth :**
```
POST https://test.api.amadeus.com/v1/security/oauth2/token
Content-Type: application/x-www-form-urlencoded

grant_type=client_credentials&client_id={KEY}&client_secret={SECRET}
```

**Endpoint recherche vols :**
```
GET https://test.api.amadeus.com/v2/shopping/flight-offers
  ?originLocationCode=CDG
  &destinationLocationCode=BKK
  &departureDate=2024-03-15
  &adults=1
  &currencyCode=EUR
  &max=5
```

**Fallback :** Estimation statique basée sur distance + données historiques si indisponible.

**Note MVP :** Intégrer en Phase 2. Pour le MVP, utiliser des estimations basées sur Numbeo + données publiques.

---

## 12. Booking.com Affiliate API

| Champ | Valeur |
|-------|--------|
| **Usage** | Prix et disponibilité hébergement |
| **URL de base** | `https://distribution-xml.booking.com` |
| **Auth** | Affiliate ID + API Key |
| **Format** | JSON/XML |
| **TTL cache** | 30 minutes |
| **Coût** | Gratuit (commission sur réservations) |
| **Docs** | https://developers.booking.com |
| **Inscription** | https://join.booking.com/affiliates |

**Note MVP :** Intégrer en Phase 2 après validation du modèle d'affiliation.

**Fallback MVP :** Lien de recherche Booking.com généré avec paramètres (sans API directe).

---

## 13. Anthropic Claude API

| Champ | Valeur |
|-------|--------|
| **Usage** | Analyse narrative, recommandations, détection opportunités |
| **URL de base** | `https://api.anthropic.com` |
| **Auth** | API Key (header `x-api-key`) |
| **Format** | JSON |
| **TTL cache** | 1 heure (même destination + profil = même réponse) |
| **Coût** | Pay-per-use (~$3/1M input tokens, $15/1M output tokens — Sonnet) |
| **Docs** | https://docs.anthropic.com |

**Endpoint :**
```
POST https://api.anthropic.com/v1/messages
x-api-key: {ANTHROPIC_API_KEY}
anthropic-version: 2023-06-01

{
  "model": "claude-sonnet-4-6",
  "max_tokens": 1024,
  "messages": [{"role": "user", "content": "..."}]
}
```

**Fallback :** Message générique basé sur les données brutes si API indisponible.

---

## Résumé des Inscriptions Requises

| API | Inscription | Délai | Priorité MVP |
|-----|------------|-------|-------------|
| ACLED | https://developer.acleddata.com | 24-48h | Haute |
| Amadeus | https://developers.amadeus.com | Immédiat | Phase 2 |
| Numbeo | https://www.numbeo.com/api | Immédiat | Haute |
| Perplexity | https://www.perplexity.ai/api | Immédiat | Haute |
| Anthropic | https://console.anthropic.com | Immédiat | Critique |
| Booking | https://join.booking.com | 1-7 jours | Phase 2 |
| Supabase | https://supabase.com | Immédiat | Critique |
| Upstash | https://upstash.com | Immédiat | Haute |

**APIs gratuites sans inscription :** Frankfurter, World Bank, ReliefWeb, GDELT, MEAE (RSS), FCDO (RSS), State Dept.
