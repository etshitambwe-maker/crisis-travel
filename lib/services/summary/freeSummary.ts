/**
 * PREMIUM-FLOW-001D — Synthèse gratuite de base.
 * ─────────────────────────────────────────────────────────────────────────────
 * Construit, à partir des données STRUCTURÉES du CrisisScore (toujours fiables),
 * une synthèse de voyage visible gratuitement sur /destination/[country].
 *
 * Principes :
 *   - Aucune dépendance réseau : fonction PURE (pas de fetch, pas de client IA).
 *     La narrative Claude est déjà calculée en amont par la page ; on n'en extrait
 *     qu'un lead robuste, sans la régénérer.
 *   - Robustesse : si la narrative est absente ou mal formée, la synthèse reste
 *     complète grâce aux seules données structurées. On ne dépend JAMAIS d'une
 *     string libre Claude pour le contenu essentiel.
 *
 * La synthèse IA COMPLÈTE (narrative intégrale + contexte géopolitique + risques
 * résiduels + recommandations personnalisées) reste premium, côté page.
 */
import type { CrisisScore, SubScore } from '@/types/crisis.types';
import { tierFromScore, TIER } from '@/components/design/atoms';

/** Profil voyageur minimal pour personnaliser la synthèse (optionnel). */
export interface SummaryProfile {
  travelType?: 'solo' | 'couple' | 'family' | 'nomad';
}

export interface FreeSummary {
  destination: string;
  /** Verdict éditorial court dérivé du tier (ex. "Recommandée avec vigilance normale"). */
  verdict: string;
  /** Niveau de risque général lisible (ex. "Risque faible · MEAE 1/4"). */
  riskLevel: string;
  /**
   * PREMIUM-FLOW-001E — vraie synthèse basique en PARAGRAPHE narratif, lisible et
   * auto-suffisante. Construit à partir des données structurées (toujours présent,
   * même sans narrative Claude) ; enrichi par l'extrait narrative quand disponible.
   * C'est la valeur gratuite obligatoire affichée en évidence.
   */
  basicSynthesis: string;
  /** Sous-scores élevés présentés comme points forts. */
  strengths: string[];
  /** Sous-scores bas présentés comme points de vigilance. */
  watchpoints: string[];
  /** 2-3 conseils essentiels, toujours présents. */
  essentialTips: string[];
  /** Extrait court du 1er paragraphe de la narrative — '' si indisponible. */
  lead: string;
}

const SUBSCORE_LABELS = {
  security: 'Sécurité',
  geopolitical: 'Géopolitique',
  budget: 'Budget',
  practicality: 'Praticité',
} as const;

type SubKey = keyof typeof SUBSCORE_LABELS;

const STRENGTH_THRESHOLD = 70; // ≥ → point fort
const WATCH_THRESHOLD = 50;    // < → point de vigilance

/**
 * Extrait le premier paragraphe lisible de la narrative Claude.
 * Robuste : retourne '' sur entrée vide/nulle ; ignore la section
 * "Risques résiduels" (réservée à l'approfondissement premium) ;
 * nettoie le markdown gras minimal.
 */
export function extractNarrativeLead(narrative: string | null | undefined): string {
  if (!narrative || typeof narrative !== 'string') return '';
  // Découpe en paragraphes sur double saut de ligne.
  const paragraphs = narrative
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (paragraphs.length === 0) return '';
  // Premier paragraphe qui n'est pas la section "Risques résiduels".
  const lead = paragraphs.find((p) => !/risques?\s+résiduels?/i.test(p)) ?? paragraphs[0];
  // Nettoyage markdown léger (gras ** **) et compactage des espaces.
  return lead.replace(/\*\*/g, '').replace(/\s+/g, ' ').trim();
}

function riskLevelLabel(score: CrisisScore): string {
  const meaeRaw = score.security.details.meaeLevel;
  const meae = typeof meaeRaw === 'number' ? meaeRaw : parseInt(String(meaeRaw ?? ''), 10);
  const band =
    score.total >= 80 ? 'Risque faible' :
    score.total >= 60 ? 'Risque modéré' :
    score.total >= 40 ? 'Risque élevé' : 'Risque très élevé';
  return Number.isInteger(meae) && meae >= 1 && meae <= 4
    ? `${band} · MEAE ${meae}/4`
    : band;
}

// Profil voyageur → tournure lisible insérée dans le paragraphe.
const PROFILE_PHRASE: Record<NonNullable<SummaryProfile['travelType']>, string> = {
  solo: 'un voyage en solo',
  couple: 'un séjour en couple',
  family: 'un voyage en famille',
  nomad: 'un séjour de nomade digital',
};

