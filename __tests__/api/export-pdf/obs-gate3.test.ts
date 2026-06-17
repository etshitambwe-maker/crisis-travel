import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// EXPORT-PDF-OBS-001 Gate 3 — validation de l'observabilité instrumentée.
// Tests source-assertion cohérents avec le style du fichier export-pdf.test.ts.

const ROUTE = readFileSync(
  resolve(process.cwd(), 'app/api/export-pdf/[code]/route.ts'),
  'utf-8',
);

// ── 1. Logs de début et de fin ────────────────────────────────────────────────

describe('EXPORT-PDF-OBS-001 — log début et terminé', () => {
  it('log début présent avec code et userId', () => {
    expect(ROUTE).toContain("[API/export-pdf] début");
    expect(ROUTE).toContain('code');
    expect(ROUTE).toContain('userId');
  });

  it('log terminé présent avec mode, code, durationMs, success', () => {
    expect(ROUTE).toContain("[API/export-pdf] terminé");
    expect(ROUTE).toContain('durationMs');
    expect(ROUTE).toContain('success: true');
  });

  it('startMs est capturé au début du handler', () => {
    expect(ROUTE).toMatch(/const startMs\s*=\s*Date\.now\(\)/);
  });

  it('durationMs est calculé avant le log terminé', () => {
    const terminéIdx  = ROUTE.indexOf("[API/export-pdf] terminé");
    const durationIdx = ROUTE.indexOf('Date.now() - startMs');
    expect(durationIdx).toBeGreaterThan(-1);
    expect(durationIdx).toBeLessThan(terminéIdx);
  });
});

// ── 2. Log payload invalide Zod ───────────────────────────────────────────────

describe('EXPORT-PDF-OBS-001 — log validation Zod', () => {
  it('warn payload invalide présent dans la branche else de safeParse', () => {
    expect(ROUTE).toContain("[API/export-pdf] payload invalide — fallback Mode C");
  });

  it('log Zod contient issueCount', () => {
    const warnIdx  = ROUTE.indexOf("[API/export-pdf] payload invalide");
    const closeIdx = ROUTE.indexOf('})', warnIdx);
    const block    = ROUTE.slice(warnIdx, closeIdx);
    expect(block).toContain('issueCount');
  });

  it('log Zod contient paths (sans valeurs)', () => {
    const warnIdx  = ROUTE.indexOf("[API/export-pdf] payload invalide");
    const closeIdx = ROUTE.indexOf('})', warnIdx);
    const block    = ROUTE.slice(warnIdx, closeIdx);
    expect(block).toContain('paths');
    expect(block).toMatch(/path\.join/);
  });

  it('log Zod contient codes Zod', () => {
    const warnIdx  = ROUTE.indexOf("[API/export-pdf] payload invalide");
    const closeIdx = ROUTE.indexOf('})', warnIdx);
    const block    = ROUTE.slice(warnIdx, closeIdx);
    expect(block).toContain('codes');
  });

  it('log Zod ne contient pas les valeurs du body', () => {
    const warnIdx  = ROUTE.indexOf("[API/export-pdf] payload invalide");
    const closeIdx = ROUTE.indexOf('})', warnIdx);
    const block    = ROUTE.slice(warnIdx, closeIdx);
    expect(block).not.toContain('body');
    expect(block).not.toContain('guideText');
    expect(block).not.toContain('narrative');
  });
});

// ── 3. Log mode sélectionné — les 4 modes ────────────────────────────────────

describe('EXPORT-PDF-OBS-001 — log mode sélectionné', () => {
  it('log mode présent pour Mode Guide', () => {
    // Cherche l'assignment selectedMode = 'Guide' (pas la déclaration du type union)
    const idx  = ROUTE.indexOf("selectedMode = 'Guide'");
    const block = ROUTE.slice(idx, idx + 400);
    expect(block).toContain("[API/export-pdf] mode sélectionné");
  });

  it('log mode présent pour Mode A', () => {
    const idx  = ROUTE.indexOf("selectedMode = 'A_itinerary'");
    const block = ROUTE.slice(idx, idx + 400);
    expect(block).toContain("[API/export-pdf] mode sélectionné");
  });

  it('log mode présent pour Mode B', () => {
    const idx  = ROUTE.indexOf("selectedMode = 'B_scoreSnapshot'");
    const block = ROUTE.slice(idx, idx + 400);
    expect(block).toContain("[API/export-pdf] mode sélectionné");
  });

  it('log mode présent pour Mode C', () => {
    const idx  = ROUTE.indexOf("selectedMode = 'C_legacy'");
    const block = ROUTE.slice(idx, idx + 400);
    expect(block).toContain("[API/export-pdf] mode sélectionné");
  });

  it('chaque log mode contient hasProfile, hasItinerary, hasScoreSnapshot, hasCountryGuide', () => {
    const occurrences = ROUTE.split("[API/export-pdf] mode sélectionné").length - 1;
    expect(occurrences).toBe(4);
    expect(ROUTE).toContain('hasProfile');
    expect(ROUTE).toContain('hasItinerary');
    expect(ROUTE).toContain('hasScoreSnapshot');
    expect(ROUTE).toContain('hasCountryGuide');
  });

  it('log mode ne contient jamais guideText ou narrative ou itinerary complet', () => {
    const occStart = ROUTE.indexOf("[API/export-pdf] mode sélectionné");
    const modeBlock = ROUTE.slice(occStart, occStart + 2000);
    expect(modeBlock).not.toContain('guideText');
    expect(modeBlock).not.toContain('.narrative');
    expect(modeBlock).not.toContain('.days');
  });
});

