import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { safeNext, DEFAULT_NEXT } from '@/lib/auth/safe-next';

// PREMIUM-FLOW-001A — sanitisation du paramètre `next` post-connexion.
// safeNext() est une fonction pure : on la teste directement (env node).

describe('safeNext — chemins internes acceptés', () => {
  it('accepte une route destination', () => {
    expect(safeNext('/destination/FR')).toBe('/destination/FR');
  });

  it('conserve les query params de /results', () => {
    const next = '/results?budget=medium&duration=7&travelType=family';
    expect(safeNext(next)).toBe(next);
  });

  it('accepte /pricing', () => {
    expect(safeNext('/pricing')).toBe('/pricing');
  });

  it('accepte la racine "/"', () => {
    expect(safeNext('/')).toBe('/');
  });

  it('accepte un chemin avec ancre', () => {
    expect(safeNext('/destination/JP#meteo')).toBe('/destination/JP#meteo');
  });

  it('trim les espaces autour d\'un chemin valide', () => {
    expect(safeNext('  /pricing  ')).toBe('/pricing');
  });
});

describe('safeNext — cibles externes / malveillantes rejetées → "/"', () => {
  it('rejette une URL absolue https', () => {
    expect(safeNext('https://evil.com')).toBe(DEFAULT_NEXT);
  });

  it('rejette une URL absolue http', () => {
    expect(safeNext('http://evil.com/path')).toBe(DEFAULT_NEXT);
  });

  it('rejette le protocol-relative //evil.com', () => {
    expect(safeNext('//evil.com')).toBe(DEFAULT_NEXT);
  });

  it('rejette le backslash-smuggling /\\evil.com', () => {
    expect(safeNext('/\\evil.com')).toBe(DEFAULT_NEXT);
  });

  it('rejette javascript:', () => {
    expect(safeNext('javascript:alert(1)')).toBe(DEFAULT_NEXT);
  });

  it('rejette data:', () => {
    expect(safeNext('data:text/html,<script>1</script>')).toBe(DEFAULT_NEXT);
  });

  it('rejette une valeur vide', () => {
    expect(safeNext('')).toBe(DEFAULT_NEXT);
  });

  it('rejette une chaîne d\'espaces', () => {
    expect(safeNext('   ')).toBe(DEFAULT_NEXT);
  });

  it('rejette un chemin relatif sans slash initial', () => {
    expect(safeNext('results?x=1')).toBe(DEFAULT_NEXT);
  });

  it('rejette les non-strings', () => {
    expect(safeNext(null)).toBe(DEFAULT_NEXT);
    expect(safeNext(undefined)).toBe(DEFAULT_NEXT);
    expect(safeNext(42 as unknown)).toBe(DEFAULT_NEXT);
    expect(safeNext({} as unknown)).toBe(DEFAULT_NEXT);
  });

  it('rejette les caractères de contrôle / retours à la ligne', () => {
    expect(safeNext('/path\nSet-Cookie: x')).toBe(DEFAULT_NEXT);
    expect(safeNext('/path\twith-tab')).toBe(DEFAULT_NEXT);
  });

  it('le fallback exporté est bien "/"', () => {
    expect(DEFAULT_NEXT).toBe('/');
  });
});

// ── Câblage : /auth/callback doit utiliser safeNext, jamais le brut ──────────

describe('auth/callback — utilise safeNext sur le paramètre next', () => {
  const ROUTE_PATH = 'app/auth/callback/route.ts';
  const src = readFileSync(resolve(process.cwd(), ROUTE_PATH), 'utf-8');

  it('importe safeNext', () => {
    expect(src).toContain("from '@/lib/auth/safe-next'");
    expect(src).toContain('safeNext');
  });

  it('applique safeNext au param next (pas de next brut redirigé)', () => {
    expect(src).toContain("safeNext(searchParams.get('next'))");
  });

  it('redirige vers origin + next validé', () => {
    expect(src).toContain('`${origin}${next}`');
  });
});