/**
 * PREMIUM-FLOW-001E — construit le PARAGRAPHE de synthèse basique.
 * Pur, sans réseau. Toujours non vide, même sans narrative : la situation, le
 * conseil principal et les points de vigilance sont dérivés des données
 * structurées. La narrative ne fait qu'enrichir une phrase finale optionnelle.
 */
function buildBasicSynthesis(
  score: CrisisScore,
  strongLabels: string[],
  weakLabels: string[],
  profile?: SummaryProfile,
): string {
  const dest = score.country;

  // 1) Situation générale selon le score (lexique aligné sur les tests/UX).
  const situation =
    score.total >= 80 ? 'globalement favorable' :
    score.total >= 60 ? 'plutôt favorable mais demande de la vigilance' :
    score.total >= 40 ? 'à surveiller de près' : 'défavorable et déconseillée pour le moment';

  // 2) Tournure profil (si connu).
  const profilePhrase = profile?.travelType ? PROFILE_PHRASE[profile.travelType] : null;

  // 3) Conseil principal selon le maillon faible dominant.
  const mainAdvice =
    score.total < 40 ? "n'y partir qu'en cas d'impératif et en suivant les consignes officielles" :
    score.security.value < 60 ? 'rester attentif aux zones recommandées et aux consignes locales' :
    score.budget.value < WATCH_THRESHOLD ? 'prévoir une marge confortable dans votre budget' :
    'préparer votre séjour sans précaution inhabituelle au-delà du bon sens';

  // 4) Atouts / points de vigilance (en mots, pas en scores bruts).
  const strongWords = strongLabels.map((l) => l.split(' · ')[0].toLowerCase());
  const weakWords = weakLabels.map((l) => l.split(' · ')[0].toLowerCase());

  const parts: string[] = [];
  parts.push(
    `Pour ${profilePhrase ? `${profilePhrase} à ${dest}` : `un voyage à ${dest}`}, la situation est ${situation} (CrisisScore ${score.total}/100).`,
  );
  if (strongWords.length > 0) {
    parts.push(`Vos meilleurs atouts ici : ${strongWords.join(', ')}.`);
  }
  if (weakWords.length > 0) {
    parts.push(`Les principaux points de vigilance concernent ${weakWords.join(', ')}.`);
  } else if (score.total >= 60) {
    parts.push('Aucun point de vigilance majeur ne ressort sur les critères analysés.');
  }
  parts.push(
    `Avant de partir, pensez à ${mainAdvice}, à vérifier les consignes officielles sur Diplomatie.gouv et à garder une marge dans votre programme.`,
  );

  return parts.join(' ').replace(/\s+/g, ' ').trim();
}

export function buildFreeSummary(
  score: CrisisScore,
  narrative: string | null | undefined,
  profile?: SummaryProfile,
): FreeSummary {
  const tier = TIER[tierFromScore(score.total)];

  const entries: { key: SubKey; sub: SubScore }[] = [
    { key: 'security', sub: score.security },
    { key: 'geopolitical', sub: score.geopolitical },
    { key: 'budget', sub: score.budget },
    { key: 'practicality', sub: score.practicality },
  ];

  const strengths = entries
    .filter((e) => e.sub.value >= STRENGTH_THRESHOLD)
    .sort((a, b) => b.sub.value - a.sub.value)
    .map((e) => `${SUBSCORE_LABELS[e.key]} · ${e.sub.value}/100`);

  const watchpoints = entries
    .filter((e) => e.sub.value < WATCH_THRESHOLD)
    .sort((a, b) => a.sub.value - b.sub.value)
    .map((e) => `${SUBSCORE_LABELS[e.key]} · ${e.sub.value}/100`);

  // Conseils essentiels — toujours au moins un, dérivés du contexte.
  const essentialTips: string[] = [
    'Vérifiez la fiche officielle Diplomatie.gouv avant tout départ.',
    'Souscrivez une assurance voyage couvrant rapatriement et imprévus.',
  ];
  if (score.budget.value < WATCH_THRESHOLD) {
    essentialTips.push('Budget local exigeant : prévoyez une marge sur place.');
  } else if (score.security.value < 60) {
    essentialTips.push('Sécurité à surveiller : suivez les zones recommandées.');
  } else {
    essentialTips.push('Consultez des retours de voyageurs récents pour le terrain.');
  }

  return {
    destination: score.country,
    verdict: tier.verdict,
    riskLevel: riskLevelLabel(score),
    basicSynthesis: buildBasicSynthesis(score, strengths, watchpoints, profile),
    strengths,
    watchpoints,
    essentialTips: essentialTips.slice(0, 3),
    lead: extractNarrativeLead(narrative),
  };
}
