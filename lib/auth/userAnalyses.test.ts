import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock @supabase/supabase-js
// insertImpl reçoit le payload pour les tests de normalisation
let insertImpl: (data: unknown) => Promise<{ error: unknown }>;
let lastInsertPayload: unknown;

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: () => ({
      insert: (data: unknown) => {
        lastInsertPayload = data;
        return insertImpl(data);
      },
    }),
  }),
}));

beforeEach(() => {
  vi.resetModules();
  lastInsertPayload = undefined;
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://fake.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'fake-service-key';
});

async function load() {
  return import('./userAnalyses');
}

describe('persistUserAnalysisBestEffort', () => {
  it('retourne sans throw quand Supabase est indisponible', async () => {
    insertImpl = () => Promise.reject(new Error('Supabase down'));
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { persistUserAnalysisBestEffort } = await load();

    await expect(
      persistUserAnalysisBestEffort('user-123', {
        countryCode: 'PT',
        countryName: 'Portugal',
        crisisScore: 82,
        travelType: 'solo',
        duration: 7,
        budget: 1500,
        mode: 'standard',
      })
    ).resolves.toBeUndefined();

    expect(warnSpy).toHaveBeenCalledWith(
      '[userAnalyses] persist failed',
      expect.any(Error)
    );
    warnSpy.mockRestore();
  });

  it('retourne sans throw quand Supabase retourne une erreur', async () => {
    insertImpl = () => Promise.resolve({ error: { message: 'RLS violation' } });
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { persistUserAnalysisBestEffort } = await load();

    await expect(
      persistUserAnalysisBestEffort('user-123', {
        countryCode: 'PT',
        countryName: 'Portugal',
        crisisScore: 82,
      })
    ).resolves.toBeUndefined();

    expect(warnSpy).toHaveBeenCalledWith(
      '[userAnalyses] persist error',
      { message: 'RLS violation' }
    );
    warnSpy.mockRestore();
  });

  it('ne fait rien si les env vars Supabase sont absentes', async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    const mockInsert = vi.fn().mockRejectedValue(new Error('should not call'));
    insertImpl = mockInsert;
    const { persistUserAnalysisBestEffort } = await load();

    await expect(
      persistUserAnalysisBestEffort('user-123', { countryCode: 'PT', countryName: 'Portugal', crisisScore: 82 })
    ).resolves.toBeUndefined();

    expect(mockInsert).not.toHaveBeenCalled();
  });

  it('ne fait rien si userId est null', async () => {
    const mockInsert = vi.fn().mockRejectedValue(new Error('should not call'));
    insertImpl = mockInsert;
    const { persistUserAnalysisBestEffort } = await load();

    await expect(
      persistUserAnalysisBestEffort(null, { countryCode: 'PT', countryName: 'Portugal', crisisScore: 82 })
    ).resolves.toBeUndefined();

    expect(mockInsert).not.toHaveBeenCalled();
  });

  // ── Normalisation status (GATE-3D — valeurs stale cache Redis) ───────────────

  it("normalise status 'recommend' (stale cache) → 'recommended' avant insert", async () => {
    insertImpl = () => Promise.resolve({ error: null });
    const { persistUserAnalysisBestEffort } = await load();

    await persistUserAnalysisBestEffort('user-123', {
      countryCode: 'JP',
      countryName: 'Japon',
      crisisScore: 75,
      status: 'recommend',
      confidence: 'low',
    });

    expect(lastInsertPayload).toMatchObject({ status: 'recommended' });
  });

  it("conserve status 'ideal' / 'possible' / 'discouraged' intacts", async () => {
    insertImpl = () => Promise.resolve({ error: null });
    const { persistUserAnalysisBestEffort } = await load();

    for (const s of ['ideal', 'possible', 'discouraged'] as const) {
      lastInsertPayload = undefined;
      await persistUserAnalysisBestEffort('user-123', {
        countryCode: 'PT', countryName: 'Portugal', crisisScore: 82, status: s,
      });
      expect(lastInsertPayload).toMatchObject({ status: s });
    }
  });

  it("met status à null si valeur inconnue (valeur stale non récupérable)", async () => {
    insertImpl = () => Promise.resolve({ error: null });
    const { persistUserAnalysisBestEffort } = await load();

    await persistUserAnalysisBestEffort('user-123', {
      countryCode: 'PT', countryName: 'Portugal', crisisScore: 82,
      status: 'unknown_value',
    });

    expect(lastInsertPayload).toMatchObject({ status: null });
  });

  it("normalise confidence : valeurs valides conservées, inconnues → null", async () => {
    insertImpl = () => Promise.resolve({ error: null });
    const { persistUserAnalysisBestEffort } = await load();

    await persistUserAnalysisBestEffort('user-123', {
      countryCode: 'PT', countryName: 'Portugal', crisisScore: 82,
      confidence: 'medium',
    });
    expect(lastInsertPayload).toMatchObject({ confidence: 'medium' });

    lastInsertPayload = undefined;
    await persistUserAnalysisBestEffort('user-123', {
      countryCode: 'PT', countryName: 'Portugal', crisisScore: 82,
      confidence: 'stale_value',
    });
    expect(lastInsertPayload).toMatchObject({ confidence: null });
  });

  it('retourne toujours 200 même si timeout (8s simulé)', async () => {
    // Simuler un insert qui ne résout jamais (timeout déclenché)
    insertImpl = () => new Promise(() => { /* jamais résolu */ });
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { persistUserAnalysisBestEffort } = await load();

    // Le vi.useFakeTimers accélère le setTimeout interne du helper
    vi.useFakeTimers();
    const promise = persistUserAnalysisBestEffort('user-123', {
      countryCode: 'JP', countryName: 'Japon', crisisScore: 75,
    });
    vi.advanceTimersByTime(8001);
    await promise;

    expect(warnSpy).toHaveBeenCalledWith(
      '[userAnalyses] persist error',
      expect.objectContaining({ message: 'timeout' })
    );
    warnSpy.mockRestore();
    vi.useRealTimers();
  });
});
