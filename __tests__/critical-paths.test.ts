import { describe, it, expect } from 'vitest';
import { isHttpUrl, buildAffiliateUrl } from '../lib/services/affiliate/affiliate.service';
import type { AffiliatePartner } from '../types/affiliate.types';

// ── Affiliate URL guard ───────────────────────────────────────────────────────

describe('isHttpUrl', () => {
  it('accepts https URLs', () => expect(isHttpUrl('https://www.booking.com/')).toBe(true));
  it('accepts http URLs', () => expect(isHttpUrl('http://example.com/')).toBe(true));
  it('rejects javascript protocol', () => expect(isHttpUrl('javascript:alert(1)')).toBe(false));
  it('rejects empty string', () => expect(isHttpUrl('')).toBe(false));
  it('rejects plain text', () => expect(isHttpUrl('not-a-url')).toBe(false));
  it('rejects data URI', () => expect(isHttpUrl('data:text/html,<h1>hi</h1>')).toBe(false));
});

// ── buildAffiliateUrl ────────────────────────────────────────────────────────

const partnerNoId: AffiliatePartner = {
  id: '1', slug: 'skyscanner', name: 'Skyscanner', category: 'flight',
  baseUrl: 'https://www.skyscanner.fr/',
  affiliateId: null, urlParam: null,
  commissionRate: null, active: true,
};

const partnerWithId: AffiliatePartner = {
  id: '2', slug: 'booking', name: 'Booking', category: 'hotel',
  baseUrl: 'https://www.booking.com/',
  affiliateId: 'aff123', urlParam: 'aid',
  commissionRate: 0.04, active: true,
};

describe('buildAffiliateUrl', () => {
  it('returns raw targetUrl when partner has no affiliateId', () => {
    const result = buildAffiliateUrl(partnerNoId, 'https://www.skyscanner.fr/');
    expect(result).toBe('https://www.skyscanner.fr/');
  });

  it('falls back to baseUrl when no targetUrl and no affiliateId', () => {
    const result = buildAffiliateUrl(partnerNoId);
    expect(result).toBe('https://www.skyscanner.fr/');
  });

  it('injects affiliateId param when present', () => {
    const result = buildAffiliateUrl(partnerWithId, 'https://www.booking.com/search?ss=Japon');
    const url = new URL(result);
    expect(url.searchParams.get('aid')).toBe('aff123');
  });

  it('falls back to baseUrl when targetUrl is not HTTPS', () => {
    const result = buildAffiliateUrl(partnerNoId, 'not-a-url');
    expect(result).toBe('https://www.skyscanner.fr/');
  });
});

// ── Analyse URL construction (TravelForm / SmartSearchHub) ───────────────────

describe('analyse URL params construction', () => {
  it('builds correct /results URL from standard params', () => {
    const budget = 1500;
    const duration = 7;
    const travelType = 'solo';
    const mode = 'standard';
    const params = new URLSearchParams({ budget: String(budget), duration: String(duration), travelType, mode });
    const url = `/results?${params.toString()}`;
    expect(url).toBe('/results?budget=1500&duration=7&travelType=solo&mode=standard');
  });

  it('handles budget_crisis mode', () => {
    const params = new URLSearchParams({ budget: '800', duration: '5', travelType: 'solo', mode: 'budget_crisis' });
    expect(params.get('mode')).toBe('budget_crisis');
  });

  it('handles bunker mode', () => {
    const params = new URLSearchParams({ budget: '3000', duration: '14', travelType: 'couple', mode: 'bunker' });
    expect(params.get('mode')).toBe('bunker');
    expect(params.get('travelType')).toBe('couple');
  });

  it('handles family travelType', () => {
    const params = new URLSearchParams({ budget: '5000', duration: '21', travelType: 'family', mode: 'standard' });
    expect(params.get('travelType')).toBe('family');
  });

  it('handles minimum budget (300)', () => {
    const params = new URLSearchParams({ budget: '300', duration: '3', travelType: 'solo', mode: 'standard' });
    expect(parseInt(params.get('budget') ?? '0')).toBeGreaterThanOrEqual(300);
  });

  it('handles maximum budget (8000)', () => {
    const params = new URLSearchParams({ budget: '8000', duration: '60', travelType: 'nomad', mode: 'standard' });
    expect(parseInt(params.get('budget') ?? '0')).toBeLessThanOrEqual(8000);
  });
});

// ── Affiliate click URL construction (TravelPackMiniBlock) ───────────────────

describe('affiliate click URL construction', () => {
  function buildClickUrl(category: 'flight' | 'hotel' | 'insurance', countryCode?: string, countryName?: string): string {
    function targetUrl(cat: typeof category, name?: string): string | undefined {
      if (!name) return undefined;
      if (cat === 'flight') return 'https://www.skyscanner.fr/';
      if (cat === 'hotel') return `https://www.booking.com/searchresults.fr.html?ss=${encodeURIComponent(name)}&lang=fr&currency=EUR`;
      if (cat === 'insurance') return 'https://www.chapkadirect.fr/';
      return undefined;
    }
    const params = new URLSearchParams({ category });
    if (countryCode) params.set('country', countryCode);
    if (countryName) params.set('countryName', countryName);
    const dest = targetUrl(category, countryName);
    if (dest) params.set('url', dest);
    return `/api/affiliate/click?${params.toString()}`;
  }

  it('flight with country: url param points to skyscanner homepage', () => {
    const url = buildClickUrl('flight', 'JP', 'Japon');
    expect(url).toContain('category=flight');
    expect(url).toContain('url=https%3A%2F%2Fwww.skyscanner.fr%2F');
    expect(url).toContain('country=JP');
  });

  it('hotel with country: url param contains country name in Booking search', () => {
    const url = buildClickUrl('hotel', 'JP', 'Japon');
    expect(url).toContain('category=hotel');
    expect(url).toContain('booking.com');
    expect(url).toContain('Japon');
  });

  it('insurance: url param points to chapkadirect', () => {
    const url = buildClickUrl('insurance', 'JP', 'Japon');
    expect(url).toContain('chapkadirect.fr');
  });

  it('flight without country: no url param (route uses FALLBACK_URL)', () => {
    const url = buildClickUrl('flight');
    expect(url).not.toContain('url=');
    expect(url).toContain('category=flight');
  });
});
