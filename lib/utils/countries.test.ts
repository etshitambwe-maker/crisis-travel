import { describe, it, expect } from 'vitest';
import { searchCountries, getSearchState } from './countries';

describe('searchCountries (couverture du dataset)', () => {
  it('trouve un pays couvert par son nom FR (Albanie)', () => {
    const r = searchCountries('albanie');
    expect(r.some((c) => c.code === 'AL')).toBe(true);
  });

  it('trouve un pays couvert par alias EN (georgia → Géorgie)', () => {
    const r = searchCountries('georgia');
    expect(r.some((c) => c.code === 'GE')).toBe(true);
  });

  it('trouve un pays couvert par code (TH)', () => {
    const r = searchCountries('TH');
    expect(r.some((c) => c.code === 'TH')).toBe(true);
  });

  it('ne trouve RIEN pour une destination hors périmètre (Italie)', () => {
    expect(searchCountries('italie')).toEqual([]);
    expect(searchCountries('italy')).toEqual([]);
  });

  it('ne trouve RIEN pour une ville hors périmètre (Rome)', () => {
    expect(searchCountries('rome')).toEqual([]);
  });
});

describe('getSearchState (logique d\'affichage GOAL-037)', () => {
  it('query vide → idle (rien affiché)', () => {
    expect(getSearchState('').kind).toBe('idle');
  });

  it('1 caractère qui ne matche aucun pays → idle (pas de message trop tôt)', () => {
    // '2' ne matche aucun pays/alias et on est sous le seuil de 2 caractères → idle.
    // (À 1 lettre alphabétique, le substring matche presque toujours quelque chose ;
    //  un chiffre isole proprement le cas « sous le seuil, zéro résultat ».)
    expect(getSearchState('2').kind).toBe('idle');
  });

  it('2 caractères avec résultats → results', () => {
    const s = getSearchState('al'); // Albanie, etc.
    expect(s.kind).toBe('results');
    expect(s.results.length).toBeGreaterThan(0);
  });

  it('"italie" (mot entier hors périmètre) → uncovered', () => {
    expect(getSearchState('italie').kind).toBe('uncovered');
    expect(getSearchState('italy').kind).toBe('uncovered');
  });

  it('"ita" (≥2 car, aucun match) → uncovered', () => {
    // dès 3 lettres, le substring ne ramène plus de faux positif → vrai "hors couverture"
    expect(getSearchState('ita').kind).toBe('uncovered');
  });

  it('"rome" (ville hors périmètre) → uncovered', () => {
    const s = getSearchState('rome');
    expect(s.kind).toBe('uncovered');
    expect(s.results).toEqual([]);
  });

  it('un pays couvert tapé en entier reste en results (Vietnam)', () => {
    expect(getSearchState('vietnam').kind).toBe('results');
  });

  it('1 caractère QUI matche un pays → results', () => {
    // sous 2 caractères, on affiche quand même le dropdown s'il y a des résultats réels
    const s = getSearchState('p'); // Portugal, Pérou, Philippines, Panama, Paraguay...
    expect(s.kind).toBe('results');
    expect(s.results.length).toBeGreaterThan(0);
  });
});
