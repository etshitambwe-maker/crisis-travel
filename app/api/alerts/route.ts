import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getUser } from '@/lib/auth/supabase-server';
import { createSupabaseServerClient } from '@/lib/auth/supabase-server';
import { findCountry } from '@/lib/utils/countries';

const CreateAlertSchema = z.object({
  countryCode: z.string().length(2).toUpperCase(),
  thresholdScore: z.number().min(0).max(100).default(60),
  alertTypes: z.array(z.enum(['security_improved', 'cheap_flights', 'currency', 'jackpot'])).default(['security_improved', 'cheap_flights']),
});

// GET /api/alerts — liste les alertes de l'utilisateur
export async function GET(): Promise<NextResponse> {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: 'Authentification requise' }, { status: 401 });
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('user_alerts')
    .select('*')
    .eq('user_id', user.id)
    .eq('active', true)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: 'Erreur base de données' }, { status: 500 });
  }

  return NextResponse.json({ alerts: data ?? [] });
}

// POST /api/alerts — créer une alerte
export async function POST(request: Request): Promise<NextResponse> {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: 'Authentification requise' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { countryCode, thresholdScore, alertTypes } = CreateAlertSchema.parse(body);

    const country = findCountry(countryCode);
    if (!country) {
      return NextResponse.json({ error: 'Pays inconnu' }, { status: 404 });
    }

    const supabase = await createSupabaseServerClient();

    // Max 10 alertes par utilisateur (plan free) — à adapter selon subscription_tier
    const { count } = await supabase
      .from('user_alerts')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('active', true);

    if ((count ?? 0) >= 10) {
      return NextResponse.json(
        { error: 'Limite de 10 alertes atteinte. Désactivez une alerte existante.' },
        { status: 429 }
      );
    }

    const { data, error } = await supabase
      .from('user_alerts')
      .upsert({
        user_id: user.id,
        country_code: countryCode,
        country_name: country.name,
        threshold_score: thresholdScore,
        alert_types: alertTypes,
        active: true,
      }, { onConflict: 'user_id,country_code' })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: 'Erreur création alerte' }, { status: 500 });
    }

    return NextResponse.json({ alert: data }, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Données invalides', details: err.issues }, { status: 400 });
    }
    console.error('[API/alerts POST]', err);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

// DELETE /api/alerts?countryCode=XX — désactiver une alerte
export async function DELETE(request: Request): Promise<NextResponse> {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: 'Authentification requise' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const countryCode = searchParams.get('countryCode')?.toUpperCase();

  if (!countryCode || countryCode.length !== 2) {
    return NextResponse.json({ error: 'countryCode requis (2 caractères)' }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from('user_alerts')
    .update({ active: false })
    .eq('user_id', user.id)
    .eq('country_code', countryCode);

  if (error) {
    return NextResponse.json({ error: 'Erreur suppression alerte' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
