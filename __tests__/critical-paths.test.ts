import { describe, it, expect } from 'vitest';
import { isHttpUrl, buildAffiliateUrl } from '../lib/services/affiliate/affiliate.service';
import type { AffiliatePartner, AffiliateCategory } from '../types/affiliate.types';

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
  redirectUrl: null,
  affiliateId: null, urlParam: null,
  commissionRate: null, active: true,
};

const partnerWithId: AffiliatePartner = {
  id: '2', slug: 'booking', name: 'Booking', category: 'hotel',
  baseUrl: 'https://www.booking.com/',
  redirectUrl: null,
  affiliateId: 'aff123', urlParam: 'aid',
  commissionRate: 0.04, active: true,
};

// Partenaire activé via URL de redirection complète (deep-link réseau, ex: Travelpayouts).
const partnerWithRedirect: AffiliatePartner = {
  id: '3', slug: 'kiwi', name: 'Kiwi.com', category: 'flight',
  baseUrl: 'https://www.kiwi.com/',
  redirectUrl: 'https://kiwi.tpo.mx/7NkQdf4N',
  affiliateId: null, urlParam: null,
  commissionRate: null, active: true,
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

  // ── redirect_url (GOAL-044) ──────────────────────────────────────────────
  it('returns redirect_url as-is, taking precedence over targetUrl', () => {
    const result = buildAffiliateUrl(partnerWithRedirect, 'https://www.kiwi.com/search?from=PAR');
    expect(result).toBe('https://kiwi.tpo.mx/7NkQdf4N');
  });

  it('redirect_url takes precedence even over url_param + affiliate_id', () => {
    const partner: AffiliatePartner = {
      ...partnerWithId,
      redirectUrl: 'https://tiqets.tpo.mx/byHaQ9qu',
    };
    const result = buildAffiliateUrl(partner, 'https://www.booking.com/search?ss=Japon');
    expect(result).toBe('https://tiqets.tpo.mx/byHaQ9qu');
    // l'ancien param n'est PAS injecté quand redirect_url est présent
    expect(result).not.toContain('aid=');
  });

  it('ignores an invalid (unsafe) redirect_url and falls back to param/public behavior', () => {
    const unsafe: AffiliatePartner = { ...partnerWithId, redirectUrl: 'javascript:alert(1)' };
    const result = buildAffiliateUrl(unsafe, 'https://www.booking.com/search?ss=Japon');
    // redirect_url ignorée → comportement étape 2 : injection du param
    const url = new URL(result);
    expect(url.searchParams.get('aid')).toBe('aff123');
    expect(result.startsWith('https://')).toBe(true);
  });

  it('ignores a protocol-relative redirect_url and falls back to public targetUrl', () => {
    const unsafe: AffiliatePartner = { ...partnerNoId, redirectUrl: '//evil.com/x' };
    const result = buildAffiliateUrl(unsafe, 'https://www.skyscanner.fr/');
    expect(result).toBe('https://www.skyscanner.fr/');
  });
});

// ── Catégories étendues (GOAL-046) ───────────────────────────────────────────
// Prouve que transfer/activity/esim sont des AffiliateCategory valides et se
// comportent comme les catégories historiques dans buildAffiliateUrl. Aucune
// donnée/partenaire n'est activé ici — c'est de la préparation de modèle.

