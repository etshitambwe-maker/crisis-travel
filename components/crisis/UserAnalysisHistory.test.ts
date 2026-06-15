import { describe, it, expect } from 'vitest';
import { buildDestinationUrl, formatAnalysisDate } from './UserAnalysisHistory';

describe('buildDestinationUrl', () => {
  it('construit l\'URL avec tous les paramètres', () => {
    const url = buildDestinationUrl({
      countryCode: 'PT',
      travelType: 'family',
      duration: 14,
      budget: 3000,
      mode: 'standard',
    });
    expect(url).toBe('/destination/pt?travelType=family&duration=14&budget=3000&mode=standard');
  });

  it('omet les paramètres undefined', () => {
    const url = buildDestinationUrl({ countryCode: 'JP' });
    expect(url).toBe('/destination/jp');
  });

  it('normalise le countryCode en lowercase pour l\'URL', () => {
    const url = buildDestinationUrl({ countryCode: 'US', travelType: 'solo' });
    expect(url).toBe('/destination/us?travelType=solo');
  });

  it('inclut le mode bunker si spécifié', () => {
    const url = buildDestinationUrl({ countryCode: 'CH', mode: 'bunker' });
    expect(url).toContain('mode=bunker');
  });
});

describe('formatAnalysisDate', () => {
  it('formate une date ISO en date lisible dd/mm/yyyy', () => {
    const result = formatAnalysisDate('2026-06-15T10:00:00Z');
    // fr-FR : 15/06/2026
    expect(result).toMatch(/\d{2}\/\d{2}\/\d{4}/);
  });

  it('retourne une date cohérente pour le 1er janvier', () => {
    const result = formatAnalysisDate('2026-01-01T00:00:00Z');
    expect(result).toContain('2026');
  });
});
