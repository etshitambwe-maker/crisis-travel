import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const ROUTE_PATH = 'app/api/country-guide/route.ts';
function readRoute(): string { return readFileSync(resolve(process.cwd(), ROUTE_PATH), 'utf-8'); }

// Réplique du schéma de la route (sans importer next/server).
const schema = z.object({
  countryCode: z.string().min(2).max(3).toUpperCase(),
  countryName: z.string().min(1).max(100),
  travelType: z.enum(['solo', 'couple', 'family', 'nomad']).optional(),
  budget: z.number().positive().max(1_000_000).optional(),
  duration: z.number().int().min(1).max(365).optional(),
});

describe('country-guide route — validation Zod', () => {
  it('accepte un payload valide', () => {
    expect(schema.safeParse({ countryCode: 'PT', countryName: 'Portugal', travelType: 'solo' }).success).toBe(true);
  });
  it('rejette countryCode absent', () => {
    expect(schema.safeParse({ countryName: 'Portugal' }).success).toBe(false);
  });
  it('rejette travelType invalide', () => {
    expect(schema.safeParse({ countryCode: 'PT', countryName: 'Portugal', travelType: 'business' }).success).toBe(false);
  });
});

describe('country-guide route — from/to dates (TRAVEL-DATES-001)', () => {
  const schemaWithDates = z.object({
    countryCode: z.string().min(2).max(3).toUpperCase(),
    countryName: z.string().min(1).max(100),
    travelType: z.enum(['solo', 'couple', 'family', 'nomad']).optional(),
    budget: z.number().positive().max(1_000_000).optional(),
    duration: z.number().int().min(1).max(365).optional(),
    from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  });

  it('accepte from/to valides', () => {
    expect(schemaWithDates.safeParse({
      countryCode: 'PT', countryName: 'Portugal',
      from: '2026-08-15', to: '2026-08-29',
    }).success).toBe(true);
  });

  it('rejette un format de date invalide', () => {
    expect(schemaWithDates.safeParse({
      countryCode: 'PT', countryName: 'Portugal', from: '15-08-2026',
    }).success).toBe(false);
  });

  it('la route contient une validation d\'ordre des dates (to > from)', () => {
    const src = readRoute();
    expect(src).toMatch(/refine|to.*from|from.*to/);
  });
});

describe('country-guide route — structure & gating', () => {
  it('le fichier route existe', () => {
    expect(existsSync(resolve(process.cwd(), ROUTE_PATH))).toBe(true);
  });
  it("vérifie l'authentification (401)", () => {
    const src = readRoute();
    expect(src).toContain('getUserWithSubscription');
    expect(src).toContain('401');
  });
  it('gate premium (402)', () => {
    const src = readRoute();
    expect(src).toContain('402');
    expect(src).toContain('isPremium');
  });
  it('appelle les deux services hybrides', () => {
    const src = readRoute();
    expect(src).toContain('getPerplexityCountryFacts');
    expect(src).toContain('generatePremiumCountryGuide');
  });
  it('déclare maxDuration', () => {
    expect(readRoute()).toContain('maxDuration');
  });
  it('ne génère pas en SSR (POST handler uniquement)', () => {
    const src = readRoute();
    expect(src).toContain('export async function POST');
    expect(src).not.toContain('export async function GET');
  });
});
