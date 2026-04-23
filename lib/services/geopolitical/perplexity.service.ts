import axios from 'axios';
import { withCache, buildCacheKey } from '@/lib/cache/redis';
import { logger } from '@/lib/utils/logger';
import type { PerplexityGeoAnalysis, ServiceResult } from '@/types/api.types';

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
{"stabilityScore":<entier 0-100>,"summary":"<2 phrases>","mainRisks":["<risque1>","<risque2>"],"recentEvents":["<événement>"],"trend":"<improving|stable|deteriorating>"}`;
}

export async function getPerplexityGeoScore(
  countryCode: string,
  countryName: string
): Promise<ServiceResult<PerplexityGeoAnalysis>> {
  if (!process.env.PERPLEXITY_API_KEY) {
    logger.warn('Perplexity', 'API Key manquante');
    return { data: FALLBACK, source: 'fallback' };
  }

  const key = buildCacheKey('perplexity', countryCode);
  try {
    const { data, fromCache } = await withCache(
      key,
      async () => {
        const t0 = Date.now();
        const res = await axios.post(
          'https://api.perplexity.ai/chat/completions',
          {
            model: 'sonar',
            messages: [{ role: 'user', content: buildPrompt(countryName) }],
            max_tokens: 400,
          },
          {
            headers: { Authorization: `Bearer ${process.env.PERPLEXITY_API_KEY}` },
            timeout: 8000,
          }
        );
        logger.api('Perplexity', countryCode, Date.now() - t0, false);
        const text = res.data.choices[0].message.content as string;
        return JSON.parse(text) as PerplexityGeoAnalysis;
      },
      1800
    );
    logger.api('Perplexity', countryCode, 0, fromCache);
    return { data, source: 'live' };
  } catch (error) {
    logger.error('Perplexity', error);
    return { data: FALLBACK, source: 'fallback', error: String(error) };
  }
}
