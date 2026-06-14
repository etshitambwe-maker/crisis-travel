import Anthropic from '@anthropic-ai/sdk';
import { withCache, buildCacheKey } from '@/lib/cache/redis';
import { logger } from '@/lib/utils/logger';
import type { CrisisScore, UserProfile, ItineraryRequest, ItineraryResult, BudgetLevel } from '@/types/crisis.types';

// maxRetries: 0 — sans ça, le SDK Anthropic réessaie (jusqu'à 2x) sur timeout/erreur,
// ce qui transformait le timeout de 8s en ~25s d'attente sur le chemin critique
// /api/analyze (GOAL-034). Un échec doit être immédiat ; les fallbacks gèrent la suite.
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, maxRetries: 0 });

/** Budget dur (ms) pour detectOpportunities — au-delà, on renvoie [] et on rend la main. */
const OPPORTUNITIES_HARD_TIMEOUT_MS = 8000;

// 25s : laisse le temps à Claude de générer ~3000 tokens tout en restant sous le
// timeout Vercel de 30s (maxDuration=60 est le plafond du plan, pas une garantie).
// En cas de dépassement, le fallback déterministe est renvoyé — jamais de crash.
// 40s (PREMIUM-GUIDE-001B-timeout) : relevé de 25s, en cohérence avec le passage au
// streaming (évite le timeout HTTP). Reste sous le plafond Vercel maxDuration=60.
const NARRATIVE_HARD_TIMEOUT_MS = 40000;

function buildFallbackNarrative(score: CrisisScore): string {
  const status = score.status === 'ideal' ? 'idéale' :
    score.status === 'recommended' ? 'recommandée' :
    score.status === 'possible' ? 'possible avec précaution' : 'déconseillée';
  const budgetStatus = score.budget.value >= 70 ? 'favorable pour les voyageurs européens' :
    score.budget.value >= 50 ? 'dans la moyenne' : 'élevé pour cette région';
  const geoStatus = score.geopolitical.value >= 70 ? 'stable' :
    score.geopolitical.value >= 50 ? 'globalement stable avec quelques tensions' : 'tendue';

  return `**${score.country}** obtient un CrisisScore de ${score.total}/100, ce qui en fait une destination ${status} au moment de cette analyse.

Sur le plan sécuritaire, le score de ${score.security.value}/100 reflète le niveau d'alerte des sources officielles (MEAE, State Dept, FCDO). La situation géopolitique est ${geoStatus}, avec un indice de stabilité à ${score.geopolitical.value}/100. ${score.geopolitical.details.trend === 'improving' ? "La tendance est à l'amélioration." : score.geopolitical.details.trend === 'deteriorating' ? 'La situation tend à se dégrader — vigilance recommandée.' : 'La situation est stable.'}

Côté budget, le pouvoir d'achat est ${budgetStatus}. La variation du taux de change EUR représente ${score.budget.details.currencyVariation ?? 0}% sur 12 mois. Score budgétaire global : ${score.budget.value}/100.

**Risques résiduels :**
- Vérifiez toujours les dernières alertes officielles sur diplomatie.gouv.fr avant le départ
- Souscrivez une assurance voyage couvrant les rapatriements et les crises politiques
- Consultez les communautés de voyageurs récents pour un retour terrain à jour`;
}

