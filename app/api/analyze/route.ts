import { NextResponse } from 'next/server';
import { z } from 'zod';
import { calculateCrisisScore } from '@/lib/services/scoring/crisisScore.service';
import { detectOpportunities } from '@/lib/claude/claude.service';
import { TARGET_COUNTRIES } from '@/lib/utils/countries';
import type { AnalyzeResponse, OpportunityWindow } from '@/types/crisis.types';

const Schema = z.object({
  profile: z.object({
    departureCountry: z.string().min(2),
    budget: z.number().min(100).max(50000),
    duration: z.number().min(1).max(365),
    period: z.string().default('flexible'),
    travelType: z.enum(['solo', 'couple', 'family', 'nomad']),
    mode: z.enum(['standard', 'bunker', 'budget_crisis']).default('standard'),
    excludedContinents: z.array(z.string()).optional(),
    continent: z.string().optional(),        // filtre par continent
    priority: z.string().optional(),          // securite | budget | decouverte | tout
    sortBy: z.enum(['score', 'security', 'budget', 'alpha']).optional(),
    departureDate: z.string().optional(),
    returnDate: z.string().optional(),
  }),
});

export async function POST(request: Request): Promise<NextResponse> {
  const t0 = Date.now();
  try {
    const body = await request.json();
    const { profile } = Schema.parse(body);

    let countries = [...TARGET_COUNTRIES];
    // Filtre par continent unique (mode région)
    if (profile.continent) {
      countries = countries.filter((c) => c.continent === profile.continent);
    } else if (profile.excludedContinents?.length) {
      countries = countries.filter((c) => !profile.excludedContinents!.includes(c.continent));
    }

    // Shuffle pour varier les destinations analysées à chaque requête (Fisher-Yates)
    for (let i = countries.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [countries[i], countries[j]] = [countries[j], countries[i]];
    }

    // Analyser tous les pays si continent filtré, sinon batch de 6 sur tous
    const MAX = profile.continent ? countries.length : countries.length;
    const BATCH = profile.continent ? countries.length : 6;
    const results = [];
    for (let i = 0; i < Math.min(countries.length, MAX); i += BATCH) {
      const batch = countries.slice(i, i + BATCH);
      const settled = await Promise.allSettled(
        batch.map((c) => calculateCrisisScore(c, profile))
      );
      for (const r of settled) {
        if (r.status === 'fulfilled') results.push(r.value);
      }
    }

    // Tri selon sortBy ou mode
    let sorted = [...results];
    const sortBy = profile.sortBy;
    if (sortBy === 'security')     sorted = sorted.sort((a, b) => b.security.value - a.security.value);
    else if (sortBy === 'budget')  sorted = sorted.sort((a, b) => b.budget.value - a.budget.value);
    else                           sorted = sorted.sort((a, b) => b.total - a.total);

    // Filtres mode spéciaux
    if (profile.mode === 'bunker')        sorted = sorted.filter((s) => s.security.value >= 80);
    if (profile.mode === 'budget_crisis') sorted = sorted.filter((s) => s.budget.value >= 70 && s.security.value >= 60);

    const topDestinations = sorted.slice(0, 5);
    const rawOpportunities = await detectOpportunities(sorted, profile.budget);
    const opportunities = rawOpportunities.map((op) => ({
      ...op,
      country: sorted.find((s) => s.countryCode === op.countryCode)?.country ?? op.countryCode,
      score: sorted.find((s) => s.countryCode === op.countryCode)?.total ?? 0,
      type: op.type as OpportunityWindow['type'],
    }));

    const response: AnalyzeResponse = {
      results: sorted,
      topDestinations,
      opportunities,
      meta: { analyzedCountries: results.length, duration: Date.now() - t0, cacheHitRate: 0 },
    };
    return NextResponse.json(response);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Données invalides', details: error.issues }, { status: 400 });
    }
    console.error('[API/analyze]', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
