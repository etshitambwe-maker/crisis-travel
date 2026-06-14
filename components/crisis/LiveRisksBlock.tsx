import { buildLiveRisksBlock } from '@/lib/services/summary/liveRisks';

/**
 * PREMIUM-GUIDE-001A — Rend les risques/événements terrain (Perplexity, remontés
 * par le scoring) en bloc « guide » lisible, dans la section premium « Aller plus
 * loin ». Server Component pur : pas d'état, pas d'effet. Le contenu vient d'un LLM
 * et n'est JAMAIS injecté en HTML brut — uniquement comme texte React.
 *
 * N'affiche rien si aucune donnée terrain n'est disponible (Perplexity en fallback,
 * ou pays sans risque/événement remonté) — pas de section vide.
 */

interface Props {
  liveRisks?: string[];
  recentEvents?: string[];
}

function RiskGroup({
  label,
  accent,
  marker,
  items,
}: {
  label: string;
  accent: string;
  marker: string;
  items: string[];
}) {
  if (items.length === 0) return null;
  return (
    <div>
      <div
        className="ctv3-mono"
        style={{ fontSize: 9.5, letterSpacing: '0.14em', textTransform: 'uppercase', color: accent, marginBottom: 8 }}
      >
        {label}
      </div>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {items.map((item, i) => (
          <li
            key={i}
            className="ctv3-serif"
            style={{ fontSize: 13.5, color: 'var(--ctv3-paper)', display: 'flex', gap: 9, lineHeight: 1.5 }}
          >
            <span aria-hidden style={{ color: accent, fontWeight: 700, flexShrink: 0 }}>{marker}</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function LiveRisksBlock({ liveRisks, recentEvents }: Props) {
  const block = buildLiveRisksBlock(liveRisks, recentEvents);
  if (!block.hasContent) return null;

  return (
    <div
      data-testid="live-risks-block"
      style={{
        marginTop: 18,
        paddingTop: 16,
        borderTop: '1px solid var(--ctv3-line-soft)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <span
          className="ctv3-mono"
          style={{ fontSize: 10.5, letterSpacing: '0.16em', textTransform: 'uppercase', fontWeight: 700, color: 'var(--ctv3-paper)' }}
        >
          Sur le terrain en ce moment
        </span>
        <span
          className="ctv3-mono"
          style={{ marginLeft: 'auto', fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--ctv3-faint)' }}
        >
          Sources temps réel
        </span>
      </div>

      <p
        className="ctv3-serif"
        style={{ fontSize: 13.5, color: 'var(--ctv3-muted)', lineHeight: 1.55, margin: '0 0 14px' }}
      >
        {block.intro}
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
        <RiskGroup
          label="Risques récents à connaître"
          accent="var(--ctv3-reco)"
          marker="!"
          items={block.risks}
        />
        <RiskGroup
          label="Événements récents à surveiller"
          accent="var(--ctv3-blue)"
          marker="›"
          items={block.events}
        />
      </div>
    </div>
  );
}
