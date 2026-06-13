import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

// PREMIUM-FLOW-001A — câblage du retour post-connexion + suppression des
// liens morts /login. Tests source-assertion (convention repo, pas de jsdom).

function readSource(rel: string): string {
  return readFileSync(resolve(process.cwd(), rel), 'utf-8');
}

const AUTH_MODAL = 'components/auth/AuthModal.tsx';
const PDF_BTN = 'components/crisis/PdfExportButton.tsx';
const ITIN_BLOCK = 'components/crisis/ItineraryBlock.tsx';

// ── 1. AuthModal transmet un next sécurisé au callback ───────────────────────

describe('AuthModal — transmet un next sécurisé au callback', () => {
  const src = readSource(AUTH_MODAL);

  it('accepte une prop next optionnelle', () => {
    expect(src).toContain('next?: string');
  });

  it('importe safeNext et le ré-applique côté client', () => {
    expect(src).toContain("from '@/lib/auth/safe-next'");
    expect(src).toContain('safeNext(');
  });

  it('calcule le fallback depuis pathname + search de la page courante', () => {
    expect(src).toContain('window.location.pathname');
    expect(src).toContain('window.location.search');
  });

  it('construit le callback avec ?next= encodé', () => {
    expect(src).toContain('/auth/callback');
    expect(src).toContain('encodeURIComponent(target)');
    expect(src).toContain('next=');
  });

  it('Google OAuth ET magic link passent par callbackUrl() (jamais un callback nu)', () => {
    expect(src).toContain('redirectTo: callbackUrl()');
    expect(src).toContain('emailRedirectTo: callbackUrl()');
    // les options ne doivent pas pointer directement vers un callback sans next
    expect(src).not.toContain('redirectTo: `${window.location.origin}/auth/callback`');
    expect(src).not.toContain('emailRedirectTo: `${window.location.origin}/auth/callback`');
  });
});

// ── 2. PdfExportButton — 401 ouvre AuthModal, plus de /login mort ─────────────

describe('PdfExportButton — 401 ouvre AuthModal (plus de lien mort /login)', () => {
  const src = readSource(PDF_BTN);

  it('ne contient plus href="/login"', () => {
    expect(src).not.toContain('href="/login"');
  });

  it('le CTA 401 ouvre la modale d\'auth locale', () => {
    expect(src).toContain("import { AuthModal }");
    expect(src).toContain('data-testid="pdf-export-login-btn"');
    expect(src).toContain('setShowAuth(true)');
    expect(src).toContain('<AuthModal');
  });

  it('le bloc 401 reste distinct du bloc 402 (pricing)', () => {
    expect(src).toContain('data-testid="pdf-export-error-401"');
    expect(src).toContain('data-testid="pdf-export-error-402"');
    // 402 garde son CTA pricing, 401 ne pointe pas vers pricing
    const block401Start = src.indexOf('data-testid="pdf-export-error-401"');
    const block401End = src.indexOf('data-testid="pdf-export-error-402"');
    const block401 = src.slice(block401Start, block401End);
    expect(block401).not.toContain('/pricing');
    expect(block401).toContain('AuthModal');
  });

  it('le CTA 402 pointe toujours vers /pricing', () => {
    expect(src).toContain('href="/pricing"');
  });

  it('ne touche pas /api/export-pdf (appel inchangé)', () => {
    expect(src).toContain('/api/export-pdf/${countryCode}');
  });
});

// ── 3. ItineraryBlock — 401 ouvre AuthModal, plus de /login mort ──────────────

describe('ItineraryBlock — 401 ouvre AuthModal (plus de lien mort /login)', () => {
  const src = readSource(ITIN_BLOCK);

  it('ne contient plus href="/login"', () => {
    expect(src).not.toContain('href="/login"');
  });

  it('le CTA 401 ouvre la modale d\'auth locale', () => {
    expect(src).toContain("import { AuthModal }");
    expect(src).toContain('data-testid="itinerary-login-btn"');
    expect(src).toContain('setShowAuth(true)');
  });

  it('401 et 402 restent distincts', () => {
    expect(src).toContain('data-testid="itinerary-error-401"');
    expect(src).toContain('data-testid="itinerary-error-402"');
    const block401Start = src.indexOf('data-testid="itinerary-error-401"');
    const block401End = src.indexOf('{/* ── Error 402', block401Start);
    const block401 = src.slice(block401Start, block401End);
    expect(block401).not.toContain('/pricing');
    expect(block401).toContain('AuthModal');
  });
});

// ── 4. Plus aucun lien mort /login dans tout le périmètre composants ──────────

describe('PREMIUM-FLOW-001A — aucune page /login référencée', () => {
  it('la page /login n\'existe pas (lien aurait été mort)', () => {
    expect(existsSync(resolve(process.cwd(), 'app/login'))).toBe(false);
    expect(existsSync(resolve(process.cwd(), 'app/login/page.tsx'))).toBe(false);
  });

  it('aucun composant du flow ne pointe vers /login', () => {
    for (const f of [PDF_BTN, ITIN_BLOCK, AUTH_MODAL]) {
      const src = readSource(f);
      expect(src).not.toContain('href="/login"');
      expect(src).not.toContain("router.push('/login')");
      expect(src).not.toContain('router.push("/login")');
    }
  });
});
