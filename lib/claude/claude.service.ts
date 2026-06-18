import Anthropic from '@anthropic-ai/sdk';
import { withCache, buildCacheKey } from '@/lib/cache/redis';
import { logger } from '@/lib/utils/logger';
import type { CrisisScore, UserProfile, ItineraryRequest, ItineraryResult, BudgetLevel, PremiumCountryGuide } from '@/types/crisis.types';
import type { PerplexityCountryFacts } from '@/types/api.types';

// ── AI Cost tracking helpers (AI-COST-001) ────────────────────────────────────

// Tarifs indicatifs claude-sonnet-4-6 (USD / million de tokens).
// Mis à jour si le modèle change — la valeur surestimée est préférable à
// une sous-estimation qui masque un coût réel.
const SONNET_INPUT_COST_PER_M  = 3.0;   // $3 / 1M input tokens
const SONNET_OUTPUT_COST_PER_M = 15.0;  // $15 / 1M output tokens

export function estimateAnthropicCostUsd(
  model: string,
  inputTokens: number,
  outputTokens: number,
): number {
  // Tarifs connus pour claude-sonnet-4-x. Pour tout autre modèle on applique
  // les tarifs Sonnet (conservateur) plutôt que de retourner 0.
  const inputRate  = model.includes('haiku') ? 0.8  : SONNET_INPUT_COST_PER_M;
  const outputRate = model.includes('haiku') ? 4.0  : SONNET_OUTPUT_COST_PER_M;
  const cost = (inputTokens * inputRate + outputTokens * outputRate) / 1_000_000;
  // Arrondi à 6 décimales pour éviter les flottants parasites dans les logs.
  return Math.round(cost * 1_000_000) / 1_000_000;
}

type AiUsageLogParams = {
  service: string;
  provider: 'anthropic';
  model: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCostUsd: number;
  durationMs: number;
  cacheHit: boolean;
  countryCode?: string;
  travelType?: string;
  stopReason?: string;
  fallbackUsed?: boolean;
  errorCategory?: string;
};

// Actif en production sans dépendre du flag ENABLE_API_LOGS (coûts = signal critique).
export function logAiUsageSafe(params: AiUsageLogParams): void {
  console.log('[AI Usage]', params);
}

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
          const usageMsg = msg as { usage?: { input_tokens?: number; output_tokens?: number }; model?: string; stop_reason?: string };
          const inputTokens  = usageMsg.usage?.input_tokens  ?? 0;
          const outputTokens = usageMsg.usage?.output_tokens ?? 0;
          const narrativeModel = usageMsg.model ?? 'claude-sonnet-4-6';
          logAiUsageSafe({
            service: 'claude-narrative',
            provider: 'anthropic',
            model: narrativeModel,
            inputTokens,
            outputTokens,
            totalTokens: inputTokens + outputTokens,
            estimatedCostUsd: estimateAnthropicCostUsd(narrativeModel, inputTokens, outputTokens),
            durationMs: Date.now() - t0,
            cacheHit: false,
            countryCode: score.countryCode,
            travelType: profile.travelType,
            stopReason: usageMsg.stop_reason ?? 'end_turn',
          });
          logger.api('Claude', score.countryCode, Date.now() - t0, false);
          return (msg.content[0] as { text: string }).text;
        } finally {
          if (narrativeTimer) clearTimeout(narrativeTimer);
        }
      },
      3600
    );
    if (fromCache) {
      logAiUsageSafe({
        service: 'claude-narrative',
        provider: 'anthropic',
        model: 'claude-sonnet-4-6',
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        estimatedCostUsd: 0,
        durationMs: 0,
        cacheHit: true,
        countryCode: score.countryCode,
        travelType: profile.travelType,
      });
    }
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
  const usageOpp = msg as { usage?: { input_tokens?: number; output_tokens?: number }; model?: string };
  const oppInputTokens  = usageOpp.usage?.input_tokens  ?? 0;
  const oppOutputTokens = usageOpp.usage?.output_tokens ?? 0;
  const oppModel = usageOpp.model ?? 'claude-sonnet-4-6';
  logAiUsageSafe({
    service: 'claude-opportunities',
    provider: 'anthropic',
    model: oppModel,
    inputTokens: oppInputTokens,
    outputTokens: oppOutputTokens,
    totalTokens: oppInputTokens + oppOutputTokens,
    estimatedCostUsd: estimateAnthropicCostUsd(oppModel, oppInputTokens, oppOutputTokens),
    durationMs: Date.now() - t0,
    cacheHit: false,
  });
  logger.api('Claude-Opportunities', 'global', Date.now() - t0, false);
  const text = (msg.content[0] as { text: string }).text.trim();
  return JSON.parse(text);
}

