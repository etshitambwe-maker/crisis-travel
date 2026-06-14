import { describe, it, expect } from 'vitest';
import { buildLiveRisksBlock } from './liveRisks';

/**
 * PREMIUM-GUIDE-001A — Helper PUR de présentation des risques/événements terrain
 * (issus de Perplexity via le scoring). Transforme deux tableaux bruts en un bloc
 * « guide » lisible : groupes titrés, intro de ton conseil, nettoyage, dédup, cap.
 * Aucune dépendance DOM/réseau — testable directement.
 */

describe('buildLiveRisksBlock', () => {
  it('retourne hasContent=false quand les deux listes sont vides/absentes', () => {
    expect(buildLiveRisksBlock(undefined, undefined).hasContent).toBe(false);
    expect(buildLiveRisksBlock([], []).hasContent).toBe(false);
  });

  it('produit un groupe risques quand mainRisks est non vide', () => {
    const b = buildLiveRisksBlock(['Pickpockets fréquents'], []);
    expect(b.hasContent).toBe(true);
    expect(b.risks).toEqual(['Pickpockets fréquents']);
    expect(b.events).toEqual([]);
  });

  it('produit un groupe événements quand recentEvents est non vide', () => {
    const b = buildLiveRisksBlock([], ['Grève des transports récente']);
    expect(b.hasContent).toBe(true);
    expect(b.events).toEqual(['Grève des transports récente']);
    expect(b.risks).toEqual([]);
  });

  it('nettoie les entrées : trim, retrait du markdown gras, suppression des vides', () => {
    const b = buildLiveRisksBlock(['  **Risque A**  ', '', '   '], ['Événement B  ']);
    expect(b.risks).toEqual(['Risque A']);
    expect(b.events).toEqual(['Événement B']);
  });

  it('déduplique (insensible à la casse et aux espaces) dans chaque groupe', () => {
    const b = buildLiveRisksBlock(['Vol à la tire', 'vol à la tire', 'Vol à la tire '], []);
    expect(b.risks).toEqual(['Vol à la tire']);
  });

  it('plafonne chaque groupe à 5 entrées maximum', () => {
    const many = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
    const b = buildLiveRisksBlock(many, many);
    expect(b.risks).toHaveLength(5);
    expect(b.events).toHaveLength(5);
  });

  it('fournit une intro courte de ton conseil quand il y a du contenu', () => {
    const b = buildLiveRisksBlock(['Risque'], []);
    expect(b.intro.length).toBeGreaterThan(0);
    // L'intro reste une simple chaîne de contexte, jamais une promesse de sécurité absolue.
    expect(b.intro.toLowerCase()).not.toContain('aucun risque');
  });

  it('ignore les valeurs non-string éventuelles sans jeter', () => {
    // Entrées potentiellement bruitées venant d'un LLM.
    const b = buildLiveRisksBlock(['Ok', null as unknown as string, 42 as unknown as string], []);
    expect(b.risks).toEqual(['Ok']);
  });
});