export async function generateDestinationNarrative(
  score: CrisisScore,
  profile: UserProfile
): Promise<string> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return buildFallbackNarrative(score);
  }

  // La clé inclut le travelType : le prompt distingue déjà solo/couple/family/nomad,
  // donc deux profils ne doivent PAS partager la même narrative en cache
  // (ANALYZE-PROFILE-001 — sinon une narrative "solo" est resservie à une famille).
  //
  // Segment de version 'v2' (PREMIUM-EXPERIENCE-001 B) : le prompt narrative a été
  // réécrit en 10 sections (PREMIUM-CONTENT-001). Sans versionner la clé, les anciennes
  // narratives courtes (3 paragraphes) restaient servies jusqu'à expiration du TTL.
  // Bumper ce segment à chaque refonte du prompt force une régénération propre.
  const key = buildCacheKey(
    'claude-narrative',
    score.countryCode,
    String(Math.floor(score.total / 5)),
    profile.travelType,
    'v2',
  );
  try {
    const { data, fromCache } = await withCache(
      key,
      async () => {
        const t0 = Date.now();
        let narrativeTimer: ReturnType<typeof setTimeout> | undefined;
        // STREAMING (PREMIUM-GUIDE-001B-timeout) : même raison que generateItinerary —
        // en non-streamé, l'appel narrative (3000 tokens, 10 sections) dépassait les ~25s
        // et tombait dans buildFallbackNarrative (logs : « narrative hard timeout 25000ms »).
        // Le streaming évite le timeout HTTP. Modèle et max_tokens (3000) inchangés.
        const narrativeStream = client.messages.stream({
              model: 'claude-sonnet-4-6',
              max_tokens: 3000,
              messages: [
                {
                  role: 'user',
                  content: `Tu es un expert indépendant en géopolitique, sécurité des voyages et planification pratique. Rédige une analyse premium structurée de ${score.country} pour un voyageur ${profile.travelType}, budget ${profile.budget}€, durée ${profile.duration} jours.

Données objectives disponibles :
- CrisisScore global : ${score.total}/100 (${score.status})
- Sécurité : ${score.security.value}/100 | Sources officielles : ${score.security.source}
- Géopolitique : ${score.geopolitical.value}/100 | Tendance : ${score.geopolitical.details.trend ?? 'stable'}
- Budget : ${score.budget.value}/100 | Variation EUR/devise locale : ${score.budget.details.currencyVariation ?? 0}% sur 12 mois
- Repas bon marché : ~${score.budget.details.mealCheap ?? 'N/A'}€ | Hôtel moyen : ~${score.budget.details.hotelAvg ?? 'N/A'}€/nuit

Rédige en français une analyse en 10 sections. Chaque section a un titre en gras, des paragraphes courts, des recommandations actionnables. Pas de généralités vides ; pas de promesse de sécurité absolue.

**1. Résumé exécutif**
Verdict clair en 2-3 phrases : est-ce le bon moment pour voyager en ${score.country} ? Pourquoi ?

**2. Situation sécuritaire**
Analyse du score sécurité (${score.security.value}/100). Zones à éviter, zones sûres, risques principaux (criminalité, terrorisme, instabilité). Mention des sources officielles (diplomatie.gouv.fr, Ariane).

**3. Situation géopolitique**
Contexte géopolitique actuel (score ${score.geopolitical.value}/100, tendance : ${score.geopolitical.details.trend ?? 'stable'}). Tensions régionales, relations diplomatiques, impact direct sur le voyageur.

**4. Situation économique et sociale**
Réalité budgétaire sur place : coût de la vie, pouvoir d'achat pour un Européen, variation de change (${score.budget.details.currencyVariation ?? 0}%), repas (~${score.budget.details.mealCheap ?? 'N/A'}€) et hébergement (~${score.budget.details.hotelAvg ?? 'N/A'}€/nuit). Adaptation au budget de ${profile.budget}€ sur ${profile.duration} jours.

**5. Recommandations consulaires et administratives**
Documents requis (visa, passeport), inscription Ariane recommandée, contact ambassade/consulat. Ne jamais inventer d'obligation précise : formuler avec "à vérifier auprès du consulat ou sur diplomatie.gouv.fr".

**6. Santé, vaccins et prévention**
Risques sanitaires connus. Précautions pratiques (eau, nourriture, moustiques). Ne jamais affirmer qu'un vaccin est ou n'est pas obligatoire : indiquer "à vérifier auprès d'un médecin du voyage ou du centre de vaccination international avant le départ". Mentionner les recommandations générales officielles si connues.

**7. Climat, catastrophes naturelles et environnement**
Saisons, périodes à éviter, risques naturels (séismes, cyclones, inondations) si pertinents pour la destination. Adapté à la durée de ${profile.duration} jours.

**8. Déplacements et transports**
Modes de transport disponibles, fiabilité, coût approximatif, précautions (taxis agréés, transports de nuit). Spécificités locales importantes pour un voyageur ${profile.travelType}.

**9. Conseils personnalisés — profil ${profile.travelType}**
Recommandations spécifiques au type de voyage : ${profile.travelType === 'solo' ? 'voyageur solo (sécurité personnelle, réseaux, hébergements adaptés)' : profile.travelType === 'family' ? 'voyage en famille (logistique enfants, infrastructures médicales, activités adaptées)' : profile.travelType === 'couple' ? 'voyage en couple (lieux romantiques, sécurité, budget optimisé)' : profile.travelType === 'nomad' ? 'nomade digital (connectivité, espaces de coworking, visas longue durée)' : 'groupe ou voyage organisé'}. Budget de ${profile.budget}€ sur ${profile.duration} jours : comment l'optimiser ici.

**10. Mises en garde et signaux d'alerte**
3 à 5 points de vigilance concrets, formulés comme liste. Inclure : vérifier les alertes diplomatie.gouv.fr avant le départ, souscrire une assurance couvrant rapatriement et crise politique, s'inscrire sur Ariane.`,
                },
              ],
        });
        const narrativeHardTimeout = new Promise<never>((_, reject) => {
          narrativeTimer = setTimeout(() => {
            narrativeStream.abort();
            reject(new Error(`narrative hard timeout ${NARRATIVE_HARD_TIMEOUT_MS}ms`));
          }, NARRATIVE_HARD_TIMEOUT_MS);
        });
        try {
          const msg = await Promise.race([narrativeStream.finalMessage(), narrativeHardTimeout]);
          // Garde anti-troncature (REPORT-LENGTH-001) : si Claude est coupé au plafond,
          // on lève AVANT le retour — withCache ne mettra donc JAMAIS en cache une
          // narrative tronquée, et le catch ci-dessous renverra le fallback complet.
          if ((msg as { stop_reason?: string }).stop_reason === 'max_tokens') {
            throw new Error('narrative: réponse tronquée (stop_reason=max_tokens)');
          }
          logger.api('Claude', score.countryCode, Date.now() - t0, false);
          return (msg.content[0] as { text: string }).text;
        } finally {
          if (narrativeTimer) clearTimeout(narrativeTimer);
        }
      },
      3600
    );
    logger.api('Claude', score.countryCode, 0, fromCache);
    return data;
  } catch (error) {
    // Fallback narrative construit ICI, HORS withCache → jamais mis en cache (même
    // discipline que l'itinéraire). Sur timeout/troncature/erreur, le narratif déterministe
    // est renvoyé pour ce rendu seulement ; le prochain appel retente Claude.
    logger.error('Claude', error);
    logger.warn(
      'Claude',
      `narrative fallback retourné (NON caché) pour ${score.countryCode} — cause: ${error instanceof Error ? error.message : 'inconnue'}`,
    );
    return buildFallbackNarrative(score);
  }
}

