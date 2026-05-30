import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ code: string }> }
): Promise<NextResponse> {
  const { code } = await params;
  const countryCode = code.toUpperCase();

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ history: [] });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const { data, error } = await supabase
    .from('crisis_score_history')
    .select('calculated_at, score, security_score, geopolitical_score, budget_score')
    .eq('country_code', countryCode)
    .order('calculated_at', { ascending: true })
    .limit(180); // 6 mois max si cron toutes les 6h = 4 entrées/jour × 180 = données

  if (error) {
    return NextResponse.json({ history: [] });
  }

  return NextResponse.json({ history: data ?? [] }, {
    headers: { 'Cache-Control': 'public, max-age=1800' },
  });
}
