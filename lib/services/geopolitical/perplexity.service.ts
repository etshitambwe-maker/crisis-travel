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
            timeout: 8000,
          }
        );
        logger.api('Perplexity/OpenRouter', countryCode, Date.now() - t0, false);
        const text = res.data.choices[0].message.content as string;
        // sonar-pro peut encapsuler dans du markdown — on extrait le JSON
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error('No JSON in response');
        return JSON.parse(jsonMatch[0]) as PerplexityGeoAnalysis;
      },
      1800
    );
    if (fromCache) logger.api('Perplexity/OpenRouter', countryCode, 0, true);
    return { data, source: 'live' };
  } catch (error) {
    logger.error('Perplexity/OpenRouter', error);
    return { data: FALLBACK, source: 'fallback', error: String(error) };
  }
}
