// Exigences visa pour les ressortissants français — mis à jour manuellement chaque trimestre
// Sources : IATA Travel Centre, France Diplomatie, Passportindex.org

export type VisaType = 'none' | 'evisa' | 'voa' | 'embassy_simple' | 'embassy_complex' | 'blocked';

export interface VisaRequirement {
  type: VisaType;
  score: number;
  processingDays: number;
  notes?: string;
}

export const VISA_REQUIREMENTS: Record<string, VisaRequirement> = {
  // ─── EUROPE ───────────────────────────────────────────────────────────────
  PT: { type: 'none', score: 100, processingDays: 0 },
  GE: { type: 'none', score: 100, processingDays: 0 },
  AL: { type: 'none', score: 100, processingDays: 0 },
  RS: { type: 'none', score: 100, processingDays: 0 },
  BA: { type: 'none', score: 100, processingDays: 0 },
  MD: { type: 'none', score: 100, processingDays: 0 },
  MK: { type: 'none', score: 100, processingDays: 0 },
  AM: { type: 'none', score: 100, processingDays: 0 },
  TR: { type: 'evisa', score: 85, processingDays: 1, notes: 'e-Visa en ligne, traitement rapide' },
  ME: { type: 'none', score: 100, processingDays: 0 },
  XK: { type: 'none', score: 100, processingDays: 0 },
  GR: { type: 'none', score: 100, processingDays: 0 },
  HR: { type: 'none', score: 100, processingDays: 0 },
  HU: { type: 'none', score: 100, processingDays: 0 },

  // ─── AFRIQUE ──────────────────────────────────────────────────────────────
  MA: { type: 'none', score: 100, processingDays: 0 },
  TN: { type: 'none', score: 100, processingDays: 0 },
  EG: { type: 'voa', score: 70, processingDays: 0, notes: 'Visa à l\'arrivée disponible, ~25 USD' },
  SN: { type: 'none', score: 100, processingDays: 0 },
  CI: { type: 'none', score: 100, processingDays: 0 },
  GH: { type: 'evisa', score: 85, processingDays: 3 },
  KE: { type: 'evisa', score: 85, processingDays: 3, notes: 'ETA en ligne obligatoire' },
  TZ: { type: 'evisa', score: 85, processingDays: 3 },
  RW: { type: 'voa', score: 70, processingDays: 0 },
  ET: { type: 'evisa', score: 85, processingDays: 3 },
  ZA: { type: 'none', score: 100, processingDays: 0 },
  MU: { type: 'none', score: 100, processingDays: 0 },
  MG: { type: 'voa', score: 70, processingDays: 0 },
  CM: { type: 'embassy_simple', score: 40, processingDays: 10 },
  CG: { type: 'embassy_simple', score: 40, processingDays: 14 },
  CD: { type: 'embassy_simple', score: 40, processingDays: 14 },
  NG: { type: 'evisa', score: 85, processingDays: 5 },
  AO: { type: 'evisa', score: 85, processingDays: 7 },

  // ─── ASIE ─────────────────────────────────────────────────────────────────
  TH: { type: 'none', score: 100, processingDays: 0, notes: 'Sans visa jusqu\'à 30 jours' },
  VN: { type: 'evisa', score: 85, processingDays: 3, notes: 'e-Visa 90 jours disponible' },
  JP: { type: 'none', score: 100, processingDays: 0, notes: 'Sans visa jusqu\'à 90 jours' },
  ID: { type: 'voa', score: 70, processingDays: 0, notes: 'Visa on arrival à Bali, Jakarta, etc.' },
  KG: { type: 'evisa', score: 85, processingDays: 3 },
  UZ: { type: 'none', score: 100, processingDays: 0 },
  KH: { type: 'evisa', score: 85, processingDays: 3 },
  LK: { type: 'evisa', score: 85, processingDays: 2, notes: 'ETA en ligne' },
  PH: { type: 'none', score: 100, processingDays: 0, notes: 'Sans visa jusqu\'à 30 jours' },
  MY: { type: 'none', score: 100, processingDays: 0, notes: 'Sans visa jusqu\'à 90 jours' },
  SG: { type: 'none', score: 100, processingDays: 0 },
  MM: { type: 'evisa', score: 85, processingDays: 3 },
  NP: { type: 'voa', score: 70, processingDays: 0 },
  IN: { type: 'evisa', score: 85, processingDays: 4, notes: 'e-Visa touristique 60 jours' },
  KZ: { type: 'none', score: 100, processingDays: 0, notes: 'Sans visa jusqu\'à 30 jours' },

  // ─── AMÉRIQUES ────────────────────────────────────────────────────────────
  MX: { type: 'none', score: 100, processingDays: 0 },
  CO: { type: 'none', score: 100, processingDays: 0 },
  PE: { type: 'none', score: 100, processingDays: 0 },
  EC: { type: 'none', score: 100, processingDays: 0 },
  BO: { type: 'none', score: 100, processingDays: 0 },
  PY: { type: 'none', score: 100, processingDays: 0 },
  UY: { type: 'none', score: 100, processingDays: 0 },
  GT: { type: 'none', score: 100, processingDays: 0 },
  CR: { type: 'none', score: 100, processingDays: 0 },
  PA: { type: 'none', score: 100, processingDays: 0 },
  CU: { type: 'voa', score: 70, processingDays: 0, notes: 'Tourist card requise, achetable à l\'aéroport' },
  DO: { type: 'voa', score: 70, processingDays: 0, notes: 'Tourist card incluse dans billet d\'avion souvent' },
  BR: { type: 'none', score: 100, processingDays: 0 },
  AR: { type: 'none', score: 100, processingDays: 0 },
  CL: { type: 'none', score: 100, processingDays: 0 },

  // ─── MOYEN-ORIENT ─────────────────────────────────────────────────────────
  JO: { type: 'voa', score: 70, processingDays: 0 },
  AE: { type: 'none', score: 100, processingDays: 0 },
  OM: { type: 'evisa', score: 85, processingDays: 2 },
};

