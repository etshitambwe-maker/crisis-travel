import Anthropic from '@anthropic-ai/sdk';
import { withCache, buildCacheKey } from '@/lib/cache/redis';
import { logger } from '@/lib/utils/logger';
import type { CrisisScore, UserProfile } from '@/types/crisis.types';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

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

  const key = buildCacheKey('claude-narrative', score.countryCode, String(Math.floor(score.total / 5)));
  try {
    const { data, fromCache } = await withCache(
      key,
      async () => {
        const t0 = Date.now();
        const msg = await client.messages.create({
          model: 'claude-sonnet-4-6',
          max_tokens: 700,
          messages: [
            {
              role: 'user',
              content: `Tu es un expert en géopolitique et voyage. Analyse ${score.country} pour un voyageur ${profile.travelType}, budget ${profile.budget}€, ${profile.duration} jours.

Données actuelles :
- CrisisScore global : ${score.total}/100 (${score.status})
- Sécurité : ${score.security.value}/100 | Sources : ${score.security.source}
- Géopolitique : ${score.geopolitical.value}/100 | Tendance : ${score.geopolitical.details.trend ?? 'stable'}
- Budget : ${score.budget.value}/100 | Change EUR : ${score.budget.details.currencyVariation ?? 0}% sur 12 mois
- Repas bon marché : ~${score.budget.details.mealCheap ?? '?'}€ | Hôtel moyen : ~${score.budget.details.hotelAvg ?? '?'}€/nuit

Rédige en français 3 paragraphes courts et factuels :
1. Pourquoi ce pays est ${score.total >= 60 ? 'recommandé' : 'déconseillé'} maintenant
2. Contexte géopolitique concret pour le voyageur
3. Réalité du budget sur place

Termine par : **Risques résiduels :** [3 risques concrets, une ligne chacun]`,
            },
          ],
        });
        logger.api('Claude', score.countryCode, Date.now() - t0, false);
        return (msg.content[0] as { text: string }).text;
      },
      3600
    );
    logger.api('Claude', score.countryCode, 0, fromCache);
    return data;
  } catch (error) {
    logger.error('Claude', error);
    return buildFallbackNarrative(score);
  }
}

export async function detectOpportunities(
  scores: CrisisScore[],
  budget: number
): Promise<Array<{ countryCode: string; type: string; explanation: string; estimatedSaving: number }>> {
  if (!process.env.ANTHROPIC_API_KEY) return [];

  try {
    const candidates = scores.filter((s) => s.total >= 55).slice(0, 12);
    const t0 = Date.now();
    // Borne dure : Claude ne doit jamais faire déborder /api/analyze (GOAL-032).
    // Au-delà de 8s, on abandonne les opportunités (fallback []) — les destinations
    // restent affichées, seul le bloc « opportunités » est omis.
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
      { timeout: 8000 }
    );
    logger.api('Claude-Opportunities', 'global', Date.now() - t0, false);
    const text = (msg.content[0] as { text: string }).text.trim();
    return JSON.parse(text);
  } catch (error) {
    logger.error('Claude-Opportunities', error);
    return [];
  }
}