// ── 4. Catch catégorisé via variable stage ────────────────────────────────────

describe('EXPORT-PDF-OBS-001 — catch catégorisé', () => {
  it('variable stage déclarée au début du handler', () => {
    expect(ROUTE).toMatch(/let stage\s*=/);
  });

  it('stage mis à jour avant chaque étape critique', () => {
    expect(ROUTE).toContain("stage = 'parse_payload'");
    expect(ROUTE).toContain("stage = 'select_mode'");
    expect(ROUTE).toContain("stage = 'mode_guide_render'");
    expect(ROUTE).toContain("stage = 'mode_a_render'");
    expect(ROUTE).toContain("stage = 'mode_b_render'");
    expect(ROUTE).toContain("stage = 'mode_c_scoring'");
    expect(ROUTE).toContain("stage = 'mode_c_narrative'");
  });

  it('log erreur contient stage, mode, code, durationMs, errorName, errorMessage', () => {
    const errIdx   = ROUTE.indexOf("[API/export-pdf] erreur");
    const closeIdx = ROUTE.indexOf('})', errIdx);
    const block    = ROUTE.slice(errIdx, closeIdx);
    expect(block).toContain('stage');
    expect(block).toContain('mode');
    expect(block).toContain('code');
    expect(block).toContain('durationMs');
    expect(block).toContain('errorName');
    expect(block).toContain('errorMessage');
  });

  it('log erreur ne contient jamais le payload ou les données sensibles', () => {
    const errIdx   = ROUTE.indexOf("[API/export-pdf] erreur");
    const closeIdx = ROUTE.indexOf('})', errIdx);
    const block    = ROUTE.slice(errIdx, closeIdx);
    expect(block).not.toContain('narrative');
    expect(block).not.toContain('guideText');
    expect(block).not.toContain('itinerary');
    expect(block).not.toContain('body');
  });
});

// ── 5. Sécurité — aucune donnée sensible dans aucun log ──────────────────────

describe('EXPORT-PDF-OBS-001 — absence données sensibles', () => {
  // Extraire uniquement les blocs console.* pour cibler les logs
  const consoleLogs = ROUTE
    .split('\n')
    .filter((l) => l.trim().startsWith('console.'));

  it('aucun console.* ne contient clientNarrative ou clientCountryGuide.guideText', () => {
    for (const line of consoleLogs) {
      expect(line).not.toContain('clientNarrative');
      expect(line).not.toContain('guideText');
    }
  });

  it('aucun console.* ne contient clientItinerary directement', () => {
    for (const line of consoleLogs) {
      expect(line).not.toContain('clientItinerary');
    }
  });

  it('aucun console.* ne contient body (payload complet)', () => {
    for (const line of consoleLogs) {
      expect(line).not.toContain('body');
    }
  });

  it('email non présent dans les logs (userId seul)', () => {
    for (const line of consoleLogs) {
      expect(line).not.toContain('email');
      expect(line).not.toContain('user.email');
    }
  });
});

// ── 6. Invariants préservés ───────────────────────────────────────────────────

describe('EXPORT-PDF-OBS-001 — invariants route', () => {
  it("runtime = 'nodejs' intact", () => {
    expect(ROUTE).toMatch(/export\s+const\s+runtime\s*=\s*['"]nodejs['"]/);
  });

  it('maxDuration = 60 intact', () => {
    expect(ROUTE).toContain('maxDuration = 60');
  });

  it('Mode Guide en tête de cascade (avant if clientItinerary)', () => {
    const guideIdx = ROUTE.indexOf('clientCountryGuide && clientCountryGuide.guideText');
    const aIdx     = ROUTE.indexOf('if (clientItinerary)');
    expect(guideIdx).toBeLessThan(aIdx);
  });

  it('Mode Guide ne contient aucun appel calculateCrisisScore ni generateDestinationNarrative', () => {
    const guideStart = ROUTE.indexOf('Mode Guide');
    const aStart     = ROUTE.indexOf('Mode A');
    const guideBlock = ROUTE.slice(guideStart, aStart);
    expect(guideBlock).not.toContain('calculateCrisisScore');
    expect(guideBlock).not.toContain('generateDestinationNarrative');
  });

  it('Mode A ne contient aucun appel IA', () => {
    const aStart = ROUTE.indexOf('Mode A');
    const bStart = ROUTE.indexOf('Mode B');
    const aBlock = ROUTE.slice(aStart, bStart);
    expect(aBlock).not.toContain('calculateCrisisScore');
    expect(aBlock).not.toContain('generateDestinationNarrative');
  });

  it('Mode B ne contient aucun appel IA', () => {
    const bStart = ROUTE.indexOf('Mode B');
    const cStart = ROUTE.indexOf('Mode C');
    const bBlock = ROUTE.slice(bStart, cStart);
    expect(bBlock).not.toContain('calculateCrisisScore');
    expect(bBlock).not.toContain('generateDestinationNarrative');
  });

  it('calculateCrisisScore importé dynamiquement dans Mode C uniquement', () => {
    expect(ROUTE).not.toMatch(/^import\s+\{[^}]*calculateCrisisScore/m);
    const legacyIdx  = ROUTE.indexOf('Mode C');
    const importIdx  = ROUTE.indexOf('calculateCrisisScore');
    expect(importIdx).toBeGreaterThan(legacyIdx);
  });

  it('renderToBuffer importé statiquement ESM (invariant PDF-DEBUG-P0)', () => {
    expect(ROUTE).toMatch(/import\s*\{\s*renderToBuffer\s*\}\s*from\s*['"]@react-pdf\/renderer['"]/);
  });
});
