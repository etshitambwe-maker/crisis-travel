import { describe, it, expect, vi } from 'vitest';

// ── AI-COST-001 (P0-B) — route /explain désactivée ───────────────────────────
// Ces tests vérifient que la route legacy renvoie 410 sans appel IA.

// Mock des modules IA pour prouver qu'ils ne sont jamais appelés.
const calculateCrisisScoreSpy = vi.fn();
const generateDestinationNarrativeSpy = vi.fn();

vi.mock('@/lib/services/scoring/crisisScore.service', () => ({
  calculateCrisisScore: calculateCrisisScoreSpy,
}));
vi.mock('@/lib/claude/claude.service', () => ({
  generateDestinationNarrative: generateDestinationNarrativeSpy,
}));
vi.mock('@/lib/utils/countries', () => ({
  findCountry: vi.fn(() => ({ code: 'PT', name: 'Portugal', continent: 'Europe' })),
}));

async function load() {
  return import('./route');
}

describe('/api/destination/[code]/explain — route désactivée (AI-COST-001 P0-B)', () => {
  it('retourne HTTP 410 Gone', async () => {
    const { GET } = await load();
    const req = new Request('http://localhost/api/destination/PT/explain');
    const ctx = { params: Promise.resolve({ code: 'PT' }) };
    const res = await GET(req, ctx);
    expect(res.status).toBe(410);
  });

  it('le corps contient un champ error', async () => {
    const { GET } = await load();
    const req = new Request('http://localhost/api/destination/PT/explain');
    const ctx = { params: Promise.resolve({ code: 'PT' }) };
    const res = await GET(req, ctx);
    const body = await res.json() as { error?: string };
    expect(body.error).toBeDefined();
    expect(typeof body.error).toBe('string');
  });

  it('ne déclenche aucun appel à calculateCrisisScore', async () => {
    calculateCrisisScoreSpy.mockClear();
    const { GET } = await load();
    const req = new Request('http://localhost/api/destination/PT/explain');
    const ctx = { params: Promise.resolve({ code: 'PT' }) };
    await GET(req, ctx);
    expect(calculateCrisisScoreSpy).not.toHaveBeenCalled();
  });

  it('ne déclenche aucun appel à generateDestinationNarrative (Claude)', async () => {
    generateDestinationNarrativeSpy.mockClear();
    const { GET } = await load();
    const req = new Request('http://localhost/api/destination/PT/explain');
    const ctx = { params: Promise.resolve({ code: 'PT' }) };
    await GET(req, ctx);
    expect(generateDestinationNarrativeSpy).not.toHaveBeenCalled();
  });
});