// ── Itinerary generation (ITINERARY-002) ─────────────────────────────────────

// 45s (PREMIUM-GUIDE-001B-timeout) : relevé de 30s. Avec le streaming (qui évite le
// timeout HTTP), ce garde-fou interne ne coupe plus que les générations anormalement
// lentes — on lui laisse plus de marge sous le plafond Vercel maxDuration=60.
const ITINERARY_HARD_TIMEOUT_MS = 45000;

// Plancher du guide (GUIDE-V1) : en dessous, le texte est trop maigre pour tenir lieu de
// « guide » premium → on rejette (throw dans le fetcher) AVANT toute mise en cache, et le
// catch renvoie un fallback honnête. Réglé sous le minimum demandé au prompt pour ne
// rejeter que les vrais déficits, pas les textes corrects légèrement en deçà de la cible.
// GUIDE-V2 (anti-timeout) : cible revue à 250-400 mots → plancher abaissé 200 → 180 en
// cohérence, pour ne rejeter que les vrais déficits face à la nouvelle cible plus courte.
const MIN_NARRATIVE_WORDS = 180;

function classifyBudget(amount: number, days: number): BudgetLevel {
  const perDay = amount / days;
  if (perDay < 60) return 'low';
  if (perDay < 150) return 'medium';
  if (perDay < 350) return 'high';
  return 'luxury';
}

function buildItineraryFallback(req: ItineraryRequest, days: number): ItineraryResult {
  const now = new Date().toISOString();
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
    // GUIDE-V1 : l'itinéraire premium est un TEXTE guide (narrativeText), plus une grille
    // jour/matin/après-midi/soir. Le repli ne fabrique donc PLUS de fausses cartes « À
    // planifier » : days reste vide, narrativeText absent. ItineraryBlock détecte ce repli
    // via isFallback et rend un état honnête « génération trop longue » + Réessayer.
    days: [],
    globalAdvice: [],
    safetyDisclaimer:
      "Cet itinéraire est généré à titre indicatif uniquement. Crisis Travel ne garantit pas l'exactitude ni la sécurité des informations. Consultez diplomatie.gouv.fr et vérifiez les conditions locales avant tout départ.",
    officialSourceReminder:
      "Vérifiez toujours les informations officielles sur diplomatie.gouv.fr avant votre départ.",
    generatedAt: now,
    // Marqueur de repli (PREMIUM-GUIDE-001B-timeout) : ItineraryBlock s'en sert pour
    // rendre un état honnête « génération trop longue + Réessayer ».
    isFallback: true,
  };
}

