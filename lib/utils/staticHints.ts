export const STATIC_HINTS: Record<string, { score: number; security: number; budget: number }> = {
  // Europe
  GE: { score: 82, security: 85, budget: 90 }, PT: { score: 70, security: 90, budget: 60 },
  AL: { score: 75, security: 80, budget: 85 }, GR: { score: 68, security: 85, budget: 65 },
  HR: { score: 65, security: 85, budget: 62 }, RS: { score: 70, security: 78, budget: 80 },
  ME: { score: 72, security: 80, budget: 78 }, BA: { score: 65, security: 75, budget: 82 },
  MD: { score: 60, security: 70, budget: 85 }, MK: { score: 63, security: 75, budget: 83 },
  AM: { score: 68, security: 76, budget: 82 }, TR: { score: 62, security: 68, budget: 75 },
  XK: { score: 60, security: 72, budget: 84 }, HU: { score: 65, security: 82, budget: 65 },
  // Afrique
  MA: { score: 63, security: 75, budget: 78 }, TN: { score: 62, security: 73, budget: 76 },
  EG: { score: 58, security: 68, budget: 78 }, SN: { score: 60, security: 72, budget: 80 },
  CI: { score: 55, security: 62, budget: 78 }, GH: { score: 60, security: 70, budget: 76 },
  KE: { score: 55, security: 62, budget: 72 }, TZ: { score: 60, security: 68, budget: 74 },
  RW: { score: 68, security: 78, budget: 75 }, ET: { score: 48, security: 50, budget: 82 },
  ZA: { score: 52, security: 50, budget: 68 }, MU: { score: 72, security: 85, budget: 60 },
  MG: { score: 50, security: 58, budget: 82 }, CM: { score: 48, security: 52, budget: 76 },
  CG: { score: 45, security: 48, budget: 74 }, CD: { score: 38, security: 35, budget: 78 },
  NG: { score: 42, security: 40, budget: 72 }, AO: { score: 50, security: 55, budget: 70 },
  // Asie
  TH: { score: 72, security: 80, budget: 85 }, VN: { score: 68, security: 82, budget: 88 },
  JP: { score: 65, security: 90, budget: 50 }, ID: { score: 65, security: 73, budget: 82 },
  KG: { score: 68, security: 75, budget: 90 }, UZ: { score: 70, security: 78, budget: 88 },
  KH: { score: 62, security: 72, budget: 88 }, LK: { score: 58, security: 68, budget: 80 },
  PH: { score: 60, security: 65, budget: 82 }, MY: { score: 68, security: 78, budget: 72 },
  SG: { score: 72, security: 95, budget: 45 }, MM: { score: 35, security: 28, budget: 80 },
  NP: { score: 62, security: 70, budget: 85 }, IN: { score: 60, security: 65, budget: 82 },
  KZ: { score: 65, security: 72, budget: 80 },
  // Amériques
  MX: { score: 60, security: 62, budget: 72 }, CO: { score: 58, security: 60, budget: 75 },
  PE: { score: 62, security: 65, budget: 78 }, EC: { score: 55, security: 60, budget: 80 },
  BO: { score: 58, security: 65, budget: 85 }, PY: { score: 55, security: 65, budget: 82 },
  UY: { score: 65, security: 75, budget: 68 }, GT: { score: 50, security: 55, budget: 78 },
  CR: { score: 65, security: 80, budget: 68 }, PA: { score: 62, security: 72, budget: 70 },
  CU: { score: 55, security: 72, budget: 80 }, DO: { score: 60, security: 68, budget: 74 },
  BR: { score: 55, security: 55, budget: 72 }, AR: { score: 65, security: 72, budget: 85 },
  CL: { score: 68, security: 78, budget: 68 },
  // Moyen-Orient
  JO: { score: 68, security: 80, budget: 72 }, AE: { score: 68, security: 88, budget: 45 },
  OM: { score: 72, security: 88, budget: 60 },
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
