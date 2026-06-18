import axios from 'axios';
import { z } from 'zod';
import { withCache, buildCacheKey } from '@/lib/cache/redis';
import { logger } from '@/lib/utils/logger';
import type { PerplexityGeoAnalysis, PerplexityCountryFacts, ServiceResult } from '@/types/api.types';

// ── AI Cost tracking — OpenRouter/Perplexity (AI-COST-001) ───────────────────

// Tarifs indicatifs perplexity/sonar-pro via OpenRouter (USD / million de tokens).
// Source : openrouter.ai/models — à réviser si le routage change.
const SONAR_PRO_INPUT_COST_PER_M  = 3.0;   // $3 / 1M input tokens (estimation conservatrice)
const SONAR_PRO_OUTPUT_COST_PER_M = 15.0;  // $15 / 1M output tokens

export function estimateOpenRouterCostUsd(
  promptTokens: number,
  completionTokens: number,
): number {
  const cost = (promptTokens * SONAR_PRO_INPUT_COST_PER_M + completionTokens * SONAR_PRO_OUTPUT_COST_PER_M) / 1_000_000;
  return Math.round(cost * 1_000_000) / 1_000_000;
}

type OpenRouterUsageLog = {
  service: string;
  provider: 'openrouter';
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCostUsd: number;
  durationMs: number;
  cacheHit: boolean;
  countryCode: string;
  usageMissing?: boolean;
  fallbackUsed?: boolean;
};

function logOpenRouterUsageSafe(params: OpenRouterUsageLog): void {
  console.log('[AI Usage]', params);
}

const PerplexitySchema = z.object({
  stabilityScore: z.number().min(0).max(100),
  summary: z.string().max(500),
  mainRisks: z.array(z.string()).max(5),
  recentEvents: z.array(z.string()).max(5),
  trend: z.enum(['improving', 'stable', 'deteriorating']),
});

const FALLBACK: PerplexityGeoAnalysis = {
  stabilityScore: 50,
  summary: 'Analyse géopolitique temporairement indisponible.',
  mainRisks: [],
  recentEvents: [],
  trend: 'stable',
};

function buildPrompt(country: string): string {
  const month = new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  return `Analyse la situation géopolitique actuelle de ${country} pour un voyageur français en ${month}.

Retourne UNIQUEMENT ce JSON valide, sans markdown ni texte avant/après :
{"stabilityScore":<entier 0-100>,"summary":"<2 phrases max>","mainRisks":["<risque1>","<risque2>"],"recentEvents":["<événement récent>"],"trend":"<improving|stable|deteriorating>"}`;
}

export async function getPerplexityGeoScore(
  countryCode: string,
  countryName: string
): Promise<ServiceResult<PerplexityGeoAnalysis>> {
  const apiKey = process.env.OPENROUTER_API_KEY ?? '';
  if (!apiKey || apiKey.length < 20) {
    return { data: FALLBACK, source: 'fallback' };
  }

  const cacheKey = buildCacheKey('perplexity', countryCode);
  try {
    const { data, fromCache } = await withCache(
      cacheKey,
      async () => {
        const t0 = Date.now();
        const res = await axios.post(
          'https://openrouter.ai/api/v1/chat/completions',
          {
            model: 'perplexity/sonar-pro',
            messages: [{ role: 'user', content: buildPrompt(countryName) }],
            max_tokens: 400,
          },
          {
            headers: {
              Authorization: `Bearer ${apiKey}`,
              'HTTP-Referer': 'https://crisis-travel.app',
              'X-Title': 'Crisis Travel',
            },
            timeout: 6000,
          }
        );
        const usageGeo = res.data.usage as { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } | undefined;
        const geoPromptTokens     = usageGeo?.prompt_tokens     ?? 0;
        const geoCompletionTokens = usageGeo?.completion_tokens ?? 0;
        const geoModel = (res.data.model as string | undefined) ?? 'perplexity/sonar-pro';
        logOpenRouterUsageSafe({
          service: 'perplexity-geo-score',
          provider: 'openrouter',
          model: geoModel,
          promptTokens: geoPromptTokens,
          completionTokens: geoCompletionTokens,
          totalTokens: usageGeo?.total_tokens ?? (geoPromptTokens + geoCompletionTokens),
          estimatedCostUsd: estimateOpenRouterCostUsd(geoPromptTokens, geoCompletionTokens),
          durationMs: Date.now() - t0,
          cacheHit: false,
          countryCode,
          usageMissing: !usageGeo,
        });
        logger.api('Perplexity/OpenRouter', countryCode, Date.now() - t0, false);
        const text = res.data.choices[0].message.content as string;
        // sonar-pro peut encapsuler dans du markdown — on extrait le JSON
        const jsonMatch = text.match(/\{[\s\S]*?\}/);
        if (!jsonMatch) throw new Error('No JSON in response');
        const parsed = JSON.parse(jsonMatch[0]);
        // Validation Zod — garantit la structure avant utilisation
        return PerplexitySchema.parse(parsed) as PerplexityGeoAnalysis;
      },
      1800
    );
    if (fromCache) {
      logOpenRouterUsageSafe({
        service: 'perplexity-geo-score',
        provider: 'openrouter',
        model: 'perplexity/sonar-pro',
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        estimatedCostUsd: 0,
        durationMs: 0,
        cacheHit: true,
        countryCode,
      });
      logger.api('Perplexity/OpenRouter', countryCode, 0, true);
    }
    return { data, source: 'live' };
  } catch (error) {
    logger.error('Perplexity/OpenRouter', error);
    return { data: FALLBACK, source: 'fallback', error: String(error) };
  }
}