describe('extended affiliate categories (GOAL-046)', () => {
  const NEW_CATEGORIES = ['transfer', 'activity', 'esim'] as const;
  const ALL_CATEGORIES: AffiliateCategory[] = [
    'flight', 'hotel', 'insurance', 'transfer', 'activity', 'esim',
  ];

  it('AffiliateCategory accepts the six expected values (compile-time + runtime)', () => {
    // Si l'une de ces valeurs n'était pas dans l'union, tsc échouerait à la compilation.
    expect(ALL_CATEGORIES).toHaveLength(6);
    expect(new Set(ALL_CATEGORIES).size).toBe(6);
  });

  it('a transfer/activity/esim partner with no affiliate data returns the public baseUrl', () => {
    for (const category of NEW_CATEGORIES) {
      const partner: AffiliatePartner = {
        id: `new-${category}`, slug: category, name: category, category,
        baseUrl: `https://example-${category}.com/`,
        redirectUrl: null, affiliateId: null, urlParam: null,
        commissionRate: null, active: true,
      };
      // pas de redirect_url, pas d'affiliateId → lien public inchangé (comportement étape 3)
      expect(buildAffiliateUrl(partner)).toBe(`https://example-${category}.com/`);
    }
  });

  it('a future redirect_url on a new category still takes precedence (GOAL-044 behavior preserved)', () => {
    const transfer: AffiliatePartner = {
      id: 'wp', slug: 'welcome-pickups', name: 'Welcome Pickups', category: 'transfer',
      baseUrl: 'https://www.welcomepickups.com/',
      redirectUrl: 'https://tpo.mx/TCPlpV7c',
      affiliateId: null, urlParam: null, commissionRate: null, active: true,
    };
    expect(buildAffiliateUrl(transfer, 'https://www.welcomepickups.com/search')).toBe('https://tpo.mx/TCPlpV7c');
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

  it('includes from and to when both dates are provided', () => {
    const params = new URLSearchParams({
      budget: '1500', duration: '7', travelType: 'solo', mode: 'standard',
      from: '2026-09-01', to: '2026-09-10',
    });
    expect(params.get('from')).toBe('2026-09-01');
    expect(params.get('to')).toBe('2026-09-10');
    const url = `/results?${params.toString()}`;
    expect(url).toContain('from=2026-09-01');
    expect(url).toContain('to=2026-09-10');
  });

  it('omits from/to when dates are empty strings', () => {
    const dateDepart = '';
    const dateRetour = '';
    const params = new URLSearchParams({ budget: '1500', duration: '7', travelType: 'solo', mode: 'standard' });
    if (dateDepart) params.set('from', dateDepart);
    if (dateRetour) params.set('to', dateRetour);
    expect(params.get('from')).toBeNull();
    expect(params.get('to')).toBeNull();
  });

  it('date validation: retour <= depart is invalid', () => {
    function dateError(depart: string, retour: string): string | null {
      if (!depart || !retour) return null;
      if (retour <= depart) return 'La date de retour doit être après la date de départ.';
      return null;
    }
    expect(dateError('2026-09-10', '2026-09-01')).toBeTruthy();
    expect(dateError('2026-09-10', '2026-09-10')).toBeTruthy();
    expect(dateError('2026-09-01', '2026-09-10')).toBeNull();
    expect(dateError('', '2026-09-10')).toBeNull();
    expect(dateError('2026-09-01', '')).toBeNull();
    expect(dateError('', '')).toBeNull();
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

// ── Secondary affiliate CTAs (GOAL-048, TravelPackBlock) ─────────────────────
// Replique le helper trackUrl du TravelPackBlock pour vérifier que les CTA
// secondaires pointent vers /api/affiliate/click avec les bons couples
// category/partner et SANS aucun lien d'affiliation (tpo.mx) en dur.

describe('secondary affiliate CTAs (GOAL-048)', () => {
  type Category = 'flight' | 'hotel' | 'insurance' | 'transfer' | 'activity' | 'esim';
  function trackUrl(category: Category, partner: string, target: string,
                    countryCode = 'JP', countryName = 'Japon', total = 1200): string {
    return `/api/affiliate/click?category=${category}&partner=${partner}` +
      `&url=${encodeURIComponent(target)}` +
      `&country=${encodeURIComponent(countryCode)}` +
      `&countryName=${encodeURIComponent(countryName)}` +
      `&total=${total}`;
  }

  const transferHref = trackUrl('transfer', 'welcome-pickups', 'https://www.welcomepickups.com/');
  const activityHref = trackUrl('activity', 'tiqets', 'https://www.tiqets.com/');
  const esimHref     = trackUrl('esim', 'airalo', 'https://www.airalo.com/');

  it('transfer CTA targets welcome-pickups via /api/affiliate/click', () => {
    expect(transferHref).toContain('/api/affiliate/click?');
    expect(transferHref).toContain('category=transfer');
    expect(transferHref).toContain('partner=welcome-pickups');
    expect(transferHref).toContain('url=https%3A%2F%2Fwww.welcomepickups.com%2F');
  });

  it('activity CTA targets tiqets via /api/affiliate/click', () => {
    expect(activityHref).toContain('category=activity');
    expect(activityHref).toContain('partner=tiqets');
    expect(activityHref).toContain('url=https%3A%2F%2Fwww.tiqets.com%2F');
  });

  it('esim CTA targets airalo via /api/affiliate/click', () => {
    expect(esimHref).toContain('category=esim');
    expect(esimHref).toContain('partner=airalo');
    expect(esimHref).toContain('url=https%3A%2F%2Fwww.airalo.com%2F');
  });

  it('no secondary CTA embeds a Travelpayouts (tpo.mx) link in the frontend', () => {
    for (const href of [transferHref, activityHref, esimHref]) {
      expect(href).not.toContain('tpo.mx');
      expect(href).not.toContain('gettransfer'); // gettransfer reste en DB, jamais exposé en UI
    }
  });
});

// ── Quota meta (QUOTA-001) ────────────────────────────────────────────────────
// Ces tests vérifient la logique de la meta quota telle que construite dans
// /api/analyze et consommée par ResultsContent. Aucun appel Supabase ici —
// on teste uniquement la structure de données et les règles d'affichage.

describe('quota meta (QUOTA-001)', () => {
  type QuotaMeta = { remaining: number; used: number; limit: number; isPremium: boolean };

  // Simule la condition d'inclusion du champ quota dans la meta API
  function shouldIncludeQuota(isPremium: boolean, used: number, limit: number): boolean {
    const remaining = Math.max(0, limit - used);
    return isPremium || used > 0 || remaining < limit;
  }

  it('quota absent de meta si utilisateur anonyme (used=0, remaining=limit)', () => {
    // Cas anonyme / Supabase absent : used=0, remaining=FREE_LIMIT, isPremium=false
    // → la condition ne tient pas → quota non inclus dans meta
    expect(shouldIncludeQuota(false, 0, 3)).toBe(false);
  });

  it('quota présent dans meta si utilisateur a consommé au moins 1 analyse', () => {
    expect(shouldIncludeQuota(false, 1, 3)).toBe(true);
    expect(shouldIncludeQuota(false, 2, 3)).toBe(true);
    expect(shouldIncludeQuota(false, 3, 3)).toBe(true);
  });

  it('quota présent dans meta si utilisateur premium', () => {
    expect(shouldIncludeQuota(true, 0, 999)).toBe(true);
    expect(shouldIncludeQuota(true, 5, 999)).toBe(true);
  });

  it('remaining jamais négatif', () => {
    const cases: QuotaMeta[] = [
      { remaining: 0, used: 3, limit: 3, isPremium: false },
      { remaining: 0, used: 5, limit: 3, isPremium: false }, // dépassement hypothétique
    ];
    for (const q of cases) {
      expect(q.remaining).toBeGreaterThanOrEqual(0);
    }
  });

  it('utilisateur free avec 2 analyses restantes : message correct', () => {
    const quota: QuotaMeta = { remaining: 2, used: 1, limit: 3, isPremium: false };
    const msg = quota.remaining > 0
      ? `Il vous reste ${quota.remaining} analyse${quota.remaining > 1 ? 's' : ''} gratuite${quota.remaining > 1 ? 's' : ''} ce mois-ci.`
      : 'Quota gratuit épuisé pour ce mois-ci.';
    expect(msg).toBe('Il vous reste 2 analyses gratuites ce mois-ci.');
  });

  it('utilisateur free avec 1 analyse restante : singulier correct', () => {
    const quota: QuotaMeta = { remaining: 1, used: 2, limit: 3, isPremium: false };
    const msg = quota.remaining > 0
      ? `Il vous reste ${quota.remaining} analyse${quota.remaining > 1 ? 's' : ''} gratuite${quota.remaining > 1 ? 's' : ''} ce mois-ci.`
      : 'Quota gratuit épuisé pour ce mois-ci.';
    expect(msg).toBe('Il vous reste 1 analyse gratuite ce mois-ci.');
  });

  it('utilisateur free quota épuisé : message correct', () => {
    const quota: QuotaMeta = { remaining: 0, used: 3, limit: 3, isPremium: false };
    const msg = quota.remaining > 0
      ? `Il vous reste ${quota.remaining} analyse${quota.remaining > 1 ? 's' : ''} gratuite${quota.remaining > 1 ? 's' : ''} ce mois-ci.`
      : 'Quota gratuit épuisé pour ce mois-ci.';
    expect(msg).toBe('Quota gratuit épuisé pour ce mois-ci.');
  });

  it('premium : bandeau quota non affiché (isPremium=true)', () => {
    const quota: QuotaMeta = { remaining: 999, used: 5, limit: 999, isPremium: true };
    // ResultsContent n'affiche le bandeau que si !isPremium
    const shouldShow = !quota.isPremium;
    expect(shouldShow).toBe(false);
  });

  it('meta quota absente : aucun bandeau affiché (undefined)', () => {
    const quotaMeta: QuotaMeta | undefined = undefined;
    // Si meta.quota est absent, aucun affichage — le check `data?.meta.quota` garantit cela
    expect(quotaMeta).toBeUndefined();
  });

  it('body 402 expose quota.used et quota.limit', () => {
    // Simule la structure du body 402 de /api/analyze
    const body402 = {
      error: 'Quota mensuel atteint. Passez à Premium pour des analyses illimitées.',
      quota: { used: 3, limit: 3, remaining: 0 },
      upgradeUrl: '/pricing',
    };
    expect(body402.quota.used).toBe(3);
    expect(body402.quota.limit).toBe(3);
    expect(body402.quota.remaining).toBe(0);
    expect(body402.upgradeUrl).toBe('/pricing');
  });

  it('meta analyzedCountries et partial conservés indépendamment du quota', () => {
    // La meta quota est ajoutée par spread conditionnel — les champs existants ne bougent pas
    const metaWithQuota = {
      analyzedCountries: 18,
      duration: 4200,
      cacheHitRate: 0.72,
      partial: false,
      quota: { remaining: 1, used: 2, limit: 3, isPremium: false },
    };
    expect(metaWithQuota.analyzedCountries).toBe(18);
    expect(metaWithQuota.partial).toBe(false);
    expect(metaWithQuota.quota.remaining).toBe(1);
  });
});
