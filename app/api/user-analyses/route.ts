import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getUserWithSubscription } from '@/lib/auth/supabase-server';

interface AnalysisRow {
  id: string;
  country_code: string;
  country_name: string;
  crisis_score: number;
  security_score: number | null;
  geopolitical_score: number | null;
  budget_score: number | null;
  travel_type: string | null;
  duration: number | null;
  budget: number | null;
  mode: string | null;
  status: string | null;
  confidence: string | null;
  analyzed_at: string;
  departure_date: string | null;  // TRAVEL-DATES-001
  return_date: string | null;     // TRAVEL-DATES-001
}

export async function GET(_request: Request): Promise<NextResponse> {
  const { user, isPremium } = await getUserWithSubscription();

  if (!user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  if (!isPremium) {
    return NextResponse.json(
      { analyses: [], premiumRequired: true, upgradeUrl: '/pricing' },
      { status: 402 }
    );
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ analyses: [] });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const { data, error } = await supabase
    .from('user_analyses')
    .select(
      'id, country_code, country_name, crisis_score, security_score, ' +
      'geopolitical_score, budget_score, travel_type, duration, budget, ' +
      'mode, status, confidence, analyzed_at, departure_date, return_date'
    )
    .eq('user_id', user.id)
    .gt('analyzed_at', sixMonthsAgo.toISOString())
    .order('analyzed_at', { ascending: false })
    .limit(50);

  if (error) {
    console.error('[API/user-analyses] fetch error', error);
    return NextResponse.json({ analyses: [] });
  }

  // Mapper snake_case → camelCase ; user_id explicitement exclu
  // Double cast via unknown : Supabase SDK sans schéma injecté retourne un type
  // union complexe incompatible avec notre interface. Le cast est sûr car on contrôle
  // exactement les colonnes sélectionnées dans le .select() ci-dessus.
  const analyses = ((data ?? []) as unknown as AnalysisRow[]).map((row) => ({
    id:                row.id,
    countryCode:       row.country_code,
    countryName:       row.country_name,
    crisisScore:       row.crisis_score,
    securityScore:     row.security_score,
    geopoliticalScore: row.geopolitical_score,
    budgetScore:       row.budget_score,
    travelType:        row.travel_type,
    duration:          row.duration,
    budget:            row.budget,
    mode:              row.mode,
    status:            row.status,
    confidence:        row.confidence,
    analyzedAt:        row.analyzed_at,
    departureDate:     row.departure_date ?? null,  // TRAVEL-DATES-001
    returnDate:        row.return_date    ?? null,  // TRAVEL-DATES-001
  }));

  return NextResponse.json({ analyses });
}
