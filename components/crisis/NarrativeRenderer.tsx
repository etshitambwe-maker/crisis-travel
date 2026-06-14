/**
 * PREMIUM-EXPERIENCE-001 — Rendu premium structuré de la narrative Claude.
 * ─────────────────────────────────────────────────────────────────────────────
 * La narrative est une string markdown LÉGER produite par generateDestinationNarrative
 * (10 sections, titres **gras**, paragraphes séparés par lignes vides, listes
 * "- " / "• "). Avant ce GOAL la page l'affichait brute (whiteSpace:pre-wrap) :
 * astérisques visibles, aucun titre, aucune section aérée → un bloc compact.
 *
 * Ce composant parse uniquement ce markdown minimal et le rend en sections lisibles :
 * titres visibles, paragraphes espacés, listes propres. Aucune dépendance externe.
 * Le contenu vient d'un LLM : il n'est JAMAIS injecté comme HTML brut — uniquement
 * comme texte React (pas d'injection HTML directe). Le parseur est une fonction PURE
 * exportée, testable sans DOM.
 */

export type NarrativeNode =
  | { type: 'heading'; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'list'; items: string[] };

/** Retire le gras markdown ** ** et compacte les espaces internes d'une ligne. */
function stripInlineMarkdown(s: string): string {
  return s.replace(/\*\*/g, '').replace(/\s+/g, ' ').trim();
}

/** Une ligne est-elle une puce de liste ("- " ou "• ") ? */
function listItemText(line: string): string | null {
  const m = line.match(/^\s*(?:[-•])\s+(.*)$/);
  return m ? m[1].trim() : null;
}

/**
 * Un bloc est un titre s'il est intégralement entouré de ** ** (titre gras seul),
 * éventuellement suivi d'un ":" final. Ex : "**Sécurité**", "**1. Résumé exécutif**",
 * "**Risques résiduels :**".
 */
function headingText(block: string): string | null {
  const trimmed = block.trim();
  // Un titre tient sur une seule ligne logique (pas de saut interne) → si le bloc
  // contient un saut de ligne, ce n'est pas un titre seul.
  if (trimmed.includes('\n')) return null;
  const m = trimmed.match(/^\*\*(.+?)\*\*\s*:?\s*$/);
  if (!m) return null;
  return stripInlineMarkdown(m[1]).replace(/:$/, '').trim();
}

/**
 * Parse une narrative markdown légère en AST minimal.
 * Pur, robuste : retourne [] sur entrée vide/nulle ; ne jette jamais.
 */
export function parseNarrative(narrative: string | null | undefined): NarrativeNode[] {
  if (!narrative || typeof narrative !== 'string') return [];
  // Découpe en blocs sur lignes vides.
  const blocks = narrative
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter(Boolean);

  const nodes: NarrativeNode[] = [];

  for (const block of blocks) {
    // 1) Titre seul.
    const heading = headingText(block);
    if (heading) {
      nodes.push({ type: 'heading', text: heading });
      continue;
    }

    // 2) Bloc composé de lignes — certaines peuvent être des puces.
    const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
    const allItems = lines.every((l) => listItemText(l) !== null);

    if (lines.length > 0 && allItems) {
      // Bloc entièrement constitué de puces → une liste.
      nodes.push({
        type: 'list',
        items: lines.map((l) => stripInlineMarkdown(listItemText(l)!)),
      });
      continue;
    }

    // 3) Bloc mixte ou texte : on émet paragraphes et listes en séparant les puces.
    let pending: string[] = [];
    let bullets: string[] = [];

    const flushParagraph = () => {
      if (pending.length > 0) {
        nodes.push({ type: 'paragraph', text: stripInlineMarkdown(pending.join(' ')) });
        pending = [];
      }
    };
    const flushList = () => {
      if (bullets.length > 0) {
        nodes.push({ type: 'list', items: bullets.map(stripInlineMarkdown) });
        bullets = [];
      }
    };

    for (const line of lines) {
      const item = listItemText(line);
      if (item !== null) {
        flushParagraph();
        bullets.push(item);
      } else {
        flushList();
        pending.push(line);
      }
    }
    flushParagraph();
    flushList();
  }

  return nodes;
}

// ── Rendu ───────────────────────────────────────────────────────────────────────

interface Props {
  narrative: string;
}

/**
 * Rend la narrative premium en sections lisibles, sans dangerouslySetInnerHTML.
 * Typographie alignée sur la page destination (ctv3-serif / ctv3-mono).
 */
export function NarrativeRenderer({ narrative }: Props) {
  const nodes = parseNarrative(narrative);

  // Garde-fou : si le parseur ne produit rien (narrative atypique), on retombe sur
  // un rendu texte simple plutôt que rien — la valeur reste visible.
  if (nodes.length === 0) {
    return (
      <div
        data-testid="narrative-rendered"
        className="ctv3-serif"
        style={{ fontSize: 15, lineHeight: 1.6, color: 'var(--ctv3-paper)', whiteSpace: 'pre-wrap' }}
      >
        {narrative}
      </div>
    );
  }

  return (
    <div data-testid="narrative-rendered" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {nodes.map((node, i) => {
        if (node.type === 'heading') {
          return (
            <h3
              key={i}
              className="ctv3-mono"
              style={{
                fontSize: 11.5,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                fontWeight: 700,
                color: 'var(--ctv3-blue)',
                margin: '18px 0 4px',
                paddingTop: i === 0 ? 0 : 6,
              }}
            >
              {node.text}
            </h3>
          );
        }
        if (node.type === 'list') {
          return (
            <ul
              key={i}
              style={{
                listStyle: 'none',
                margin: '4px 0 8px',
                padding: 0,
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
              }}
            >
              {node.items.map((item, j) => (
                <li
                  key={j}
                  className="ctv3-serif"
                  style={{ fontSize: 14, lineHeight: 1.55, color: 'var(--ctv3-paper)', display: 'flex', gap: 9 }}
                >
                  <span aria-hidden style={{ color: 'var(--ctv3-blue)', fontWeight: 700, flexShrink: 0 }}>·</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          );
        }
        return (
          <p
            key={i}
            className="ctv3-serif"
            style={{ fontSize: 15, lineHeight: 1.65, color: 'var(--ctv3-paper)', margin: '4px 0 8px' }}
          >
            {node.text}
          </p>
        );
      })}
    </div>
  );
}