type Opportunity = { countryCode: string; type: string; explanation: string; estimatedSaving: number };

async function fetchOpportunities(scores: CrisisScore[], budget: number): Promise<Opportunity[]> {
  const candidates = scores.filter((s) => s.total >= 55).slice(0, 12);
  const t0 = Date.now();
  const msg = await client.messages.create(
    {
      model: 'claude-sonnet-4-6',
      max_tokens: 500,
      messages: [
        {
          role: 'user',
          content: `Budget voyageur : ${budget}€. Pays avec bon CrisisScore :
${candidates.map((s) => `${s.country} (${s.countryCode}): score=${s.total}, budget=${s.budget.value}, change=${s.budget.details.currencyVariation ?? 0}%`).join('\n')}

Identifie 3 pays avec une opportunité économique exceptionnelle pour un Européen.
Réponds UNIQUEMENT avec ce JSON valide, sans markdown :
[{"countryCode":"XX","type":"currency|cheap_flights|jackpot","explanation":"<1 phrase max>","estimatedSaving":<euros entier>}]`,
        },
      ],
    },
    { timeout: OPPORTUNITIES_HARD_TIMEOUT_MS }
  );
  logger.api('Claude-Opportunities', 'global', Date.now() - t0, false);
  const text = (msg.content[0] as { text: string }).text.trim();
  return JSON.parse(text);
}

// ── Itinerary generation (ITINERARY-002) ─────────────────────────────────────

// 45s (PREMIUM-GUIDE-001B-timeout) : relevé de 30s. Avec le streaming (qui évite le
// timeout HTTP), ce garde-fou interne ne coupe plus que les générations anormalement
// lentes — on lui laisse plus de marge sous le plafond Vercel maxDuration=60.
const ITINERARY_HARD_TIMEOUT_MS = 45000;

// Plancher de diagnostic (PREMIUM-GUIDE-001B) : en dessous, le narrativeText est trop
// maigre pour tenir lieu de « guide » → on logge un warn serveur (jamais d'erreur UI).
// Réglé sous le minimum demandé au prompt (~250 mots) pour ne signaler que les vrais
// déficits, pas les textes correctement longs mais légèrement en deçà de la cible.
const MIN_NARRATIVE_WORDS = 200;

function classifyBudget(amount: number, days: number): BudgetLevel {
  const perDay = amount / days;
  if (perDay < 60) return 'low';
  if (perDay < 150) return 'medium';
  if (perDay < 350) return 'high';
  return 'luxury';
}

