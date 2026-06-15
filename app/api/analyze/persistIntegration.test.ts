import { describe, it, expect, vi, beforeEach } from 'vitest';

// Ce test vérifie uniquement que persistUserAnalysisBestEffort est appelé
// correctement depuis /api/analyze, et que son échec ne fait pas échouer la route.

const mockPersist = vi.fn().mockResolvedValue(undefined);

vi.mock('@/lib/auth/userAnalyses', () => ({
  persistUserAnalysisBestEffort: mockPersist,
}));

vi.mock('@/lib/auth/supabase-server', () => ({
  getUser: vi.fn().mockResolvedValue({ id: 'user-abc', email: 'test@test.com' }),
}));

vi.mock('@/lib/auth/analysisQuota', () => ({
  checkAndIncrementQuota: vi.fn().mockResolvedValue({
    allowed: true,
    isPremium: true,
    remaining: 999,
    used: 1,
    limit: 999,
  }),
}));

vi.mock('@/lib/middleware/rateLimit', () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ success: true, limit: 10, remaining: 9, reset: 9999 }),
  getClientIdentifier: vi.fn().mockReturnValue('1.2.3.4'),
}));

vi.mock('@/lib/cache/redis', () => ({
  resetCacheStats: vi.fn(),
  getCacheStats: vi.fn().mockReturnValue({ hitRate: 0.5 }),
}));

const mockScore = {
  country: 'Portugal',
  countryCode: 'PT',
  total: 82,
  security:     { value: 85, source: 'live', confidence: 'high', details: {} },
  geopolitical: { value: 78, source: 'live', confidence: 'high', details: {} },
  budget:       { value: 80, source: 'live', confidence: 'high', details: {} },
  practicality: { value: 90, source: 'live', confidence: 'high', details: {} },
  status:       'ideal',
  confidence:   'high',
  calculatedAt: new Date().toISOString(),
};

vi.mock('@/lib/services/scoring/crisisScore.service', () => ({
  calculateCrisisScore: vi.fn().mockResolvedValue(mockScore),
}));

vi.mock('@/lib/claude/claude.service', () => ({
  detectOpportunities: vi.fn().mockResolvedValue([]),
}));

vi.mock('@/lib/utils/countries', () => ({
  TARGET_COUNTRIES: [{ code: 'PT', name: 'Portugal', continent: 'Europe', meaeSlug: 'portugal' }],
}));

vi.mock('@/lib/utils/selectCandidates', () => ({
  selectCandidates: vi.fn().mockImplementation((c: unknown[]) => c),
  CANDIDATE_CAP: 18,
}));

const baseProfile = {
  departureCountry: 'FR',
  budget: 1500,
  duration: 7,
  travelType: 'solo',
  mode: 'standard',
};

async function loadRoute() {
  return import('./route');
}

function makeRequest(profile = baseProfile) {
  return new Request('http://localhost/api/analyze', {
    method: 'POST',
    body: JSON.stringify({ profile }),
  });
}

describe('/api/analyze — persistance best-effort (USER-DASHBOARD-001)', () => {
  beforeEach(() => {
    vi.resetModules();
    mockPersist.mockResolvedValue(undefined);
  });

  it("retourne 200 et appelle persistUserAnalysisBestEffort avec la top destination", async () => {
    const { POST } = await loadRoute();
    const res = await POST(makeRequest());
    expect(res.status).toBe(200);

    // Attendre que le fire-and-forget soit réglé
    await new Promise((r) => setTimeout(r, 50));

    expect(mockPersist).toHaveBeenCalledWith(
      'user-abc',
      expect.objectContaining({
        countryCode: 'PT',
        countryName: 'Portugal',
        crisisScore: 82,
        travelType:  'solo',
        duration:    7,
        budget:      1500,
        mode:        'standard',
        status:      'ideal',
        confidence:  'high',
      })
    );
  });

  it("retourne 200 même si persistUserAnalysisBestEffort rejette inopinément", async () => {
    mockPersist.mockRejectedValueOnce(new Error('DB exploded'));
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { POST } = await loadRoute();
    const res = await POST(makeRequest());

    // La réponse analyse doit être 200 quoi qu'il arrive
    expect(res.status).toBe(200);

    await new Promise((r) => setTimeout(r, 50));
    errSpy.mockRestore();
  });
});
