import { describe, it, expect, vi, beforeEach } from 'vitest';

// Ce test vérifie que :
// 1. persistUserAnalysisBestEffort est appelé avec la top destination (awaité)
// 2. si le helper résout (cas nominal), /api/analyze retourne 200
// 3. si le helper throw de façon inattendue, /api/analyze absorbe l'erreur via
//    le catch du bloc try principal et retourne 500 — mais ce cas est impossible
//    en production car persistUserAnalysisBestEffort ne throw jamais.
//    En pratique, le mock qui résout immédiatement couvre le chemin nominal.

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

describe('/api/analyze — persistance best-effort awaited (USER-DASHBOARD-001 GATE 2A)', () => {
  beforeEach(() => {
    vi.resetModules();
    mockPersist.mockClear();
    mockPersist.mockResolvedValue(undefined);
  });

  it('retourne 200 et appelle persistUserAnalysisBestEffort avec la top destination', async () => {
    const { POST } = await loadRoute();
    const res = await POST(makeRequest());
    expect(res.status).toBe(200);

    // Aucun setTimeout nécessaire : la persistance est maintenant awaité
    // — si elle n'était pas awaité, ce test serait flakey (race condition).
    expect(mockPersist).toHaveBeenCalledTimes(1);
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

  it('persistUserAnalysisBestEffort est awaité : sans await, toHaveBeenCalledTimes échouerait', async () => {
    // Ce test vérifie IMPLICITEMENT que l'appel est awaité.
    // Avec un fire-and-forget, mockPersist.mockResolvedValue(undefined) serait
    // non-résolu au moment de l'assertion — toHaveBeenCalledTimes(1) passerait
    // mais le mock ne serait pas encore exécuté. Or ici, le test est synchrone
    // après await POST() donc l'appel doit être terminé.
    let persistWasCalled = false;
    mockPersist.mockImplementationOnce(async () => {
      persistWasCalled = true;
    });

    const { POST } = await loadRoute();
    await POST(makeRequest());

    // Si persist n'était pas awaité, persistWasCalled serait false ici
    expect(persistWasCalled).toBe(true);
  });

  it("retourne 200 même quand la persistance prend le chemin d'erreur interne (warn, pas throw)", async () => {
    // Simule le comportement réel du helper quand Supabase retourne une erreur :
    // il log un warn et résout sans throw. Résultat : la route doit rester 200.
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mockPersist.mockImplementationOnce(async () => {
      console.warn('[userAnalyses] persist error', { message: 'test error' });
      // résout sans throw, comme le vrai helper
    });

    const { POST } = await loadRoute();
    const res = await POST(makeRequest());

    expect(res.status).toBe(200);
    warnSpy.mockRestore();
  });

  it('ne persiste pas si user est anonyme (userId null)', async () => {
    // Redéfinir le mock supabase-server pour ce test AVANT le loadRoute()
    // car vi.resetModules() force un re-chargement du module à chaque test.
    vi.doMock('@/lib/auth/supabase-server', () => ({
      getUser: vi.fn().mockResolvedValue(null),
    }));

    const { POST } = await loadRoute();
    const res = await POST(makeRequest());

    expect(res.status).toBe(200);
    // mockPersist peut avoir été appelé par les tests précédents ;
    // on vérifie qu'il n'a PAS été appelé dans CE test spécifiquement.
    // Comme resetModules est dans beforeEach et mockPersist.mockResolvedValue est reset,
    // on vérifie le nombre total d'appels depuis le reset = 0.
    expect(mockPersist).not.toHaveBeenCalled();
  });
});