// ── PREMIUM-GUIDE-001C — Faits terrain frais pour le guide pays premium ───────

const CountryFactsSchema = z.object({
  whereToStay: z.array(z.string()).max(8).default([]),
  zonesToAvoid: z.array(z.string()).max(8).default([]),
  commonScams: z.array(z.string()).max(8).default([]),
  classicMistakes: z.array(z.string()).max(8).default([]),
  localCustoms: z.array(z.string()).max(8).default([]),
  fieldTips: z.array(z.string()).max(8).default([]),
});

const FACTS_FALLBACK: PerplexityCountryFacts = {
  whereToStay: [], zonesToAvoid: [], commonScams: [],
  classicMistakes: [], localCustoms: [], fieldTips: [],
};

function buildFactsPrompt(country: string): string {
  return `Tu es un conseiller de voyage. Donne des FAITS TERRAIN concrets et actuels sur ${country} pour un voyageur français, utiles pour préparer un séjour.

Retourne UNIQUEMENT ce JSON valide, sans markdown ni texte avant/après. Chaque tableau : 2 à 5 entrées courtes (une phrase max). Si tu n'es pas sûr, laisse le tableau vide plutôt que d'inventer :
{"whereToStay":["<ville/quartier où se baser>"],"zonesToAvoid":["<zone/situation à éviter>"],"commonScams":["<arnaque fréquente>"],"classicMistakes":["<erreur classique de voyageur>"],"localCustoms":["<habitude/code local>"],"fieldTips":["<conseil terrain concret>"]}`;
}

/**
 * PREMIUM-GUIDE-001C — Faits terrain frais (où se baser, quoi éviter, arnaques,
 * erreurs, habitudes, conseils) pour alimenter le guide pays premium. Distinct de
 * getPerplexityGeoScore (chemin critique /api/analyze) : fonction séparée, prompt et
 * schéma propres, cache LONG (6h). Ne jette jamais : fallback listes vides → le guide
 * Claude dégrade vers du conditionnel.
 */
export async function getPerplexityCountryFacts(
  countryCode: string,
  countryName: string,
): Promise<ServiceResult<PerplexityCountryFacts>> {
  const apiKey = process.env.OPENROUTER_API_KEY ?? '';
  if (!apiKey || apiKey.length < 20) {
    return { data: FACTS_FALLBACK, source: 'fallback' };
  }

  const cacheKey = buildCacheKey('country-facts', countryCode, 'guide-v1');
  try {
    const { data, fromCache: factsFromCache } = await withCache(
      cacheKey,
      async () => {
        const t0 = Date.now();
        const res = await axios.post(
          'https://openrouter.ai/api/v1/chat/completions',
          {
            model: 'perplexity/sonar-pro',
            messages: [{ role: 'user', content: buildFactsPrompt(countryName) }],
            max_tokens: 700,
          },
          {
            headers: {
              Authorization: `Bearer ${apiKey}`,
              'HTTP-Referer': 'https://crisis-travel.app',
              'X-Title': 'Crisis Travel',
            },
            timeout: 7000,
          },
        );
        const usageFacts = res.data.usage as { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } | undefined;
        const factsPromptTokens     = usageFacts?.prompt_tokens     ?? 0;
        const factsCompletionTokens = usageFacts?.completion_tokens ?? 0;
        const factsModel = (res.data.model as string | undefined) ?? 'perplexity/sonar-pro';
        logOpenRouterUsageSafe({
          service: 'perplexity-country-facts',
          provider: 'openrouter',
          model: factsModel,
          promptTokens: factsPromptTokens,
          completionTokens: factsCompletionTokens,
          totalTokens: usageFacts?.total_tokens ?? (factsPromptTokens + factsCompletionTokens),
          estimatedCostUsd: estimateOpenRouterCostUsd(factsPromptTokens, factsCompletionTokens),
          durationMs: Date.now() - t0,
          cacheHit: false,
          countryCode,
          usageMissing: !usageFacts,
        });
        logger.api('Perplexity-Facts', countryCode, Date.now() - t0, false);
        const text = res.data.choices[0].message.content as string;
        // sonar-pro peut encapsuler dans du markdown — on extrait l'objet JSON complet.
        // Greedy (\{[\s\S]*\}) car les tableaux ne contiennent pas d'accolades imbriquées.
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error('No JSON in facts response');
        const parsed = JSON.parse(jsonMatch[0]);
        return CountryFactsSchema.parse(parsed) as PerplexityCountryFacts;
      },
      21600, // 6h — faits semi-stables
    );
    if (factsFromCache) {
      logOpenRouterUsageSafe({
        service: 'perplexity-country-facts',
        provider: 'openrouter',
        model: 'perplexity/sonar-pro',
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        estimatedCostUsd: 0,
        durationMs: 0,
        cacheHit: true,
        countryCode,
      });
    }
    return { data, source: 'live' };
  } catch (error) {
    logger.error('Perplexity-Facts', error);
    return { data: FACTS_FALLBACK, source: 'fallback', error: String(error) };
  }
}
