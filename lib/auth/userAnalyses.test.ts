import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock @supabase/supabase-js
let insertImpl: () => Promise<{ error: unknown }>;

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: () => ({
      insert: () => insertImpl(),
    }),
  }),
}));

beforeEach(() => {
  vi.resetModules();
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
});
