'use client';

/**
 * CollapsibleSection — FRONTEND-CLARITY-001 Gate 2
 *
 * Section repliable légère pour la fiche destination. Réutilise l'esthétique de
 * `SectionLabel` (mono uppercase + losange rouge + meta) mais transforme l'en-tête
 * en bouton accessible qui masque/affiche son contenu.
 *
 * Invariants :
 *  - état LOCAL uniquement (useState) — aucun état global, aucune dépendance externe.
 *  - le contenu (`children`) est TOUJOURS monté côté React ; on le masque seulement
 *    visuellement (display:none) quand replié. Cela garantit qu'aucune information
 *    ni aucun composant enfant n'est supprimé : tout reste dans le DOM et accessible
 *    en un clic (FRONTEND-CLARITY-001 : on replie, on ne supprime jamais).
 *  - tap target ≥ 44px (en-tête padding vertical) pour le mobile.
 *  - aria-expanded + aria-controls pour l'accessibilité clavier/lecteur d'écran.
 */

import { useId, useState, type ReactNode } from 'react';

export function CollapsibleSection({
  num,
  title,
  meta,
  defaultOpen = false,
  children,
}: {
  num?: ReactNode;
  title: ReactNode;
  meta?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();

  return (
    <div style={{ marginBottom: 16 }}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
        className="ctv3-mono"
        style={{
          // En-tête cliquable — reprend SectionLabel (losange rouge + mono uppercase).
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          // ≥ 44px de hauteur tactile (padding 14 haut/bas + ligne de texte).
          padding: '14px 0',
          background: 'transparent',
          border: 'none',
          borderBottom: '1px solid var(--ctv3-line-soft)',
          cursor: 'pointer',
          textAlign: 'left',
          color: 'var(--ctv3-paper)',
          fontSize: 10,
          letterSpacing: '0.22em',
          textTransform: 'uppercase',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <span
            aria-hidden
            style={{ width: 5, height: 5, background: 'var(--ctv3-red)', transform: 'rotate(45deg)', flexShrink: 0 }}
          />
          {num != null && <span style={{ color: 'var(--ctv3-faint)', fontWeight: 500 }}>{num}</span>}
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</span>
        </span>

        <span style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          {meta != null && (
            <span style={{ fontSize: 9.5, letterSpacing: '0.16em', color: 'var(--ctv3-faint)' }}>{meta}</span>
          )}
          {/* Chevron rotatif — indicateur d'état ouvert/fermé. */}
          <span
            aria-hidden
            style={{
              fontSize: 11,
              color: 'var(--ctv3-faint)',
              transition: 'transform 0.18s ease',
              transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
              display: 'inline-block',
            }}
          >
            ▾
          </span>
        </span>
      </button>

      {/* Contenu : toujours monté, masqué visuellement quand replié. */}
      <div id={panelId} hidden={!open} style={{ paddingTop: open ? 16 : 0 }}>
        {children}
      </div>
    </div>
  );
}