function buildItineraryFallback(req: ItineraryRequest, days: number): ItineraryResult {
  const now = new Date().toISOString();
  const country = req.countryName ?? req.countryCode ?? 'cette destination';
  return {
    countryCode: req.countryCode ?? '',
    countryName: req.countryName ?? req.countryCode ?? '',
    cityOrRegion: req.cityOrRegion,
    durationDays: days,
    budget: {
      amount: req.budget ?? 0,
      currency: req.currency ?? 'EUR',
      level: req.budget ? classifyBudget(req.budget, days) : 'medium',
    },
    days: Array.from({ length: days }, (_, i) => ({
      day: i + 1,
      title: `Jour ${i + 1} à ${country}`,
      summary: "Itinéraire temporairement indisponible. Consultez un guide de voyage local.",
      morning: "À planifier selon vos préférences.",
      afternoon: "À planifier selon vos préférences.",
      evening: "À planifier selon vos préférences.",
      estimatedBudget: "Estimation non disponible.",
      safetyNote: "Vérifiez les recommandations officielles sur diplomatie.gouv.fr avant votre départ.",
    })),
    globalAdvice: ["Service temporairement indisponible. Réessayez dans quelques instants."],
    safetyDisclaimer:
      "Cet itinéraire est généré à titre indicatif uniquement. Crisis Travel ne garantit pas l'exactitude ni la sécurité des informations. Consultez diplomatie.gouv.fr et vérifiez les conditions locales avant tout départ.",
    officialSourceReminder:
      "Vérifiez toujours les informations officielles sur diplomatie.gouv.fr avant votre départ.",
    generatedAt: now,
    // Marqueur de repli (PREMIUM-GUIDE-001B-timeout) : ItineraryBlock s'en sert pour
    // rendre un état honnête « génération trop longue + Réessayer » au lieu d'afficher
    // ces jours génériques comme s'ils étaient un itinéraire premium.
    isFallback: true,
  };
}

