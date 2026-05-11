export const STATIC_HINTS: Record<string, { score: number; security: number; budget: number }> = {
  GE: { score: 82, security: 85, budget: 90 }, TH: { score: 72, security: 80, budget: 85 },
  PT: { score: 70, security: 90, budget: 60 }, VN: { score: 68, security: 82, budget: 88 },
  AL: { score: 75, security: 80, budget: 85 }, GR: { score: 68, security: 85, budget: 65 },
  HR: { score: 65, security: 85, budget: 62 }, RS: { score: 70, security: 78, budget: 80 },
  ME: { score: 72, security: 80, budget: 78 }, JP: { score: 65, security: 90, budget: 50 },
  KH: { score: 62, security: 72, budget: 88 }, MA: { score: 63, security: 75, budget: 78 },
  SN: { score: 60, security: 72, budget: 80 }, RW: { score: 68, security: 78, budget: 75 },
  KE: { score: 55, security: 62, budget: 72 }, TN: { score: 62, security: 73, budget: 76 },
  MU: { score: 72, security: 85, budget: 60 }, UZ: { score: 70, security: 78, budget: 88 },
  KG: { score: 68, security: 75, budget: 90 }, PE: { score: 62, security: 65, budget: 78 },
  CO: { score: 58, security: 60, budget: 75 }, CR: { score: 65, security: 80, budget: 68 },
  MX: { score: 60, security: 62, budget: 72 }, AR: { score: 65, security: 72, budget: 85 },
  JO: { score: 68, security: 80, budget: 72 }, OM: { score: 72, security: 88, budget: 60 },
};

export function getHint(code: string) {
  return STATIC_HINTS[code] ?? { score: 55, security: 55, budget: 55 };
}

export function hintToStatus(score: number): { label: string; color: string } {
  if (score >= 70) return { label: 'IDÉALE',       color: '#3ddc97' };
  if (score >= 58) return { label: 'RECOMMANDÉE',  color: '#ffb224' };
  if (score >= 45) return { label: 'POSSIBLE',     color: '#ff8c42' };
  return              { label: 'DÉCONSEILLÉE', color: '#ff3b2f' };
}
