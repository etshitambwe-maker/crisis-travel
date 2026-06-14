/**
 * PREMIUM-GUIDE-001A — Présentation « guide » des risques/événements terrain.
 * ─────────────────────────────────────────────────────────────────────────────
 * Transforme les tableaux bruts `liveRisks` / `recentEvents` du CrisisScore (issus
 * de Perplexity via le scoring — déjà produits, aucun appel ici) en un bloc
 * lisible pour la section premium « Aller plus loin » :
 *   - deux groupes titrés (« Risques récents à connaître » / « Événements à surveiller ») ;
 *   - une intro courte de ton conseil ;
 *   - entrées nettoyées (trim, retrait du gras markdown), dédupliquées, plafonnées.
 *
 * Fonction PURE : aucune dépendance réseau ni DOM. Robuste : ne jette jamais, et
 * ignore les valeurs non-string que pourrait renvoyer un LLM. Ne formule jamais de
 * promesse de sécurité absolue — c'est du contexte, pas une garantie.
 */

export interface LiveRisksBlock {
  /** true dès qu'au moins une entrée exploitable existe dans l'un des groupes. */
  hasContent: boolean;
  /** Intro courte de ton conseil, '' si aucun contenu. */
  intro: string;
  /** Risques terrain actuels, nettoyés/dédupliqués/plafonnés. */
  risks: string[];
  /** Événements récents à surveiller, nettoyés/dédupliqués/plafonnés. */
  events: string[];
}

/** Nombre maximum d'entrées affichées par groupe (lisibilité + garde-fou volume). */
const MAX_PER_GROUP = 5;

/** Trim + retrait du gras markdown ** ** + compactage des espaces internes. */
function cleanEntry(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const cleaned = value.replace(/\*\*/g, '').replace(/\s+/g, ' ').trim();
  return cleaned.length > 0 ? cleaned : null;
}

/** Nettoie, retire les vides, déduplique (insensible à la casse), plafonne. */
function normalizeGroup(items: string[] | undefined | null): string[] {
  if (!Array.isArray(items)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of items) {
    const cleaned = cleanEntry(raw);
    if (!cleaned) continue;
    const dedupKey = cleaned.toLowerCase();
    if (seen.has(dedupKey)) continue;
    seen.add(dedupKey);
    out.push(cleaned);
    if (out.length >= MAX_PER_GROUP) break;
  }
  return out;
}

export function buildLiveRisksBlock(
  liveRisks: string[] | undefined | null,
  recentEvents: string[] | undefined | null,
): LiveRisksBlock {
  const risks = normalizeGroup(liveRisks);
  const events = normalizeGroup(recentEvents);
  const hasContent = risks.length > 0 || events.length > 0;

  return {
    hasContent,
    intro: hasContent
      ? 'Ces points reflètent la situation récente relevée par nos sources. À garder en tête pour préparer votre séjour, sans s’y substituer aux consignes officielles.'
      : '',
    risks,
    events,
  };
}