export async function generateItinerary(req: ItineraryRequest): Promise<ItineraryResult> {
  const country = req.countryName ?? req.countryCode ?? 'destination inconnue';
  const days = req.from && req.to
    ? Math.max(1, Math.ceil((new Date(req.to).getTime() - new Date(req.from).getTime()) / 86400000))
    : 7;
  const budgetAmount = req.budget ?? 1000;
  const currency = req.currency ?? 'EUR';
  const travelers = req.travelers ?? 1;
  const meaeLevel = req.riskContext?.meaeLevel ?? 1;
  const perDay = Math.round(budgetAmount / days);

  // Cible du narratif mise à l'échelle de la durée (PREMIUM-GUIDE-001B) : un séjour long
  // ne doit PAS se contenter de ~250 mots. On exige plus de paragraphes et de mots quand
  // le voyage s'allonge — le narrativeText est le cœur de l'expérience premium, pas une
  // intro. Bornes : court séjour ≈ 6 paragraphes / 280 mots ; long séjour ≈ 10 / 550.
  const narrativeParagraphTarget = days <= 4 ? 6 : days <= 8 ? 7 : days <= 12 ? 8 : 10;
  const narrativeWordTarget = Math.min(600, 250 + days * 30);

  if (!process.env.ANTHROPIC_API_KEY) {
    return buildItineraryFallback(req, days);
  }

  // Segment de version 'narrative-v2' (PREMIUM-GUIDE-001B, stabilisation) : le contrat de
  // génération inclut un narrativeText (rendu PRINCIPAL côté lecteur). Les itinéraires mis
  // en cache AVANT ce GOAL ne contiennent pas ce champ ; sans versionner la clé, ils
  // restaient resservis tels quels pendant tout le TTL (7200s = 2h) → le rendu retombait
  // sur l'ancienne pile de cartes jour/jour alors que le code sait afficher le narratif.
  // Bump v1 → v2 (stabilisation) : invalide d'un coup TOUS les itinéraires « pauvres »
  // cachés sous l'ancienne clé (anciens JSON sans narrativeText, ou résultats générés avant
  // le passage au streaming) — ils ne peuvent plus ressortir. Aucune purge manuelle de Redis.
  const cacheKey = buildCacheKey(
    'itinerary',
    req.countryCode ?? req.countryName ?? 'unknown',
    String(days),
    String(Math.floor(budgetAmount / 100) * 100),
    req.travelType ?? 'solo',
    'narrative-v2',
  );

  const safetyHeader = meaeLevel >= 3
    ? `⚠️ NIVEAU DE VIGILANCE ÉLEVÉ (MEAE ${meaeLevel}/4) : Renforce les avertissements de sécurité à chaque jour. Évite les zones explicitement déconseillées. Rappelle systématiquement les précautions officielles.`
    : meaeLevel === 2
    ? `ℹ️ Vigilance normale (MEAE ${meaeLevel}/4) : Inclure des notes de sécurité pratiques sans dramatisation.`
    : `✅ Destination globalement sûre (MEAE ${meaeLevel}/4) : Rappels sécurité standards.`;

  const dateContext = req.from && req.to
    ? `Dates : du ${req.from} au ${req.to} (${days} jours).`
    : `Durée estimée : ${days} jours (dates non précisées).`;

  const prefContext = req.preferences && req.preferences.length > 0
    ? `Préférences déclarées : ${req.preferences.join(', ')}.`
    : '';

  const travelTypeContext = (() => {
    const t = req.travelType ?? 'solo';
    if (t === 'solo') return 'Voyageur SOLO : sécurité personnelle prioritaire, hébergements sociaux ou centraux, flexibilité maximale, rencontres locales.';
    if (t === 'family') return 'Voyage EN FAMILLE : rythme calme, activités adaptées aux enfants, hébergements spacieux, accès médical à proximité, pas de zones à risque.';
    if (t === 'couple') return 'Voyage EN COUPLE : mix culture + détente, expériences locales authentiques, budget optimisé, quelques moments plus intimistes.';
    if (t === 'nomad') return 'NOMADE DIGITAL : connectivité fiable (wifi, SIM locale), espaces de travail le matin, activités l\'après-midi/soir, hébergements longue durée ou coworking.';
    return `Profil : ${t}.`;
  })();

  const prompt = `Tu es un expert en planification de voyages responsables.

${safetyHeader}

Planifie un itinéraire de voyage COHÉRENT ET PERSONNALISÉ pour les données suivantes :
- Destination : ${country}${req.cityOrRegion ? ` (région/ville ciblée : ${req.cityOrRegion})` : ''}
- ${dateContext}
- Budget total : ${budgetAmount} ${currency} pour ${travelers} voyageur${travelers > 1 ? 's' : ''} (soit ~${perDay} ${currency}/jour)
- Profil voyageur : ${travelTypeContext}
${prefContext}

LOGIQUE DU CIRCUIT (à respecter absolument) :
- Construis un circuit géographiquement cohérent : regroupe les villes/régions proches, évite les allers-retours inutiles.
- Adapte le rythme au profil : ${req.travelType === 'family' ? 'max 2 activités majeures par jour, pauses déjeuner obligatoires' : req.travelType === 'nomad' ? 'matins libres pour le travail, après-midis/soirées pour les sorties' : 'rythme dynamique mais réaliste, pas plus de 3-4 lieux majeurs par jour'}.
- Pour chaque jour, précise dans "morning"/"afternoon"/"evening" : lieu(x) visités, type d'activité, conseil pratique, moyen de transport depuis la veille si changement de ville.
- Dans "safetyNote" : conseil sécurité spécifique au lieu de ce jour (pas une phrase générique répétée).
- Dans "estimatedBudget" : estimation réaliste pour ce jour (transport local + activités + repas), cohérente avec ~${perDay} ${currency}/jour.
- Dans "globalAdvice" : 4 à 6 conseils pratiques actionnables (transport inter-villes, SIM locale, paiement, alternatives si météo défavorable, zones à éviter, checklist pré-départ).

═══════════════════════════════════════════════════════════════════════════════
TEXTE DE GUIDE NARRATIF — champ "narrativeText" : C'EST LE LIVRABLE PRINCIPAL.
═══════════════════════════════════════════════════════════════════════════════
C'est CE texte que le voyageur lit en premier et qui justifie le caractère premium de
l'itinéraire. Les "days" structurés plus bas sont SECONDAIRES (un détail repliable) :
ne bâcle JAMAIS le narrativeText pour soigner les "days". Mets-y le meilleur de ton
expertise de guide.

Voix et ton :
- Écris comme un conseiller de voyage humain et expérimenté qui parle DIRECTEMENT au
  voyageur : tutoiement, ton chaleureux mais sobre, jamais marketing ni administratif.
- Emploie naturellement des formulations de guide qui prend position, par exemple :
  « je te conseille de… », « j'éviterais… », « le bon compromis, c'est… »,
  « le rythme le plus intelligent ici… », « si tu voyages ${req.travelType === 'family' ? 'en famille' : req.travelType === 'couple' ? 'en couple' : req.travelType === 'nomad' ? 'en nomade' : 'en solo'}… ».
- Reste au conditionnel pour les activités (« tu pourrais », « les marchés proposent
  généralement ») : n'invente ni prix garantis, ni horaires, ni adresses précises, ni
  numéros, ni sources officielles fictives.

Contenu OBLIGATOIRE (le texte DÉCOULE des jours ci-dessous — mêmes étapes, même circuit —
mais les RACONTE en prose, sans les recopier en liste matin/après-midi/soir) :
- Nomme les VILLES / RÉGIONS / QUARTIERS réels du circuit quand c'est pertinent, et
  EXPLIQUE POURQUOI chaque étape est recommandée (ce qu'on y gagne, à qui ça convient).
- Soigne les TRANSITIONS entre étapes : comment et pourquoi on passe de l'une à l'autre,
  dans quel ordre, à quel moment basculer.
- Donne un vrai conseil de RYTHME adapté au profil ${req.travelType ?? 'solo'} : où ralentir,
  où densifier, ce qu'il ne faut PAS surcharger.
- Propose des ALTERNATIVES concrètes selon les aléas : fatigue, météo défavorable, budget
  serré${req.travelType === 'family' ? ', enfants fatigués' : ''}, transports compliqués.
- Intègre les PRÉCAUTIONS sécurité cohérentes avec le niveau MEAE ${meaeLevel}/4, sans
  dramatiser ni promettre une sécurité absolue, en rappelant de vérifier diplomatie.gouv.fr.
- Intègre explicitement le pays (${country}), la durée (${days} jours), le budget
  (~${perDay} ${currency}/jour) et le profil ${req.travelType ?? 'solo'}.

Longueur et structure (NON négociables — adaptées à un séjour de ${days} jours) :
- AU MOINS ${narrativeParagraphTarget} paragraphes nourris, soit environ ${narrativeWordTarget} mots minimum.
  Un séjour long EXIGE plus de matière : ne te contente pas d'une intro courte.
- Titres en gras markdown "**Titre**", paragraphes séparés par une LIGNE VIDE. Tu peux
  réutiliser/adapter cette ossature et la développer (un titre peut couvrir plusieurs
  paragraphes si le séjour est long) :
  **Le fil conducteur du séjour** — l'esprit du voyage et la logique d'ensemble du circuit.
  **Comment démarrer** — un premier ou deux jours en douceur (prendre ses repères, limiter
  les transports au début), et pourquoi.
  **Le bon rythme à adopter** — spécifique au profil ${req.travelType ?? 'solo'}.
  **Les grandes étapes, et pourquoi** — le cœur du parcours, étape par étape, avec les
  raisons de chaque choix et les transitions.
  **Si ça se complique** — alternatives en cas de fatigue, météo, budget${req.travelType === 'family' ? ', enfants' : ''} ou transport.
  **Les précautions à garder en tête** — vigilance sécurité concrète (MEAE ${meaeLevel}/4).
  **Mon conseil final de guide** — 2-3 phrases de conclusion pratique et encourageante.

RÈGLES ABSOLUES :
1. Ne prétends PAS accéder à des données en temps réel (prix de vols, météo live, disponibilités).
2. N'invente aucune source officielle ni chiffre de sécurité précis.
3. Ne promets pas de sécurité absolue.
4. Formule les activités au conditionnel : "vous pourriez visiter", "les marchés proposent généralement".
5. N'inclus aucun numéro de téléphone, adresse précise ou prix garantis.
6. Si niveau MEAE ${meaeLevel} >= 3, intègre des avertissements de sécurité renforcés à chaque jour et propose des alternatives aux zones sensibles.
7. Inclus dans globalAdvice : vérifier diplomatie.gouv.fr avant le départ et s'inscrire sur Ariane.

Réponds UNIQUEMENT avec ce JSON valide (sans markdown, sans backticks) :
{
  "narrativeText": "**Le fil conducteur du séjour**\n\n... (texte de guide narratif fluide, paragraphes séparés par \\n\\n, titres en gras)",
  "days": [
    {
      "day": 1,
      "title": "...",
      "summary": "...",
      "morning": "...",
      "afternoon": "...",
      "evening": "...",
      "estimatedBudget": "...",
      "safetyNote": "..."
    }
  ],
  "globalAdvice": ["...", "..."],
  "safetyDisclaimer": "...",
  "officialSourceReminder": "Vérifiez toujours les informations officielles sur diplomatie.gouv.fr avant votre départ."
}

Génère exactement ${days} jours dans le tableau "days". Le champ "narrativeText" est le LIVRABLE PRINCIPAL : OBLIGATOIRE, au moins ${narrativeParagraphTarget} paragraphes (~${narrativeWordTarget} mots minimum), ton de guide humain. Un narrativeText court, générique ou réduit à une intro est un échec : c'est lui que le voyageur lit en premier.`;

  try {
    const { data } = await withCache(
      cacheKey,
      async () => {
        const t0 = Date.now();
        let timer: ReturnType<typeof setTimeout> | undefined;

        // STREAMING (PREMIUM-GUIDE-001B-timeout) : en NON-streamé, un appel de 8000 tokens
        // de JSON dépasse régulièrement les ~30s et heurte le timeout HTTP du SDK → la prod
        // tombait systématiquement dans buildItineraryFallback (logs : « itinerary hard
        // timeout 30000ms »). Le SDK Anthropic recommande explicitement le streaming pour
        // tout gros max_tokens : il évite les timeouts de requête. On garde le MÊME modèle
        // et le MÊME max_tokens (8000) — seul le transport change.
        const stream = client.messages.stream({
          model: 'claude-sonnet-4-6',
          max_tokens: 8000,
          messages: [{ role: 'user', content: prompt }],
        });

        // Hard timeout INTERNE relevé à 45s (plafond Vercel maxDuration=60). Le streaming
        // évite le timeout HTTP ; ce garde-fou coupe seulement une génération anormalement
        // lente, en abortant proprement le stream pour ne pas laisser fuir la connexion.
        const hardTimeout = new Promise<never>((_, reject) => {
          timer = setTimeout(() => {
            stream.abort();
            reject(new Error(`itinerary hard timeout ${ITINERARY_HARD_TIMEOUT_MS}ms`));
          }, ITINERARY_HARD_TIMEOUT_MS);
        });

        try {
          const msg = await Promise.race([stream.finalMessage(), hardTimeout]);
          // Garde anti-troncature : si la réponse est coupée au plafond, on lève AVANT
          // le retour. withCache ne mettra donc PAS en cache un JSON tronqué (qui serait
          // resservi cassé pendant 2h), et le catch renverra le fallback contrôlé loggué.
          if ((msg as { stop_reason?: string }).stop_reason === 'max_tokens') {
            throw new Error('itinerary: réponse tronquée (stop_reason=max_tokens)');
          }
          const text = (msg.content[0] as { text: string }).text;
          // VALIDATION AVANT CACHE (PREMIUM-GUIDE-001B stabilisation) : on parse et on
          // vérifie la structure ICI, dans le fetcher. Si le JSON est malformé ou sans
          // `days`, on throw AVANT le return → withCache ne stocke RIEN (le catch renverra
          // un fallback honnête NON caché). Sans ça, une string non-JSON (« pas du json »)
          // était mise en cache 2h : chaque appel suivant la relisait, re-throwait au parse
          // et reservait le fallback pendant 2h au lieu de retenter un appel Claude frais.
          const parsedInFetcher = JSON.parse(text) as { days?: unknown };
          if (!Array.isArray(parsedInFetcher.days) || parsedInFetcher.days.length === 0) {
            throw new Error('itinerary: malformed response — no days array');
          }
          logger.api('Claude-Itinerary', req.countryCode ?? 'unknown', Date.now() - t0, false);
          return text;
        } finally {
          if (timer) clearTimeout(timer);
        }
      },
      7200 // 2h cache
    );

    // `data` est garanti parsable et muni d'un `days` non vide (validé dans le fetcher
    // ci-dessus AVANT toute mise en cache) : ce JSON.parse ne peut donc plus empoisonner
    // le cache. On re-parse simplement pour extraire les champs typés.
    const parsed = JSON.parse(data) as {
      narrativeText?: string;
      days: ItineraryResult['days'];
      globalAdvice: string[];
      safetyDisclaimer: string;
      officialSourceReminder: string;
    };

    // narrativeText (PREMIUM-GUIDE-001B) : champ optionnel CÔTÉ TYPE (rétro-compat), mais
    // ATTENDU comme substantiel pour toute génération fraîche — c'est le rendu PRINCIPAL.
    // On ne le retient que si c'est une string non vide ; sinon `undefined`, et
    // ItineraryBlock retombe proprement sur le rendu jour/jour. Le JSON `days` reste la
    // source d'autorité (PDF, compatibilité), donc un narrativeText absent n'invalide rien.
    const rawNarrative =
      typeof parsed.narrativeText === 'string' ? parsed.narrativeText.trim() : '';
    const narrativeText = rawNarrative.length > 0 ? rawNarrative : undefined;

    // Diagnostic dev (PREMIUM-GUIDE-001B, point 5) : une génération fraîche qui revient
    // SANS narrativeText, ou avec un texte trop court pour un vrai guide, est un échec
    // produit silencieux (le lecteur ne verra que les cartes). On le SIGNALE côté serveur
    // (logger.warn) pour le détecter en dev/test/logs — JAMAIS d'erreur anxiogène à
    // l'utilisateur, JAMAIS d'exception : le rendu jour/jour reste un repli gracieux.
    const narrativeWordCount = narrativeText ? narrativeText.split(/\s+/).length : 0;
    if (narrativeWordCount < MIN_NARRATIVE_WORDS) {
      logger.warn(
        'Claude-Itinerary',
        `narrativeText insuffisant (${narrativeWordCount} mots < ${MIN_NARRATIVE_WORDS}) pour ${req.countryCode ?? req.countryName ?? 'unknown'} — rendu jour/jour en repli. Vérifier le prompt/modèle.`,
      );
    }

    return {
      countryCode: req.countryCode ?? '',
      countryName: req.countryName ?? req.countryCode ?? '',
      cityOrRegion: req.cityOrRegion,
      durationDays: days,
      budget: {
        amount: budgetAmount,
        currency,
        level: classifyBudget(budgetAmount, days),
      },
      narrativeText,
      days: parsed.days,
      globalAdvice: Array.isArray(parsed.globalAdvice) ? parsed.globalAdvice : [],
      safetyDisclaimer: parsed.safetyDisclaimer ??
        "Cet itinéraire est généré à titre indicatif. Vérifiez les conditions locales et les recommandations officielles avant tout départ.",
      officialSourceReminder: parsed.officialSourceReminder ??
        "Vérifiez toujours les informations officielles sur diplomatie.gouv.fr avant votre départ.",
      generatedAt: new Date().toISOString(),
    };
  } catch (error) {
    // REPLI HONNÊTE NON CACHÉ (PREMIUM-GUIDE-001B, stabilisation) : on arrive ici sur
    // timeout (le hard timeout a déjà aborté le stream), réponse tronquée (stop_reason
    // max_tokens), JSON malformé/sans days, ou erreur réseau. Le fallback est construit
    // ICI, HORS du `withCache` ci-dessus → il n'est JAMAIS mis en cache : aucun « faux
    // itinéraire » ne peut être resservi pendant 2h. La prochaine génération réessaie un
    // appel Claude frais. Le flag isFallback (posé par buildItineraryFallback) permet à
    // l'UI d'afficher un état honnête « génération trop longue » au lieu des fausses cartes.
    logger.error('Claude-Itinerary', error);
    logger.warn(
      'Claude-Itinerary',
      `fallback honnête retourné (NON caché) pour ${req.countryCode ?? req.countryName ?? 'unknown'} — cause: ${error instanceof Error ? error.message : 'inconnue'}`,
    );
    return buildItineraryFallback(req, days);
  }
}

// ─────────────────────────────────────────────────────────────────────────────

export async function detectOpportunities(
  scores: CrisisScore[],
  budget: number
): Promise<Opportunity[]> {
  if (!process.env.ANTHROPIC_API_KEY) return [];

  // Double verrou (GOAL-034) : maxRetries:0 sur le client + Promise.race hard ici.
  // Même si le SDK déborde son propre timeout, /api/analyze récupère la main au plus
  // tard à OPPORTUNITIES_HARD_TIMEOUT_MS et renvoie [] — les destinations restent
  // affichées, seul le bloc « opportunités » est omis.
  let timer: ReturnType<typeof setTimeout> | undefined;
  const hardTimeout = new Promise<Opportunity[]>((resolve) => {
    timer = setTimeout(() => {
      logger.error('Claude-Opportunities', new Error(`hard timeout ${OPPORTUNITIES_HARD_TIMEOUT_MS}ms — fallback []`));
      resolve([]);
    }, OPPORTUNITIES_HARD_TIMEOUT_MS);
  });

  try {
    return await Promise.race([
      fetchOpportunities(scores, budget).catch((error) => {
        logger.error('Claude-Opportunities', error);
        return [] as Opportunity[];
      }),
      hardTimeout,
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
