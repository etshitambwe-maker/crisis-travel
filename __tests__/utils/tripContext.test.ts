import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  saveTripContext,
  loadTripContext,
  mergeTripContext,
  clearTripContext,
  tripContextFromParams,
  type TripContext,
} from '@/lib/utils/tripContext';

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeCtx(over: Partial<TripContext> = {}): TripContext {
  return {
    budget: 2000,
    duration: 14,
    travelType: 'family',
    mode: 'standard',
    createdAt: '2026-06-15T10:00:00.000Z',
    source: 'form',
    ...over,
  };
}

// ── sessionStorage mock ────────────────────────────────────────────────────────

const store: Record<string, string> = {};
const sessionStorageMock = {
  getItem: (k: string) => store[k] ?? null,
  setItem: (k: string, v: string) => { store[k] = v; },
  removeItem: (k: string) => { delete store[k]; },
};

beforeEach(() => {
  Object.keys(store).forEach((k) => delete store[k]);
  Object.defineProperty(global, 'window', { value: { sessionStorage: sessionStorageMock }, writable: true });
  Object.defineProperty(global, 'sessionStorage', { value: sessionStorageMock, writable: true });
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ── 1. save / load ─────────────────────────────────────────────────────────────

describe('saveTripContext / loadTripContext', () => {
  it('sauvegarde et relit un contexte valide', () => {
    saveTripContext(makeCtx());
    const loaded = loadTripContext();
    expect(loaded).not.toBeNull();
    expect(loaded?.budget).toBe(2000);
    expect(loaded?.duration).toBe(14);
    expect(loaded?.travelType).toBe('family');
    expect(loaded?.mode).toBe('standard');
  });

  it('normalise travelers depuis travelType si absent', () => {
    saveTripContext(makeCtx({ travelType: 'family' }));
    expect(loadTripContext()?.travelers).toBe(2);
  });

  it('normalise travelers à 1 pour solo', () => {
    saveTripContext(makeCtx({ travelType: 'solo' }));
    expect(loadTripContext()?.travelers).toBe(1);
  });

  it('normalise travelers à 1 pour nomad', () => {
    saveTripContext(makeCtx({ travelType: 'nomad' }));
    expect(loadTripContext()?.travelers).toBe(1);
  });

  it('normalise travelers à 2 pour couple', () => {
    saveTripContext(makeCtx({ travelType: 'couple' }));
    expect(loadTripContext()?.travelers).toBe(2);
  });

  it('normalise departureCountry à FR si absent', () => {
    saveTripContext(makeCtx({ departureCountry: undefined }));
    expect(loadTripContext()?.departureCountry).toBe('FR');
  });

  it('preserve travelers explicite passé', () => {
    saveTripContext(makeCtx({ travelType: 'family', travelers: 4 }));
    expect(loadTripContext()?.travelers).toBe(4);
  });

  it('retourne null si sessionStorage vide', () => {
    expect(loadTripContext()).toBeNull();
  });

  it('retourne null si JSON invalide', () => {
    store['tripContext'] = '{invalid json}}}';
    expect(loadTripContext()).toBeNull();
  });

  it('retourne null si champs obligatoires manquants', () => {
    store['tripContext'] = JSON.stringify({ budget: 2000 }); // incomplet
    expect(loadTripContext()).toBeNull();
  });

  it('retourne null si travelType invalide', () => {
    store['tripContext'] = JSON.stringify(makeCtx({ travelType: 'backpacker' as never }));
    expect(loadTripContext()).toBeNull();
  });

  it('retourne null si mode invalide', () => {
    store['tripContext'] = JSON.stringify(makeCtx({ mode: 'ultra' as never }));
    expect(loadTripContext()).toBeNull();
  });
});

// ── 2. window absent ──────────────────────────────────────────────────────────

describe('saveTripContext / loadTripContext — window absent (SSR)', () => {
  it('saveTripContext est no-op si window absent', () => {
    Object.defineProperty(global, 'window', { value: undefined, writable: true });
    expect(() => saveTripContext(makeCtx())).not.toThrow();
  });

  it('loadTripContext retourne null si window absent', () => {
    Object.defineProperty(global, 'window', { value: undefined, writable: true });
    expect(loadTripContext()).toBeNull();
  });

  it('clearTripContext est no-op si window absent', () => {
    Object.defineProperty(global, 'window', { value: undefined, writable: true });
    expect(() => clearTripContext()).not.toThrow();
  });
});

// ── 3. mergeTripContext ────────────────────────────────────────────────────────

describe('mergeTripContext', () => {
  it('met à jour countryCode et countryName', () => {
    saveTripContext(makeCtx());
    mergeTripContext({ countryCode: 'PT', countryName: 'Portugal' });
    const loaded = loadTripContext();
    expect(loaded?.countryCode).toBe('PT');
    expect(loaded?.countryName).toBe('Portugal');
    expect(loaded?.budget).toBe(2000); // non touché
  });

  it('ne plante pas si aucun contexte existant', () => {
    expect(() => mergeTripContext({ countryCode: 'FR' })).not.toThrow();
  });
});

// ── 4. clearTripContext ────────────────────────────────────────────────────────

describe('clearTripContext', () => {
  it('supprime le contexte', () => {
    saveTripContext(makeCtx());
    clearTripContext();
    expect(loadTripContext()).toBeNull();
  });
});

// ── 5. tripContextFromParams ───────────────────────────────────────────────────

describe('tripContextFromParams', () => {
  it('construit un contexte depuis des params URL complets', () => {
    const p = new URLSearchParams('budget=4000&duration=14&travelType=family&mode=standard');
    const ctx = tripContextFromParams(p);
    expect(ctx).not.toBeNull();
    expect(ctx?.budget).toBe(4000);
    expect(ctx?.duration).toBe(14);
    expect(ctx?.travelType).toBe('family');
    expect(ctx?.mode).toBe('standard');
    expect(ctx?.travelers).toBe(2); // family → 2
    expect(ctx?.source).toBe('url');
  });

  it('transmet from/to si présents', () => {
    const p = new URLSearchParams('budget=1500&duration=7&travelType=solo&mode=standard&from=2026-08-01&to=2026-08-08');
    const ctx = tripContextFromParams(p);
    expect(ctx?.from).toBe('2026-08-01');
    expect(ctx?.to).toBe('2026-08-08');
  });

  it('retourne null si budget manquant', () => {
    const p = new URLSearchParams('duration=7&travelType=solo&mode=standard');
    expect(tripContextFromParams(p)).toBeNull();
  });

  it('retourne null si travelType invalide', () => {
    const p = new URLSearchParams('budget=1500&duration=7&travelType=invalid&mode=standard');
    expect(tripContextFromParams(p)).toBeNull();
  });

  it('retourne null si mode invalide', () => {
    const p = new URLSearchParams('budget=1500&duration=7&travelType=solo&mode=ultramode');
    expect(tripContextFromParams(p)).toBeNull();
  });
});
