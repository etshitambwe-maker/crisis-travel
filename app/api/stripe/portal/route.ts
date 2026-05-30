import { NextResponse } from 'next/server';
import { createPortalSession } from '@/lib/stripe/stripe.service';
import { createSupabaseServerClient } from '@/lib/auth/supabase-server';
import { getUser } from '@/lib/auth/supabase-server';

export async function POST(request: Request): Promise<NextResponse> {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: 'Authentification requise' }, { status: 401 });
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: 'Stripe non configuré' }, { status: 503 });
  }

  const supabase = await createSupabaseServerClient();
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('stripe_customer_id')
    .eq('id', user.id)
    .single();

  if (!profile?.stripe_customer_id) {
    return NextResponse.json({ error: 'Aucun abonnement actif' }, { status: 404 });
  }

  const origin = request.headers.get('origin') ?? process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

  try {
    const portalSession = await createPortalSession(
      profile.stripe_customer_id,
      `${origin}/`
    );
    return NextResponse.json({ url: portalSession.url });
  } catch (error) {
    console.error('[Stripe/portal]', error);
    return NextResponse.json({ error: 'Erreur Stripe' }, { status: 500 });
  }
}
