import { describe, it, expect, vi, beforeEach } from 'vitest';

let mockUser: { id: string } | null = null;
let mockIsPremium = false;
let mockData: unknown[] = [];
let mockError: unknown = null;

vi.mock('@/lib/auth/supabase-server', () => ({
  getUserWithSubscription: vi.fn().mockImplementation(async () => ({
    user: mockUser,
    isPremium: mockIsPremium,
  })),
}));

// Mock Supabase client — chaîne fluente complète
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          gt: () => ({
            order: () => ({
              limit: () => Promise.resolve({ data: mockData, error: mockError }),
            }),
          }),
        }),
      }),
    }),
  }),
}));

beforeEach(() => {
  vi.resetModules();
  mockUser = null;
  mockIsPremium = false;
  mockData = [];
  mockError = null;
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://fake.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'fake-key';
});

async function load() {
  return import('./route');
}

describe('GET /api/user-analyses', () => {
  it('retourne 401 si non connecté', async () => {
    mockUser = null;
    const { GET } = await load();
    const res = await GET(new Request('http://localhost/api/user-analyses'));
    expect(res.status).toBe(401);
  });

  it('retourne 402 si connecté mais non-premium', async () => {
    mockUser = { id: 'user-abc' };
    mockIsPremium = false;
    const { GET } = await load();
    const res = await GET(new Request('http://localhost/api/user-analyses'));
    expect(res.status).toBe(402);
    const body = await res.json();
    expect(body.premiumRequired).toBe(true);
    expect(body.upgradeUrl).toBe('/pricing');
  });

  it('retourne la liste des analyses si premium', async () => {
    mockUser = { id: 'user-abc' };
    mockIsPremium = true;
    mockData = [
      {
        id: 'ana-1',
        country_code: 'PT',
        country_name: 'Portugal',
        crisis_score: 82,
        security_score: 85,
        geopolitical_score: 78,
        budget_score: 80,
        travel_type: 'solo',
        duration: 7,
        budget: 1500,
        mode: 'standard',
        status: 'ideal',
        confidence: 'high',
        analyzed_at: '2026-06-15T10:00:00Z',
      },
    ];
    const { GET } = await load();
    const res = await GET(new Request('http://localhost/api/user-analyses'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.analyses).toHaveLength(1);
    expect(body.analyses[0].countryCode).toBe('PT');
    expect(body.analyses[0].crisisScore).toBe(82);
    expect(body.analyses[0].securityScore).toBe(85);
    expect(body.analyses[0].travelType).toBe('solo');
    // user_id ne doit jamais être exposé au client
    expect(body.analyses[0].userId).toBeUndefined();
    expect(body.analyses[0].user_id).toBeUndefined();
  });

  it('retourne analyses vide [] si pas encore d\'analyses', async () => {
    mockUser = { id: 'user-abc' };
    mockIsPremium = true;
    mockData = [];
    const { GET } = await load();
    const res = await GET(new Request('http://localhost/api/user-analyses'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.analyses).toEqual([]);
  });
});
