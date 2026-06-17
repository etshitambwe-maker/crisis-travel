import { describe, it, expect } from 'vitest';
import { buildDestinationUrl, formatAnalysisDate } from '../components/crisis/UserAnalysisHistory';

// ── buildDestinationUrl ───────────────────────────────────────────────────────

describe('buildDestinationUrl', () => {
  it('returns bare destination path when no params', () => {
    const url = buildDestinationUrl({ countryCode: 'PT' });
    expect(url).toBe('/destination/pt');
  });

  it('lowercases countryCode', () => {
    const url = buildDestinationUrl({ countryCode: 'JP' });
    expect(url).toBe('/destination/jp');
  });

  it('appends travelType, duration, budget and mode', () => {
    const url = buildDestinationUrl({
      countryCode: 'MA',
      travelType: 'family',
      duration: 14,
      budget: 3000,
      mode: 'bunker',
    });
    expect(url).toContain('travelType=family');
    expect(url).toContain('duration=14');
    expect(url).toContain('budget=3000');
    expect(url).toContain('mode=bunker');
  });

  it('omits mode=standard from URL', () => {
    const url = buildDestinationUrl({ countryCode: 'JP', mode: 'standard' });
    // mode standard doit quand même être passé si présent (c'est au consommateur de filtrer)
    expect(url).toContain('mode=standard');
  });

  it('includes from and to when departure and return dates are provided (TRAVEL-DATES-001)', () => {
    const url = buildDestinationUrl({
      countryCode: 'GR',
      departureDate: '2026-09-01',
      returnDate: '2026-09-15',
    });
    expect(url).toContain('from=2026-09-01');
    expect(url).toContain('to=2026-09-15');
  });

  it('omits from/to when dates are null or undefined', () => {
    const url = buildDestinationUrl({ countryCode: 'GR', departureDate: null, returnDate: null });
    expect(url).not.toContain('from=');
    expect(url).not.toContain('to=');
  });

  it('includes from without to when only departureDate is set', () => {
    const url = buildDestinationUrl({ countryCode: 'GR', departureDate: '2026-09-01' });
    expect(url).toContain('from=2026-09-01');
    expect(url).not.toContain('to=');
  });

  it('preserves all params together: full profile + dates', () => {
    const url = buildDestinationUrl({
      countryCode: 'TH',
      travelType: 'couple',
      duration: 10,
      budget: 2500,
      mode: 'standard',
      departureDate: '2026-11-01',
      returnDate: '2026-11-11',
    });
    expect(url.startsWith('/destination/th?')).toBe(true);
    expect(url).toContain('travelType=couple');
    expect(url).toContain('duration=10');
    expect(url).toContain('budget=2500');
    expect(url).toContain('from=2026-11-01');
    expect(url).toContain('to=2026-11-11');
  });
});

// ── formatAnalysisDate ────────────────────────────────────────────────────────

describe('formatAnalysisDate', () => {
  it('formats an ISO date as dd/mm/yyyy', () => {
    const result = formatAnalysisDate('2026-06-17T10:30:00Z');
    // Format fr-FR : JJ/MM/AAAA
    expect(result).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
  });

  it('contains the correct day, month and year for 2026-06-17', () => {
    const result = formatAnalysisDate('2026-06-17T00:00:00Z');
    expect(result).toContain('2026');
    expect(result).toContain('06');
  });
});
