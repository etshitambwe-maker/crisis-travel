import { describe, it, expect } from 'vitest';
import { buildBookingUrl, ADULTS_BY_TYPE } from '../components/crisis/TravelPackMiniBlock';

// ── ADULTS_BY_TYPE mapping ────────────────────────────────────────────────────

describe('ADULTS_BY_TYPE', () => {
  it('solo = 1', () => expect(ADULTS_BY_TYPE.solo).toBe(1));
  it('couple = 2', () => expect(ADULTS_BY_TYPE.couple).toBe(2));
  it('family = 2 (minimum)', () => expect(ADULTS_BY_TYPE.family).toBeGreaterThanOrEqual(2));
  it('nomad = 1', () => expect(ADULTS_BY_TYPE.nomad).toBe(1));
});

// ── buildBookingUrl ───────────────────────────────────────────────────────────

describe('buildBookingUrl — base params always present', () => {
  it('includes ss param with country name', () => {
    const url = buildBookingUrl('Japon');
    expect(url).toContain('ss=Japon');
  });

  it('sets lang=fr and currency=EUR', () => {
    const url = buildBookingUrl('Portugal');
    expect(url).toContain('lang=fr');
    expect(url).toContain('currency=EUR');
  });

  it('always sets group_adults (defaults to solo=1)', () => {
    const url = buildBookingUrl('Maroc');
    expect(url).toContain('group_adults=1');
  });

  it('always sets no_rooms=1', () => {
    const url = buildBookingUrl('Thaïlande');
    expect(url).toContain('no_rooms=1');
  });
});

describe('buildBookingUrl — travelType enrichment', () => {
  it('solo → group_adults=1', () => {
    const url = buildBookingUrl('Japon', { travelType: 'solo' });
    expect(url).toContain('group_adults=1');
  });

  it('couple → group_adults=2', () => {
    const url = buildBookingUrl('Italie', { travelType: 'couple' });
    expect(url).toContain('group_adults=2');
  });

  it('family → group_adults=2', () => {
    const url = buildBookingUrl('Espagne', { travelType: 'family' });
    expect(url).toContain('group_adults=2');
  });

  it('nomad → group_adults=1', () => {
    const url = buildBookingUrl('Vietnam', { travelType: 'nomad' });
    expect(url).toContain('group_adults=1');
  });
});

describe('buildBookingUrl — date enrichment', () => {
  it('injects checkin and checkout when both valid and in order', () => {
    const url = buildBookingUrl('Grèce', { checkin: '2025-07-01', checkout: '2025-07-15' });
    expect(url).toContain('checkin=2025-07-01');
    expect(url).toContain('checkout=2025-07-15');
  });

  it('omits dates when checkin === checkout (invalid range)', () => {
    const url = buildBookingUrl('Grèce', { checkin: '2025-07-01', checkout: '2025-07-01' });
    expect(url).not.toContain('checkin=');
    expect(url).not.toContain('checkout=');
  });

  it('omits dates when checkout is before checkin', () => {
    const url = buildBookingUrl('Maroc', { checkin: '2025-07-15', checkout: '2025-07-01' });
    expect(url).not.toContain('checkin=');
    expect(url).not.toContain('checkout=');
  });

  it('omits dates when only checkin provided', () => {
    const url = buildBookingUrl('Portugal', { checkin: '2025-07-01' });
    expect(url).not.toContain('checkin=');
  });

  it('omits dates when only checkout provided', () => {
    const url = buildBookingUrl('Portugal', { checkout: '2025-07-15' });
    expect(url).not.toContain('checkout=');
  });

  it('omits dates when no opts provided (graceful degradation)', () => {
    const url = buildBookingUrl('Thaïlande');
    expect(url).not.toContain('checkin=');
    expect(url).not.toContain('checkout=');
    // But still has adults + rooms
    expect(url).toContain('group_adults=1');
    expect(url).toContain('no_rooms=1');
  });
});

describe('buildBookingUrl — combined opts', () => {
  it('full enrichment: couple + dates', () => {
    const url = buildBookingUrl('Japon', {
      travelType: 'couple',
      checkin: '2025-09-01',
      checkout: '2025-09-15',
    });
    expect(url).toContain('ss=Japon');
    expect(url).toContain('group_adults=2');
    expect(url).toContain('no_rooms=1');
    expect(url).toContain('checkin=2025-09-01');
    expect(url).toContain('checkout=2025-09-15');
    expect(url).toContain('lang=fr');
    expect(url).toContain('currency=EUR');
  });

  it('URL is a valid https URL', () => {
    const url = buildBookingUrl('Maroc', { travelType: 'solo', checkin: '2025-08-01', checkout: '2025-08-10' });
    expect(() => new URL(url)).not.toThrow();
    expect(new URL(url).protocol).toBe('https:');
  });

  it('country name with special characters is encoded', () => {
    const url = buildBookingUrl('Côte d\'Ivoire');
    const parsed = new URL(url);
    expect(parsed.searchParams.get('ss')).toBe("Côte d'Ivoire");
  });
});