// Connexions aériennes depuis CDG (Air France + partenaires)
export interface FlightConnection {
  directFromCDG: boolean;
  minStops: number;
  score: number;
  approxDurationH: number;
}

export const FLIGHT_CONNECTIONS: Record<string, FlightConnection> = {
  // Europe (toujours bien connecté)
  PT: { directFromCDG: true,  minStops: 0, score: 100, approxDurationH: 2.5 },
  GE: { directFromCDG: true,  minStops: 0, score: 100, approxDurationH: 4.5 },
  AL: { directFromCDG: true,  minStops: 0, score: 100, approxDurationH: 2.5 },
  RS: { directFromCDG: true,  minStops: 0, score: 100, approxDurationH: 2.5 },
  BA: { directFromCDG: false, minStops: 1, score: 70,  approxDurationH: 3.5 },
  MD: { directFromCDG: false, minStops: 1, score: 70,  approxDurationH: 3.5 },
  MK: { directFromCDG: true,  minStops: 0, score: 100, approxDurationH: 2.5 },
  AM: { directFromCDG: true,  minStops: 0, score: 100, approxDurationH: 4.5 },
  TR: { directFromCDG: true,  minStops: 0, score: 100, approxDurationH: 3.5 },
  ME: { directFromCDG: true,  minStops: 0, score: 100, approxDurationH: 2.5 },
  XK: { directFromCDG: false, minStops: 1, score: 70,  approxDurationH: 3 },
  GR: { directFromCDG: true,  minStops: 0, score: 100, approxDurationH: 3 },
  HR: { directFromCDG: true,  minStops: 0, score: 100, approxDurationH: 2 },
  HU: { directFromCDG: true,  minStops: 0, score: 100, approxDurationH: 2 },

  // Afrique
  MA: { directFromCDG: true,  minStops: 0, score: 100, approxDurationH: 3 },
  TN: { directFromCDG: true,  minStops: 0, score: 100, approxDurationH: 2.5 },
  EG: { directFromCDG: true,  minStops: 0, score: 100, approxDurationH: 5 },
  SN: { directFromCDG: true,  minStops: 0, score: 100, approxDurationH: 6 },
  CI: { directFromCDG: true,  minStops: 0, score: 100, approxDurationH: 6.5 },
  GH: { directFromCDG: true,  minStops: 0, score: 100, approxDurationH: 7 },
  KE: { directFromCDG: true,  minStops: 0, score: 100, approxDurationH: 8.5 },
  TZ: { directFromCDG: false, minStops: 1, score: 70,  approxDurationH: 10 },
  RW: { directFromCDG: true,  minStops: 0, score: 100, approxDurationH: 9 },
  ET: { directFromCDG: true,  minStops: 0, score: 100, approxDurationH: 7 },
  ZA: { directFromCDG: true,  minStops: 0, score: 100, approxDurationH: 11 },
  MU: { directFromCDG: true,  minStops: 0, score: 100, approxDurationH: 11 },
  MG: { directFromCDG: false, minStops: 1, score: 70,  approxDurationH: 11 },
  CM: { directFromCDG: true,  minStops: 0, score: 100, approxDurationH: 7 },
  CG: { directFromCDG: true,  minStops: 0, score: 100, approxDurationH: 8 },
  CD: { directFromCDG: true,  minStops: 0, score: 100, approxDurationH: 8.5 },
  NG: { directFromCDG: true,  minStops: 0, score: 100, approxDurationH: 7 },
  AO: { directFromCDG: false, minStops: 1, score: 70,  approxDurationH: 9 },

  // Asie
  TH: { directFromCDG: true,  minStops: 0, score: 100, approxDurationH: 11 },
  VN: { directFromCDG: false, minStops: 1, score: 70,  approxDurationH: 13 },
  JP: { directFromCDG: true,  minStops: 0, score: 100, approxDurationH: 12 },
  ID: { directFromCDG: false, minStops: 1, score: 70,  approxDurationH: 14 },
  KG: { directFromCDG: false, minStops: 1, score: 70,  approxDurationH: 8 },
  UZ: { directFromCDG: true,  minStops: 0, score: 100, approxDurationH: 7 },
  KH: { directFromCDG: false, minStops: 1, score: 70,  approxDurationH: 13 },
  LK: { directFromCDG: false, minStops: 1, score: 70,  approxDurationH: 11 },
  PH: { directFromCDG: false, minStops: 1, score: 70,  approxDurationH: 14 },
  MY: { directFromCDG: true,  minStops: 0, score: 100, approxDurationH: 12 },
  SG: { directFromCDG: true,  minStops: 0, score: 100, approxDurationH: 13 },
  MM: { directFromCDG: false, minStops: 1, score: 70,  approxDurationH: 13 },
  NP: { directFromCDG: false, minStops: 1, score: 70,  approxDurationH: 10 },
  IN: { directFromCDG: true,  minStops: 0, score: 100, approxDurationH: 8.5 },
  KZ: { directFromCDG: true,  minStops: 0, score: 100, approxDurationH: 7 },

  // Amériques
  MX: { directFromCDG: true,  minStops: 0, score: 100, approxDurationH: 12 },
  CO: { directFromCDG: true,  minStops: 0, score: 100, approxDurationH: 11 },
  PE: { directFromCDG: false, minStops: 1, score: 70,  approxDurationH: 14 },
  EC: { directFromCDG: false, minStops: 1, score: 70,  approxDurationH: 13 },
  BO: { directFromCDG: false, minStops: 1, score: 70,  approxDurationH: 14 },
  PY: { directFromCDG: false, minStops: 1, score: 70,  approxDurationH: 15 },
  UY: { directFromCDG: false, minStops: 1, score: 70,  approxDurationH: 14 },
  GT: { directFromCDG: false, minStops: 1, score: 70,  approxDurationH: 12 },
  CR: { directFromCDG: false, minStops: 1, score: 70,  approxDurationH: 12 },
  PA: { directFromCDG: false, minStops: 1, score: 70,  approxDurationH: 12 },
  CU: { directFromCDG: true,  minStops: 0, score: 100, approxDurationH: 10 },
  DO: { directFromCDG: true,  minStops: 0, score: 100, approxDurationH: 9 },
  BR: { directFromCDG: true,  minStops: 0, score: 100, approxDurationH: 11 },
  AR: { directFromCDG: true,  minStops: 0, score: 100, approxDurationH: 13 },
  CL: { directFromCDG: true,  minStops: 0, score: 100, approxDurationH: 14 },

  // Moyen-Orient
  JO: { directFromCDG: true,  minStops: 0, score: 100, approxDurationH: 5 },
  AE: { directFromCDG: true,  minStops: 0, score: 100, approxDurationH: 7 },
  OM: { directFromCDG: false, minStops: 1, score: 70,  approxDurationH: 8 },
};
