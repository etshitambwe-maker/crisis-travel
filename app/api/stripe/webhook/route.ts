import { NextResponse } from 'next/server';
import { constructWebhookEvent } from '@/lib/stripe/stripe.service';
import { createClient } from '@supabase/supabase-js';
import {
  journalReceive,
  journalProcessed,
  journalFailed,
  journalIgnored,
} from '@/lib/stripe/stripe-event-journal';
import type Stripe from 'stripe';

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/**
 * Met à jour l'abonnement dans user_profiles.
 * Throw si la mutation critique échoue — permet au handler de retourner 500 à Stripe.
 */
async function upsertSubscription(
  customerId: string,
  subscriptionId: string,
  status: string,
  currentPeriodEnd: number
): Promise<void> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return;

  const supabase = getAdminClient();

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
  const endDate = isPremium && currentPeriodEnd > 0
    ? new Date(currentPeriodEnd * 1000).toISOString()
    : null;

  const { error: updateError } = await supabase
    .from('user_profiles')
    .update({
      subscription_tier: isPremium ? 'premium' : 'free',
      subscription_end_date: endDate,
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
    throw new Error(`upsertSubscription failed: ${updateError.message}`);
  }

  console.log('[Stripe/webhook] sync OK', {
    userId: profile.id,
    tier: isPremium ? 'premium' : 'free',
    status,
  });
}

/**
 * Lie stripe_customer_id au profil utilisateur lors du premier checkout.
 * Throw si l'UPSERT échoue — mutation critique.
 */
async function handleCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void> {
  const customerId = session.customer as string;
  const userId = session.metadata?.supabase_user_id;

  console.log('[Stripe/webhook] checkout.session.completed', {
    customerId,
    userId: userId ?? 'absent',
  });

  if (!customerId || !userId) return;
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return;

  const supabase = getAdminClient();

  const { error: upsertError } = await supabase
    .from('user_profiles')
    .upsert({ id: userId, stripe_customer_id: customerId }, { onConflict: 'id' });

  if (upsertError) {
    console.error('[Stripe/webhook] checkout.session.completed — erreur liaison customer/user', {
      userId,
      customerId,
      error: upsertError.message,
    });
    throw new Error(`handleCheckoutCompleted failed: ${upsertError.message}`);
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return NextResponse.json({ error: 'Webhook secret manquant' }, { status: 500 });
  }

  const sig = request.headers.get('stripe-signature');
  if (!sig) {
    return NextResponse.json({ error: 'Signature manquante' }, { status: 400 });
  }

  const rawBody = await request.text();

  let event: Stripe.Event;
  try {
    event = constructWebhookEvent(rawBody, sig, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown';
    console.error('[Stripe/webhook] Signature invalide', { message });
    return NextResponse.json({ error: 'Signature invalide' }, { status: 400 });
  }

  const canJournal = !!(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  let journalRowId: string | null = null;

  if (canJournal) {
    const supabase = getAdminClient();
    const handle = await journalReceive(supabase, {
      stripeEventId: event.id,
      eventType: event.type,
      livemode: event.livemode,
    });

    if (handle.isDuplicate) {
      return NextResponse.json({ received: true, duplicate: true });
    }

    journalRowId = handle.rowId;
  }

  const supabase = canJournal ? getAdminClient() : null;

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription;
        const periodEnd =
          sub.items?.data?.[0]?.current_period_end
          ?? (sub as unknown as { current_period_end?: number }).current_period_end
          ?? Math.floor(Date.now() / 1000) + 2592000;
        console.log(`[Stripe/webhook] ${event.type}`, {
          customerId: sub.customer as string,
          subscriptionId: sub.id,
          status: sub.status,
          livemode: event.livemode,
        });
        await upsertSubscription(sub.customer as string, sub.id, sub.status, periodEnd);
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        console.log('[Stripe/webhook] customer.subscription.deleted', {
          customerId: sub.customer as string,
          subscriptionId: sub.id,
          livemode: event.livemode,
        });
        await upsertSubscription(sub.customer as string, sub.id, 'canceled', 0);
        break;
      }

      case 'invoice.payment_succeeded': {
        const inv = event.data.object as Stripe.Invoice;
        console.log('[Stripe/webhook] invoice.payment_succeeded', {
          customerId: inv.customer as string,
          livemode: event.livemode,
        });
        break;
      }

      case 'invoice.payment_failed': {
        const inv = event.data.object as Stripe.Invoice;
        const attemptCount = (inv as unknown as { attempt_count?: number }).attempt_count ?? null;
        const nextAttempt = (inv as unknown as { next_payment_attempt?: number | null }).next_payment_attempt ?? null;
        console.warn('[Stripe/webhook] invoice.payment_failed', {
          customerId: inv.customer as string,
          attemptCount,
          nextPaymentAttempt: nextAttempt !== null ? new Date(nextAttempt * 1000).toISOString() : null,
          willRetry: nextAttempt !== null,
          livemode: event.livemode,
        });
        break;
      }

      default: {
        console.info('[Stripe/webhook] événement ignoré', {
          eventType: event.type,
          livemode: event.livemode,
        });
        if (supabase && journalRowId) {
          await journalIgnored(supabase, journalRowId);
        }
        return NextResponse.json({ received: true, ignored: true });
      }
    }

    if (supabase && journalRowId) {
      await journalProcessed(supabase, journalRowId);
    }
    return NextResponse.json({ received: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown';
    console.error('[Stripe/webhook] Erreur traitement', {
      eventType: event.type,
      stripeEventId: event.id,
      error: message,
    });
    if (supabase && journalRowId) {
      await journalFailed(supabase, journalRowId, message);
    }
    return NextResponse.json({ error: 'Erreur traitement webhook' }, { status: 500 });
  }
}
