import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { parseNarrative } from '@/components/crisis/NarrativeRenderer';

// PREMIUM-EXPERIENCE-001 — Rendu premium structuré.
// ─────────────────────────────────────────────────────────────────────────────
// La narrative Claude est une string markdown LÉGER (titres **gras**, paragraphes
// séparés par lignes vides, listes "- " / "• "). Avant ce GOAL elle était rendue
// brute (whiteSpace:pre-wrap) → astérisques visibles, pas de titres, bloc compact.
//
// `parseNarrative` est une fonction PURE testable sans DOM (le repo n'a ni jsdom ni
// testing-library). Elle produit un AST minimal { heading | paragraph | list } que
// le composant rend en sections lisibles. Les tests source-assertion en complément
// garantissent l'absence de dangerouslySetInnerHTML et l'usage dans la page.

function read(rel: string): string {
  return readFileSync(resolve(process.cwd(), rel), 'utf-8');
}

const RENDERER = 'components/crisis/NarrativeRenderer.tsx';
const DEST_PAGE = 'app/destination/[country]/page.tsx';

describe('parseNarrative — titres', () => {
  it('reconnaît un titre numéroté en gras "**1. Résumé exécutif**" comme heading', () => {
    const nodes = parseNarrative('**1. Résumé exécutif**\n\nUn paragraphe.');
    const heading = nodes.find((n) => n.type === 'heading');
    expect(heading).toBeDefined();
    // le texte du titre ne contient PAS les astérisques markdown
    expect(heading!.text).not.toContain('*');
    expect(heading!.text).toContain('Résumé exécutif');
  });

  it('reconnaît un titre simple en gras "**Sécurité**" comme heading', () => {
    const nodes = parseNarrative('**Sécurité**\n\nContenu.');
    const heading = nodes.find((n) => n.type === 'heading');
    expect(heading).toBeDefined();
    expect(heading!.text).toBe('Sécurité');
  });

  it('un paragraphe normal n\'est PAS traité comme un titre', () => {
    const nodes = parseNarrative('Ceci est un paragraphe ordinaire sans gras entourant.');
    expect(nodes.every((n) => n.type !== 'heading')).toBe(true);
  });
});

describe('parseNarrative — paragraphes', () => {
  it('sépare deux paragraphes distincts sur ligne vide', () => {
    const nodes = parseNarrative('Premier paragraphe.\n\nDeuxième paragraphe.');
    const paragraphs = nodes.filter((n) => n.type === 'paragraph');
    expect(paragraphs.length).toBe(2);
    expect(paragraphs[0].text).toBe('Premier paragraphe.');
    expect(paragraphs[1].text).toBe('Deuxième paragraphe.');
  });

  it('nettoie le gras inline résiduel dans un paragraphe (pas d\'astérisques visibles)', () => {
    const nodes = parseNarrative('Un score de **70/100** reste correct.');
    const p = nodes.find((n) => n.type === 'paragraph');
    expect(p).toBeDefined();
    expect(p!.text).not.toContain('*');
    expect(p!.text).toContain('70/100');
  });
});

describe('parseNarrative — listes', () => {
  it('regroupe des puces "- " consécutives en une liste avec items', () => {
    const nodes = parseNarrative('Avant départ :\n\n- Vérifier diplomatie.gouv\n- Souscrire une assurance\n- S\'inscrire sur Ariane');
    const list = nodes.find((n) => n.type === 'list');
    expect(list).toBeDefined();
    expect(list!.items!.length).toBe(3);
    expect(list!.items![0]).not.toContain('-');
    expect(list!.items![0]).toContain('diplomatie.gouv');
  });

  it('reconnaît aussi les puces "• "', () => {
    const nodes = parseNarrative('• Premier point\n• Second point');
    const list = nodes.find((n) => n.type === 'list');
    expect(list).toBeDefined();
    expect(list!.items!.length).toBe(2);
  });
});

describe('parseNarrative — robustesse', () => {
  it('retourne un tableau vide sur entrée vide', () => {
    expect(parseNarrative('')).toEqual([]);
    expect(parseNarrative('   \n\n  ')).toEqual([]);
  });

  it('ne jette jamais sur une narrative complète multi-sections', () => {
    const sample = [
      '**1. Résumé exécutif**',
      '',
      'Le Maroc est une destination recommandée.',
      '',
      '**2. Situation sécuritaire**',
      '',
      'Score 70/100. Zones touristiques sûres.',
      '',
      '**Risques résiduels :**',
      '',
      '- Vérifier les alertes officielles',
      '- Souscrire une assurance',
    ].join('\n');
    const nodes = parseNarrative(sample);
    expect(nodes.length).toBeGreaterThan(3);
    expect(nodes.filter((n) => n.type === 'heading').length).toBeGreaterThanOrEqual(2);
    expect(nodes.filter((n) => n.type === 'list').length).toBe(1);
  });
});

// ── Source-assertions : sécurité + intégration ──────────────────────────────────

describe('NarrativeRenderer — contraintes sécurité', () => {
  it('n\'utilise PAS dangerouslySetInnerHTML (comme attribut JSX)', () => {
    const src = read(RENDERER);
    // On vise l'usage réel (attribut JSX), pas une simple mention en commentaire.
    expect(src).not.toMatch(/dangerouslySetInnerHTML\s*=/);
  });

  it('n\'importe pas de grosse librairie markdown (react-markdown, marked, markdown-it)', () => {
    const src = read(RENDERER);
    expect(src).not.toMatch(/from\s+['"]react-markdown['"]/);
    expect(src).not.toMatch(/from\s+['"]marked['"]/);
    expect(src).not.toMatch(/from\s+['"]markdown-it['"]/);
  });
});

describe('NarrativeRenderer — intégration page destination', () => {
  it('la page importe NarrativeRenderer', () => {
    const src = read(DEST_PAGE);
    expect(src).toMatch(/NarrativeRenderer/);
  });

  it('la page ne rend plus la narrative en bloc brut whiteSpace:pre-wrap', () => {
    const src = read(DEST_PAGE);
    // L'ancien rendu compact { narrative } dans un div pre-wrap doit avoir disparu.
    expect(src).not.toMatch(/whiteSpace:\s*['"]pre-wrap['"][^}]*}}\s*>\s*\{narrative\}/);
  });
});
