import { NextResponse } from 'next/server';
import { constructWebhookEvent } from '@/lib/stripe/stripe.service';
import { createClient } from '@supabase/supabase-js';
import type Stripe from 'stripe';

// Client admin Supabase (service role) pour bypasser RLS
function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

async function upsertSubscription(
  customerId: string,
  subscriptionId: string,
  status: string,
  currentPeriodEnd: number
) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return;

  const supabase = getAdminClient();

  // Retrouver l'utilisateur par stripe_customer_id
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('id')
    .eq('stripe_customer_id', customerId)
    .single();

  if (!profile) {
    console.warn('[Stripe/webhook] Utilisateur introuvable pour customer:', customerId);
    return;
  }

  const isPremium = status === 'active' || status === 'trialing';
  const endDate = new Date(currentPeriodEnd * 1000).toISOString();

  await supabase
    .from('user_profiles')
    .update({
      subscription_tier: isPremium ? 'premium' : 'free',
      subscription_end_date: isPremium ? endDate : null,
      stripe_subscription_id: subscriptionId,
    })
    .eq('id', profile.id);

  console.log(`[Stripe/webhook] user ${profile.id} → ${isPremium ? 'premium' : 'free'} (${status})`);
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const customerId = session.customer as string;
  const userId = session.metadata?.supabase_user_id;

  if (!customerId || !userId) return;

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return;

  const supabase = getAdminClient();

  // Lier le stripe_customer_id au profil
  await supabase
    .from('user_profiles')
    .upsert({
      id: userId,
      stripe_customer_id: customerId,
    }, { onConflict: 'id' });
}

export async function POST(request: Request): Promise<NextResponse> {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return NextResponse.json({ error: 'Webhook secret manquant' }, { status: 400 });
  }

  const sig = request.headers.get('stripe-signature');
  if (!sig) {
    return NextResponse.json({ error: 'Signature manquante' }, { status: 400 });
  }

  const rawBody = await request.text();

  let event: Stripe.Event;
  try {
    event = constructWebhookEvent(rawBody, sig, webhookSecret);
  } catch (error) {
    console.error('[Stripe/webhook] Signature invalide:', error);
    return NextResponse.json({ error: 'Signature invalide' }, { status: 400 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription;
        // current_period_end est dans billing_cycle_anchor ou items.data[0].period.end
        const periodEnd = (sub as unknown as { current_period_end?: number }).current_period_end
          ?? Math.floor(Date.now() / 1000) + 2592000; // fallback +30j
        await upsertSubscription(
          sub.customer as string,
          sub.id,
          sub.status,
          periodEnd
        );
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        await upsertSubscription(sub.customer as string, sub.id, 'canceled', 0);
        break;
      }

      case 'invoice.payment_failed': {
        const inv = event.data.object as Stripe.Invoice;
        console.warn('[Stripe/webhook] Paiement échoué pour customer:', inv.customer);
        // On ne dégrade pas immédiatement — Stripe réessaie automatiquement
        break;
      }

      default:
        // Événement non géré — on ignore sans erreur
        break;
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('[Stripe/webhook] Erreur traitement:', error);
    return NextResponse.json({ error: 'Erreur traitement webhook' }, { status: 500 });
  }
}

// Nécessaire : lire le body brut pour la vérification de signature Stripe
export const config = {
  api: { bodyParser: false },
};
