import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// FRONTEND-CLARITY-001 Gate 2 — composant CollapsibleSection.
//
// Style source-assertion (repo en env `node`, sans testing-library/jsdom) :
// on vérifie les contrats structurels du composant et son intégration dans la
// fiche destination, comme DestinationPremiumFlow.test.ts / PremiumGate.test.ts.

function read(rel: string): string {
  return readFileSync(resolve(process.cwd(), rel), 'utf-8');
}

const COMPONENT = 'components/crisis/CollapsibleSection.tsx';
const DEST_PAGE = 'app/destination/[country]/page.tsx';

describe('CollapsibleSection — contrats du composant', () => {
  it("est un composant client ('use client')", () => {
    expect(read(COMPONENT)).toMatch(/^['"]use client['"]/);
  });

  it('utilise un état local useState (pas d\'état global, pas de dépendance externe)', () => {
    const src = read(COMPONENT);
    expect(src).toMatch(/useState/);
    expect(src).not.toMatch(/from\s+['"]zustand['"]|createContext|redux/);
  });

  it("expose un bouton accessible avec aria-expanded lié à l'état ouvert", () => {
    const src = read(COMPONENT);
    expect(src).toMatch(/<button/);
    expect(src).toMatch(/aria-expanded=\{open\}/);
    expect(src).toMatch(/aria-controls=/);
  });

  it('accepte une prop title et une prop defaultOpen', () => {
    const src = read(COMPONENT);
    expect(src).toMatch(/title/);
    expect(src).toMatch(/defaultOpen/);
  });

  it("le clic bascule l'état (toggle)", () => {
    const src = read(COMPONENT);
    expect(src).toMatch(/onClick=\{\(\)\s*=>\s*setOpen\(\(v\)\s*=>\s*!v\)\}/);
  });

  it('le contenu (children) est toujours monté et seulement masqué quand replié (hidden)', () => {
    const src = read(COMPONENT);
    // children rendu inconditionnellement, masqué via `hidden={!open}` — jamais démonté.
    expect(src).toMatch(/hidden=\{!open\}/);
    expect(src).toMatch(/\{children\}/);
    // pas de rendu conditionnel qui démonterait le contenu (anti-suppression).
    expect(src).not.toMatch(/\{open\s*&&\s*children\}/);
  });

  it('tap target suffisant (padding vertical >= 14px sur le bouton)', () => {
    const src = read(COMPONENT);
    expect(src).toMatch(/padding:\s*['"]14px/);
  });
});

describe('CollapsibleSection — intégration fiche destination (FRONTEND-CLARITY-001)', () => {
  it('la page importe et utilise CollapsibleSection', () => {
    const src = read(DEST_PAGE);
    expect(src).toMatch(/import\s*\{\s*CollapsibleSection\s*\}/);
    expect(src).toMatch(/<CollapsibleSection/);
  });

  it('regroupe « Comprendre le score », « Infos pratiques », « Évolution & préparer », « Pack voyage »', () => {
    const src = read(DEST_PAGE);
    expect(src).toContain('title="Comprendre le score"');
    expect(src).toContain('title="Infos pratiques"');
    expect(src).toContain('title="Évolution & préparer"');
    expect(src).toContain('title="Pack voyage"');
  });

  it('aucun accordéon de premier niveau n\'est ouvert par défaut (defaultOpen non posé)', () => {
    const src = read(DEST_PAGE);
    // Les accordéons de structure ne portent pas defaultOpen → fermés par défaut.
    // (le seul defaultOpen autorisé serait explicite ; on vérifie qu'il n'y en a pas.)
    expect(src).not.toMatch(/<CollapsibleSection[^>]*defaultOpen/);
  });
});