export async function generateItinerary(req: ItineraryRequest): Promise<ItineraryResult> {
  const country = req.countryName ?? req.countryCode ?? 'destination inconnue';
  const days = req.from && req.to
    ? Math.max(1, Math.ceil((new Date(req.to).getTime() - new Date(req.from).getTime()) / 86400000))
    : (req.duration ?? 7);
  const budgetAmount = req.budget ?? 1000;
  const currency = req.currency ?? 'EUR';
  const travelers = req.travelers ?? 1;
  const meaeLevel = req.riskContext?.meaeLevel ?? 1;
  const perDay = Math.round(budgetAmount / days);

  // Cible du narratif (GUIDE-V2, anti-timeout) : volontairement COURTE et bornée pour que
  // la génération passe sous le hard timeout de 45 s (cf. logs Preview : l'ancienne cible
  // 6-10 paragraphes / ~600 mots faisait déborder Claude → fallback systématique). On vise
  // désormais un texte guide ramassé mais réel : 4 à 6 paragraphes, ~250 à 400 mots. La
  // durée du séjour fait varier la cible DANS cette fourchette serrée, jamais au-delà —
  // mieux vaut un guide court qui s'affiche qu'un long qui timeoute.
  const narrativeParagraphTarget = days <= 6 ? 4 : days <= 12 ? 5 : 6;
  const narrativeWordTarget = Math.min(400, 250 + days * 12);

  if (!process.env.ANTHROPIC_API_KEY) {
    return buildItineraryFallback(req, days);
  }

  // Segment de version 'guide-v2' (PREMIUM-GUIDE-001B, anti-timeout) : le CONTRAT de longueur
  // du guide change (cible ramassée 250-400 mots / 4-6 paragraphes pour passer sous le hard
  // timeout). Bump 'guide-v1' → 'guide-v2' : invalide les guides cachés au format précédent
  // (potentiellement plus longs), pour ne resservir que des textes générés sous le nouveau
  // contrat. Aucune purge manuelle de Redis. (Rappel historique : 'narrative-v2' → 'guide-v1'
  // avait déjà tué les anciens itinéraires JSON lourds à cartes vides.)
  const cacheKey = buildCacheKey(
    'itinerary',
    req.countryCode ?? req.countryName ?? 'unknown',
    String(days),
    String(Math.floor(budgetAmount / 100) * 100),
    req.travelType ?? 'solo',
    'guide-v2',
  );

  const safetyHeader = meaeLevel >= 3
    ? `⚠️ NIVEAU DE VIGILANCE ÉLEVÉ (MEAE ${meaeLevel}/4) : renforce les avertissements de sécurité, évite les zones explicitement déconseillées, rappelle systématiquement les précautions officielles.`
    : meaeLevel === 2
    ? `ℹ️ Vigilance normale (MEAE ${meaeLevel}/4) : intègre des notes de sécurité pratiques sans dramatisation.`
    : `✅ Destination globalement sûre (MEAE ${meaeLevel}/4) : rappels sécurité standards.`;

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

  // PROMPT GUIDE-V1 (refonte produit) : on demande UNIQUEMENT un texte de guide en markdown
  // (titres en gras + paragraphes), PAS de JSON, PAS de grille jour/matin/après-midi/soir.
  // Bénéfices : (1) sortie plus courte → moins de risque de timeout / troncature ;
  // (2) plus aucune « case » que le modèle remplit avec du vide (« À planifier… ») ;
  // (3) plus de JSON à parser → toute une classe de bugs (JSON malformé/tronqué) disparaît.
  const prompt = `Tu es un conseiller de voyage humain et expérimenté. Rédige, EN TEXTE (pas de JSON, pas de code), un GUIDE de voyage narratif, fluide et concret, pour ce séjour :

- Destination : ${country}${req.cityOrRegion ? ` (région/ville ciblée : ${req.cityOrRegion})` : ''}
- ${dateContext}
- Budget : ${budgetAmount} ${currency} pour ${travelers} voyageur${travelers > 1 ? 's' : ''} (~${perDay} ${currency}/jour)
- Profil : ${travelTypeContext}
${prefContext}
${safetyHeader}

CE QUE TU ÉCRIS — un texte de guide, comme si tu parlais directement au voyageur :
- Tutoiement, ton chaleureux mais sobre, jamais marketing ni administratif.
- Prends position : « je te conseille de… », « j'éviterais… », « le bon compromis, c'est… », « le rythme le plus intelligent ici… ».
- Organise une LOGIQUE DE PARCOURS : 2-3 bases/zones principales, regroupées géographiquement, sans allers-retours inutiles. Nomme les villes/régions/quartiers réels et EXPLIQUE POURQUOI chaque étape, dans quel ordre, quand basculer de l'une à l'autre.
- Donne un vrai conseil de RYTHME pour un profil ${req.travelType ?? 'solo'} : où ralentir, où densifier, ce qu'il ne faut PAS surcharger. Insiste sur le fait de ne pas vouloir tout faire.
- Propose des ALTERNATIVES concrètes selon les aléas : fatigue, météo défavorable, budget serré${req.travelType === 'family' ? ', enfants fatigués' : ''}, transports compliqués.
- Signale les ERREURS À ÉVITER (pièges classiques, zones surcotées, mauvais timing).
- Intègre les PRÉCAUTIONS de sécurité cohérentes avec MEAE ${meaeLevel}/4, sans dramatiser ni promettre une sécurité absolue, et rappelle de vérifier diplomatie.gouv.fr avant le départ et de s'inscrire sur Ariane.
- Intègre explicitement le pays, la durée (${days} jours), le budget (~${perDay} ${currency}/jour) et le profil.

FORMAT (markdown léger) — RESTE CONCIS :
- Titres courts en gras "**Titre**", paragraphes séparés par une LIGNE VIDE. Quelques titres seulement (3 à 5), pas une liste de cases.
- Vise ${narrativeParagraphTarget} à ${narrativeParagraphTarget + 1} paragraphes, ~${narrativeWordTarget} mots au total (NE DÉPASSE PAS ~420 mots). Mieux vaut un guide dense et utile que long et dilué : va droit au but, pas de remplissage.
- Ossature conseillée (adapte-la, ne la recopie pas mécaniquement, et fusionne des points si besoin pour rester court) :
  **Le fil conducteur du séjour** · **Le bon rythme à adopter** · **Les grandes étapes, et pourquoi** · **Si ça se complique & précautions** · **Mon conseil final**

RÈGLES ABSOLUES :
1. Ne prétends PAS accéder à des données en temps réel (prix de vols, météo live, disponibilités).
2. N'invente aucune source officielle ni chiffre de sécurité précis.
3. Ne promets pas de sécurité absolue.
4. Conditionnel pour les activités : « tu pourrais visiter », « les marchés proposent généralement ».
5. Aucun numéro de téléphone, adresse précise ou prix garanti.
6. NE PRODUIS PAS de découpage jour 1 / jour 2 / matin / après-midi / soir, NI de JSON : écris un texte de guide continu, en prose.

Réponds UNIQUEMENT avec le texte du guide en markdown (titres en gras + paragraphes). Commence directement par le premier titre.`;

  try {
    const { data, fromCache } = await withCache(
      cacheKey,
      async () => {
        const t0 = Date.now();
        let timer: ReturnType<typeof setTimeout> | undefined;

        // STREAMING (PREMIUM-GUIDE-001B-timeout) : le streaming évite le timeout HTTP du SDK.
        // GUIDE-V2 (anti-timeout) : la cible texte est ramassée (250-400 mots), donc max_tokens
        // descend de 3000 à 1800 — moins de tokens à générer = génération plus rapide, sous le
        // hard timeout de 45 s (cf. logs Preview où 3000 tokens débordaient systématiquement).
        const stream = client.messages.stream({
          model: 'claude-sonnet-4-6',
          max_tokens: 1800,
          messages: [{ role: 'user', content: prompt }],
        });

        // Hard timeout INTERNE (45s, sous le plafond Vercel maxDuration=60). Abort propre
        // du stream pour ne pas laisser fuir la connexion.
        const hardTimeout = new Promise<never>((_, reject) => {
          timer = setTimeout(() => {
            stream.abort();
            reject(new Error(`itinerary hard timeout ${ITINERARY_HARD_TIMEOUT_MS}ms`));
          }, ITINERARY_HARD_TIMEOUT_MS);
        });

        try {
          const msg = await Promise.race([stream.finalMessage(), hardTimeout]);
          // Garde anti-troncature : réponse coupée au plafond → on lève AVANT le return,
          // donc withCache ne met PAS en cache un guide tronqué et le catch renvoie un
          // fallback honnête NON caché.
          if ((msg as { stop_reason?: string }).stop_reason === 'max_tokens') {
            throw new Error('itinerary: réponse tronquée (stop_reason=max_tokens)');
          }
          const text = (msg.content[0] as { text: string }).text.trim();
          // VALIDATION AVANT CACHE : le guide doit être un texte substantiel. Un texte vide
          // ou trop court (< MIN_NARRATIVE_WORDS) n'est PAS un guide premium → on throw AVANT
          // le return pour que withCache ne stocke rien et que le catch renvoie un fallback
          // honnête NON caché (jamais resservi pendant 2h). C'est l'équivalent guide-v1 de
          // l'ancienne garde « no days array ».
          const wordCount = text ? text.split(/\s+/).filter(Boolean).length : 0;
          if (wordCount < MIN_NARRATIVE_WORDS) {
            throw new Error(`itinerary: guide trop court (${wordCount} mots < ${MIN_NARRATIVE_WORDS})`);
          }
          const usageItin = msg as { usage?: { input_tokens?: number; output_tokens?: number }; model?: string; stop_reason?: string };
          const itinInputTokens  = usageItin.usage?.input_tokens  ?? 0;
          const itinOutputTokens = usageItin.usage?.output_tokens ?? 0;
          const itinModel = usageItin.model ?? 'claude-sonnet-4-6';
          logAiUsageSafe({
            service: 'claude-itinerary',
            provider: 'anthropic',
            model: itinModel,
            inputTokens: itinInputTokens,
            outputTokens: itinOutputTokens,
            totalTokens: itinInputTokens + itinOutputTokens,
            estimatedCostUsd: estimateAnthropicCostUsd(itinModel, itinInputTokens, itinOutputTokens),
            durationMs: Date.now() - t0,
            cacheHit: false,
            countryCode: req.countryCode ?? 'unknown',
            travelType: req.travelType,
            stopReason: usageItin.stop_reason ?? 'end_turn',
          });
          logger.api('Claude-Itinerary', req.countryCode ?? 'unknown', Date.now() - t0, false);
          return text;
        } finally {
          if (timer) clearTimeout(timer);
        }
      },
      7200 // 2h cache
    );

    // Log cache hit/miss — miroir de generateDestinationNarrative (ligne ~147).
    // Permet de savoir en prod si Redis sert les itinéraires ou si tout part en live.
    if (fromCache) {
      logAiUsageSafe({
        service: 'claude-itinerary',
        provider: 'anthropic',
        model: 'claude-sonnet-4-6',
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        estimatedCostUsd: 0,
        durationMs: 0,
        cacheHit: true,
        countryCode: req.countryCode ?? 'unknown',
        travelType: req.travelType,
      });
    }
    logger.api('Claude-Itinerary', req.countryCode ?? 'unknown', 0, fromCache);

    // `data` est garanti = un texte de guide substantiel (validé dans le fetcher AVANT le
    // cache). GUIDE-V1 : c'est le narrativeText, et l'UNIQUE livrable. days reste vide
    // (le type le garde optionnel pour rétro-compat PDF/cache), globalAdvice vide.
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
      narrativeText: data,
      days: [],
      globalAdvice: [],
      safetyDisclaimer:
        "Cet itinéraire est généré à titre indicatif. Vérifiez les conditions locales et les recommandations officielles avant tout départ.",
      officialSourceReminder:
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
    const msg = error instanceof Error ? error.message : String(error);
    const reasonCategory: 'timeout' | 'truncated' | 'too_short' | 'network' | 'unknown' =
      msg.includes('hard timeout')     ? 'timeout'   :
      msg.includes('max_tokens')       ? 'truncated' :
      msg.includes('trop court')       ? 'too_short' :
      (msg.includes('fetch') || msg.includes('ECONNREFUSED') || msg.includes('network')) ? 'network' :
      'unknown';

    logger.error('Claude-Itinerary', error);
    logger.warn(
      'Claude-Itinerary',
      `fallback honnête retourné (NON caché) countryCode=${req.countryCode ?? req.countryName ?? 'unknown'} travelType=${req.travelType ?? 'solo'} days=${days} reasonCategory=${reasonCategory}`,
    );
    return buildItineraryFallback(req, days);
  }
}

