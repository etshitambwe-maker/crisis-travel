import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createCheckoutSession, STRIPE_PRICES } from '@/lib/stripe/stripe.service';
import { getUser } from '@/lib/auth/supabase-server';

const Schema = z.object({
  plan: z.enum(['monthly', 'annual']),
});

export async function POST(request: Request): Promise<NextResponse> {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: 'Authentification requise' }, { status: 401 });
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: 'Stripe non configuré' }, { status: 503 });
  }

  try {
    const body = await request.json();
    const { plan } = Schema.parse(body);

    const origin = request.headers.get('origin') ?? process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
    const priceId = plan === 'annual' ? STRIPE_PRICES.premiumAnnual : STRIPE_PRICES.premiumMonthly;

    if (!priceId) {
      return NextResponse.json({ error: 'Prix Stripe non configuré' }, { status: 503 });
    }

    const session = await createCheckoutSession(
      user.id,
      user.email ?? '',
      priceId,
      `${origin}/?premium=success`,
      `${origin}/pricing?canceled=true`
    );

    return NextResponse.json({ url: session.url });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Données invalides' }, { status: 400 });
    }
    console.error('[Stripe/checkout]', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
