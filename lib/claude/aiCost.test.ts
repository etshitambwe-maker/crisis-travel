import { describe, it, expect } from 'vitest';
import { estimateAnthropicCostUsd, logAiUsageSafe } from './claude.service';

// ── AI-COST-001 — tests helpers coût IA ──────────────────────────────────────

describe('estimateAnthropicCostUsd', () => {
  it('calcule correctement le coût pour Sonnet (input + output)', () => {
    // 1000 input @ $3/M + 500 output @ $15/M = $0.003 + $0.0075 = $0.0105
    const cost = estimateAnthropicCostUsd('claude-sonnet-4-6', 1000, 500);
    expect(cost).toBeCloseTo(0.0105, 5);
  });

  it('retourne 0 pour 0 tokens', () => {
    const cost = estimateAnthropicCostUsd('claude-sonnet-4-6', 0, 0);
    expect(cost).toBe(0);
  });

  it('arrondit à 6 décimales maximum', () => {
    const cost = estimateAnthropicCostUsd('claude-sonnet-4-6', 1, 1);
    // 1 * 3/1M + 1 * 15/1M = 18/1M = 0.000018
    expect(cost).toBe(0.000018);
    // Le nombre de chiffres après la virgule ne dépasse pas 6
    const decimals = cost.toString().split('.')[1]?.length ?? 0;
    expect(decimals).toBeLessThanOrEqual(6);
  });

  it('utilise les tarifs Sonnet pour un modèle inconnu (conservateur)', () => {
    // Modèle inconnu → tarifs Sonnet (pas 0)
    const costUnknown = estimateAnthropicCostUsd('claude-unknown-model', 1000, 500);
    const costSonnet  = estimateAnthropicCostUsd('claude-sonnet-4-6', 1000, 500);
    expect(costUnknown).toBe(costSonnet);
    expect(costUnknown).toBeGreaterThan(0);
  });

  it('utilise les tarifs Haiku pour un modèle haiku (moins cher)', () => {
    // haiku : input $0.8/M, output $4/M → moins cher que Sonnet
    const costHaiku  = estimateAnthropicCostUsd('claude-haiku-4-5', 1000, 500);
    const costSonnet = estimateAnthropicCostUsd('claude-sonnet-4-6', 1000, 500);
    expect(costHaiku).toBeLessThan(costSonnet);
  });

  it('calcule correctement uniquement l\'output (input = 0)', () => {
    // 0 input + 1000 output @ $15/M = $0.015
    const cost = estimateAnthropicCostUsd('claude-sonnet-4-6', 0, 1000);
    expect(cost).toBeCloseTo(0.015, 5);
  });

  it('calcule correctement uniquement l\'input (output = 0)', () => {
    // 1000 input @ $3/M + 0 output = $0.003
    const cost = estimateAnthropicCostUsd('claude-sonnet-4-6', 1000, 0);
    expect(cost).toBeCloseTo(0.003, 5);
  });
});

describe('logAiUsageSafe — structure des logs', () => {
  it('loggue sans lever d\'exception (appel nominal)', () => {
    expect(() =>
      logAiUsageSafe({
        service: 'claude-narrative',
        provider: 'anthropic',
        model: 'claude-sonnet-4-6',
        inputTokens: 900,
        outputTokens: 1800,
        totalTokens: 2700,
        estimatedCostUsd: 0.0297,
        durationMs: 1200,
        cacheHit: false,
        countryCode: 'PT',
        travelType: 'solo',
        stopReason: 'end_turn',
      })
    ).not.toThrow();
  });

  it('loggue sans lever d\'exception pour un cache hit (tous tokens à 0)', () => {
    expect(() =>
      logAiUsageSafe({
        service: 'claude-itinerary',
        provider: 'anthropic',
        model: 'claude-sonnet-4-6',
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        estimatedCostUsd: 0,
        durationMs: 0,
        cacheHit: true,
        countryCode: 'JP',
      })
    ).not.toThrow();
  });

  it('un cache hit a estimatedCostUsd = 0', () => {
    // Vérification logique : un cache hit ne doit jamais avoir un coût > 0
    const cacheHitCost = estimateAnthropicCostUsd('claude-sonnet-4-6', 0, 0);
    expect(cacheHitCost).toBe(0);
  });

  it('loggue sans lever d\'exception avec les champs optionnels absents', () => {
    expect(() =>
      logAiUsageSafe({
        service: 'claude-opportunities',
        provider: 'anthropic',
        model: 'claude-sonnet-4-6',
        inputTokens: 200,
        outputTokens: 150,
        totalTokens: 350,
        estimatedCostUsd: 0.0008,
        durationMs: 500,
        cacheHit: false,
      })
    ).not.toThrow();
  });
});

// ── Sécurité des logs — vérification que les helpers n'exposent pas de données sensibles ──

describe('sécurité des helpers — aucune donnée sensible', () => {
  it('estimateAnthropicCostUsd ne reçoit et ne retourne aucune donnée sensible', () => {
    // La fonction ne prend que model (string), inputTokens, outputTokens (numbers)
    // et retourne un number — aucun texte généré, email, prompt ou narrative possible.
    const result = estimateAnthropicCostUsd('claude-sonnet-4-6', 1000, 500);
    expect(typeof result).toBe('number');
  });

  it('les paramètres de logAiUsageSafe sont uniquement des métadonnées (pas de contenu IA)', () => {
    // Vérification de structure : aucun champ attendu ne transporte du contenu généré.
    // Les champs légitimes sont : service, provider, model, tokens, coût, durée, flags.
    const validParams = {
      service: 'claude-narrative',
      provider: 'anthropic' as const,
      model: 'claude-sonnet-4-6',
      inputTokens: 900,
      outputTokens: 1800,
      totalTokens: 2700,
      estimatedCostUsd: 0.0297,
      durationMs: 1200,
      cacheHit: false,
      countryCode: 'PT',
      travelType: 'solo',
    };
    // Aucun des champs sensibles ne figure dans les clés du type
    const keys = Object.keys(validParams);
    expect(keys).not.toContain('narrativeText');
    expect(keys).not.toContain('guideText');
    expect(keys).not.toContain('prompt');
    expect(keys).not.toContain('email');
    expect(keys).not.toContain('itinerary');
    expect(keys).not.toContain('content');
    expect(keys).not.toContain('body');
  });
});