// ── Premium Country Guide (PREMIUM-GUIDE-001C) ────────────────────────────────

// 45s : même garde-fou que l'itinéraire, sous le plafond Vercel maxDuration=60. Avec
// le streaming (évite le timeout HTTP), ne coupe que les générations anormalement lentes.
const GUIDE_HARD_TIMEOUT_MS = 45000;
// Plancher : un guide pays utile fait ~350-500 mots ; en deçà de 250 on rejette AVANT
// cache (throw dans le fetcher) → fallback honnête NON caché. Même discipline que MIN_NARRATIVE_WORDS.
const GUIDE_MIN_WORDS = 250;

type GuideProfile = {
  travelType?: 'solo' | 'couple' | 'family' | 'nomad';
  budget?: number;
  duration?: number;
  /** TRAVEL-DATES-001 — Dates de voyage optionnelles (YYYY-MM-DD). */
  from?: string;
  to?: string;
};

function buildGuideFallback(score: CrisisScore): PremiumCountryGuide {
  return {
    countryCode: score.countryCode,
    countryName: score.country,
    guideText: '',
    generatedAt: new Date().toISOString(),
    isFallback: true,
  };
}

/** Bloc « faits frais » injecté dans le prompt ; conditionnel si Perplexity en fallback. */
function buildFactsBlock(facts: PerplexityCountryFacts): string {
  const sections: Array<[string, string[]]> = [
    ['Où se baser', facts.whereToStay],
    ['Zones/situations à éviter', facts.zonesToAvoid],
    ['Arnaques fréquentes', facts.commonScams],
    ['Erreurs classiques', facts.classicMistakes],
    ['Habitudes locales', facts.localCustoms],
    ['Conseils terrain', facts.fieldTips],
  ];
  const lines = sections
    .filter(([, items]) => items.length > 0)
    .map(([label, items]) => `- ${label} : ${items.join(' ; ')}`);
  return lines.length > 0
    ? `FAITS TERRAIN VÉRIFIÉS (utilise-les en priorité, reformule, ne recopie pas) :\n${lines.join('\n')}`
    : `AUCUN FAIT TERRAIN FRAIS DISPONIBLE : reste plus général et emploie le conditionnel ; ne donne aucun nom de quartier/arnaque dont tu n'es pas sûr.`;
}

