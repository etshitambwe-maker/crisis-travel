import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getUserWithSubscription } from '@/lib/auth/supabase-server';

export async function GET(): Promise<NextResponse> {
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
      'mode, status, confidence, analyzed_at'
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
  const analyses = (data ?? []).map((row) => ({
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
  }));

  return NextResponse.json({ analyses });
}
