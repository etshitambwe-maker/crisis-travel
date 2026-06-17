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
  const { data: profile, error: findError } = await supabase
    .from('user_profiles')
    .select('id')
    .eq('stripe_customer_id', customerId)
    .single();

  if (findError) {
    console.error('[Stripe/webhook] upsertSubscription — erreur recherche profil', {
      customerId,
      subscriptionId,
      error: findError.message,
    });
  }

  if (!profile) {
    console.warn('[Stripe/webhook] Utilisateur introuvable pour customer:', customerId);
    return;
  }

  const isPremium = status === 'active' || status === 'trialing';
  const endDate = new Date(currentPeriodEnd * 1000).toISOString();

  const { error: updateError } = await supabase
    .from('user_profiles')
    .update({
      subscription_tier: isPremium ? 'premium' : 'free',
      subscription_end_date: isPremium ? endDate : null,
      stripe_subscription_id: subscriptionId,
    })
    .eq('id', profile.id);

  if (updateError) {
    console.error('[Stripe/webhook] upsertSubscription — erreur update profil', {
      userId: profile.id,
      customerId,
      subscriptionId,
      status,
      error: updateError.message,
    });
    return;
  }

  console.log(`[Stripe/webhook] sync OK: user ${profile.id} → ${isPremium ? 'premium' : 'free'} (${status})`);
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const customerId = session.customer as string;
  const userId = session.metadata?.supabase_user_id;

  console.log('[Stripe/webhook] checkout.session.completed', { customerId, userId: userId ?? 'absent' });

  if (!customerId || !userId) return;

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return;

  const supabase = getAdminClient();

  // Lier le stripe_customer_id au profil
  const { error: upsertError } = await supabase
    .from('user_profiles')
    .upsert({
      id: userId,
      stripe_customer_id: customerId,
    }, { onConflict: 'id' });

  if (upsertError) {
    console.error('[Stripe/webhook] checkout.session.completed — erreur liaison customer/user', {
      userId,
      customerId,
      error: upsertError.message,
    });
  }
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
        // API 2026-05-27.dahlia : current_period_end est au niveau de l'item
        // (sub.items.data[0]), plus à la racine de la souscription.
        // On lit l'item en priorité, puis la racine (compat), puis fallback +30j.
        const periodEnd = sub.items?.data?.[0]?.current_period_end
          ?? (sub as unknown as { current_period_end?: number }).current_period_end
          ?? Math.floor(Date.now() / 1000) + 2592000; // fallback +30j
        console.log(`[Stripe/webhook] ${event.type}`, {
          customerId: sub.customer as string,
          subscriptionId: sub.id,
          status: sub.status,
        });
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
        console.log('[Stripe/webhook] customer.subscription.deleted', {
          customerId: sub.customer as string,
          subscriptionId: sub.id,
        });
        await upsertSubscription(sub.customer as string, sub.id, 'canceled', 0);
        break;
      }

      case 'invoice.payment_failed': {
        const inv = event.data.object as Stripe.Invoice;
        const attemptCount = (inv as unknown as { attempt_count?: number }).attempt_count ?? null;
        const nextAttempt = (inv as unknown as { next_payment_attempt?: number | null }).next_payment_attempt ?? null;
        console.warn('[Stripe/webhook] invoice.payment_failed', {
          customerId: inv.customer,
          attemptCount,
          // null = Stripe a renoncé à réessayer (tous les retries épuisés)
          nextPaymentAttempt: nextAttempt !== null ? new Date(nextAttempt * 1000).toISOString() : null,
          willRetry: nextAttempt !== null,
        });
        // On ne dégrade pas immédiatement — Stripe réessaie automatiquement.
        // Si nextPaymentAttempt est null, tous les retries sont épuisés :
        // customer.subscription.deleted arrivera séparément et dégradera le compte.
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