/**
 * PREMIUM-GUIDE-001C — Guide pays premium (texte terrain en 8 sections), hybride :
 * faits frais Perplexity (déjà récupérés par l'appelant) + scoreSnapshot + profil +
 * risques live. Streaming + hard timeout + garde anti-troncature + plancher mots ;
 * fallback honnête NON caché (isFallback) sur échec/timeout/troncature/déficit.
 * Cache versionné guide-v1, segmenté par pays + profil + bande de score.
 */
export async function generatePremiumCountryGuide(
  score: CrisisScore,
  facts: PerplexityCountryFacts,
  profile: GuideProfile,
): Promise<PremiumCountryGuide> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return buildGuideFallback(score);
  }

  const travelType = profile.travelType ?? 'solo';
  const liveRisksLine = (score.liveRisks ?? []).length > 0
    ? `Risques terrain remontés par nos sources : ${(score.liveRisks ?? []).join(' ; ')}.`
    : '';
  const meaeRaw = score.security.details.meaeLevel;
  const meaeLevel = typeof meaeRaw === 'number' ? meaeRaw : parseInt(String(meaeRaw ?? '2'), 10) || 2;

  // TRAVEL-DATES-001 : bucketisation par mois (YYYY-MM) pour guide saisonnier.
  // 12 buckets/an par pays+profil+bande au lieu de 365 — équilibre fraîcheur/cache.
  const monthBucket = profile.from ? profile.from.slice(0, 7) : 'any';

  const cacheKey = buildCacheKey(
    'country-guide',
    score.countryCode,
    travelType,
    String(Math.floor(score.total / 5)),
    profile.duration ? String(profile.duration) : 'any',
    monthBucket,  // TRAVEL-DATES-001
    'guide-v3',   // bump guide-v2→v3 : invalide les guides cachés sans contexte saisonnier
  );

  // TRAVEL-DATES-001 : contexte saisonnier injecté si from est connu
  const dateContext = profile.from
    ? `\nContexte temporel : voyage prévu du ${profile.from}${profile.to ? ` au ${profile.to}` : ''} — tiens compte de la saison (météo, événements, affluence touristique) sans inventer de données météo précises.`
    : '';

  const prompt = `Tu es un guide de voyage humain et expérimenté qui connaît ${score.country}. Rédige, EN TEXTE (pas de JSON), un GUIDE PAYS premium pour un voyageur ${travelType}${profile.budget ? `, budget ~${profile.budget}€` : ''}${profile.duration ? `, ${profile.duration} jours` : ''}.

Ce n'est PAS un rapport de score : c'est un guide terrain, comme si tu briefais un ami avant son départ. Tutoiement, ton chaleureux mais sobre, prends position.

Contexte objectif (à intégrer, pas à réciter) :
- CrisisScore ${score.total}/100 (${score.status}) — sécurité ${score.security.value}, géopolitique ${score.geopolitical.value}, budget ${score.budget.value}, praticité ${score.practicality.value}.
- Niveau de vigilance MEAE ${meaeLevel}/4.
- Repas bon marché ~${score.budget.details.mealCheap ?? 'N/A'}€, hôtel moyen ~${score.budget.details.hotelAvg ?? 'N/A'}€/nuit.
${liveRisksLine}${dateContext}

${buildFactsBlock(facts)}

STRUCTURE — 8 sections, chacune un titre court en gras puis 1-2 paragraphes (ou une courte liste) :
**1. Vue d'ensemble & avant de partir**
**2. Culture & comportements locaux**
**3. Où se baser / zones à privilégier**
**4. Zones ou situations à éviter**
**5. Sécurité terrain & vigilance concrète** (cohérente avec MEAE ${meaeLevel}/4, sans dramatiser ni promettre une sécurité absolue)
**6. Arnaques fréquentes & erreurs classiques**
**7. Budget, confort & logistique**
**8. Conseils selon profil ${travelType} + mon conseil final de guide**

RÈGLES ABSOLUES :
1. N'invente JAMAIS une adresse, un prix précis, une source officielle ou une règle locale.
2. Quand tu n'as pas de fait sûr, emploie le conditionnel (« tu trouveras généralement », « il vaut mieux »).
3. Ne promets pas de sécurité absolue ; rappelle de vérifier diplomatie.gouv.fr et de s'inscrire sur Ariane.
4. Aucun numéro de téléphone ni prix garanti.
5. Reste CONCIS : ~350-500 mots au total, dense et utile, pas de remplissage.

Réponds UNIQUEMENT avec le texte du guide en markdown (titres en gras + paragraphes). Commence directement par "**1. Vue d'ensemble".`;

  try {
    const { data, fromCache: guideFromCache } = await withCache(
      cacheKey,
      async () => {
        const t0 = Date.now();
        let timer: ReturnType<typeof setTimeout> | undefined;
        const stream = client.messages.stream({
          model: 'claude-sonnet-4-6',
          max_tokens: 2200,
          messages: [{ role: 'user', content: prompt }],
        });
        const hardTimeout = new Promise<never>((_, reject) => {
          timer = setTimeout(() => {
            stream.abort();
            reject(new Error(`country-guide hard timeout ${GUIDE_HARD_TIMEOUT_MS}ms`));
          }, GUIDE_HARD_TIMEOUT_MS);
        });
        try {
          const msg = await Promise.race([stream.finalMessage(), hardTimeout]);
          // Garde anti-troncature : réponse coupée au plafond → throw AVANT le return,
          // withCache ne cache rien et le catch renvoie un fallback honnête NON caché.
          if ((msg as { stop_reason?: string }).stop_reason === 'max_tokens') {
            throw new Error('country-guide: réponse tronquée (stop_reason=max_tokens)');
          }
          const text = (msg.content[0] as { text: string }).text.trim();
          const wordCount = text ? text.split(/\s+/).filter(Boolean).length : 0;
          if (wordCount < GUIDE_MIN_WORDS) {
            throw new Error(`country-guide: trop court (${wordCount} mots < ${GUIDE_MIN_WORDS})`);
          }
          const usageGuide = msg as { usage?: { input_tokens?: number; output_tokens?: number }; model?: string; stop_reason?: string };
          const guideInputTokens  = usageGuide.usage?.input_tokens  ?? 0;
          const guideOutputTokens = usageGuide.usage?.output_tokens ?? 0;
          const guideModel = usageGuide.model ?? 'claude-sonnet-4-6';
          logAiUsageSafe({
            service: 'claude-country-guide',
            provider: 'anthropic',
            model: guideModel,
            inputTokens: guideInputTokens,
            outputTokens: guideOutputTokens,
            totalTokens: guideInputTokens + guideOutputTokens,
            estimatedCostUsd: estimateAnthropicCostUsd(guideModel, guideInputTokens, guideOutputTokens),
            durationMs: Date.now() - t0,
            cacheHit: false,
            countryCode: score.countryCode,
            travelType: travelType,
            stopReason: usageGuide.stop_reason ?? 'end_turn',
          });
          logger.api('Claude-CountryGuide', score.countryCode, Date.now() - t0, false);
          return text;
        } finally {
          if (timer) clearTimeout(timer);
        }
      },
      21600, // 6h
    );

    if (guideFromCache) {
      logAiUsageSafe({
        service: 'claude-country-guide',
        provider: 'anthropic',
        model: 'claude-sonnet-4-6',
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        estimatedCostUsd: 0,
        durationMs: 0,
        cacheHit: true,
        countryCode: score.countryCode,
        travelType: travelType,
      });
    }

    return {
      countryCode: score.countryCode,
      countryName: score.country,
      guideText: data,
      generatedAt: new Date().toISOString(),
    };
  } catch (error) {
    logger.error('Claude-CountryGuide', error);
    logger.warn(
      'Claude-CountryGuide',
      `guide fallback honnête retourné (NON caché) pour ${score.countryCode} — cause: ${error instanceof Error ? error.message : 'inconnue'}`,
    );
    return buildGuideFallback(score);
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
