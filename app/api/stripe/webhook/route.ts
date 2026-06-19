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

/**
 * Log ops structuré — champs safe uniquement, jamais d'objet Stripe complet.
 * Utilisé pour la visibilité opérationnelle en production (Vercel Logs).
 */
function logStripeOps(eventName: string, data: Record<string, unknown>): void {
  console.warn('[Stripe Ops]', { eventName, ...data });
}

/**
 * Détermine si un statut Stripe maintient l'accès premium,
 * en tenant compte de la période de retry Stripe (past_due).
 *
 * Statuts actifs  : active, trialing, past_due (retry en cours, période encore valide)
 * Statuts inactifs: canceled, unpaid, incomplete, incomplete_expired
 *
 * Note : past_due → l'accès est maintenu tant que subscription_end_date est dans le futur.
 * C'est getUserWithSubscription (supabase-server.ts) qui retire l'accès une fois la date passée.
 */
export function isPremiumFromStatus(status: string, currentPeriodEnd: number): boolean {
  const activeStatuses = new Set(['active', 'trialing', 'past_due']);
  const nowSec = Math.floor(Date.now() / 1000);
  return activeStatuses.has(status) && currentPeriodEnd > nowSec;
}

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

  const isPremium = isPremiumFromStatus(status, currentPeriodEnd);
  const endDate = isPremium
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

        const previousStatus = (
          event.data.previous_attributes as Record<string, unknown> | undefined
        )?.status as string | undefined;
        const currentStatus = sub.status;
        const cancelAtPeriodEnd = (sub as unknown as { cancel_at_period_end?: boolean }).cancel_at_period_end ?? false;
        const computedTier = isPremiumFromStatus(currentStatus, periodEnd) ? 'premium' : 'free';

        // Action ops dérivée de la transition de statut
        let opsAction = 'subscription_updated';
        if (previousStatus && previousStatus !== currentStatus) {
          if (currentStatus === 'past_due') opsAction = 'subscription_became_past_due';
          else if (previousStatus === 'past_due' && currentStatus === 'active') opsAction = 'subscription_recovered';
          else if (currentStatus === 'unpaid') opsAction = 'subscription_became_unpaid';
        }

        console.log(`[Stripe/webhook] ${event.type}`, {
          customerId: sub.customer as string,
          subscriptionId: sub.id,
          status: currentStatus,
          livemode: event.livemode,
        });

        logStripeOps('subscription_status_transition', {
          stripeEventId: event.id,
          eventType: event.type,
          livemode: event.livemode,
          customerId: sub.customer as string,
          subscriptionId: sub.id,
          previousStatus: previousStatus ?? null,
          currentStatus,
          currentPeriodEnd: new Date(periodEnd * 1000).toISOString(),
          cancelAtPeriodEnd,
          computedTier,
          opsAction,
        });

        await upsertSubscription(sub.customer as string, sub.id, sub.status, periodEnd);
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        // Stripe envoie deleted après current_period_end dans le flux normal.
        // On passe 0 volontairement : endDate sera null, tier=free. Nettoyage final.
        console.log('[Stripe/webhook] customer.subscription.deleted', {
          customerId: sub.customer as string,
          subscriptionId: sub.id,
          livemode: event.livemode,
          status: sub.status,
        });
        await upsertSubscription(sub.customer as string, sub.id, 'canceled', 0);
        break;
      }

      case 'invoice.payment_succeeded': {
        const inv = event.data.object as Stripe.Invoice;
        const invRaw = inv as unknown as {
          subscription?: string | null;
          amount_paid?: number;
          currency?: string;
          billing_reason?: string;
          status?: string;
        };
        console.log('[Stripe/webhook] invoice.payment_succeeded', {
          customerId: inv.customer as string,
          livemode: event.livemode,
        });
        logStripeOps('invoice_payment_succeeded', {
          stripeEventId: event.id,
          eventType: event.type,
          livemode: event.livemode,
          customerId: inv.customer as string,
          subscriptionId: invRaw.subscription ?? null,
          amountPaid: invRaw.amount_paid ?? null,
          currency: invRaw.currency ?? null,
          billingReason: invRaw.billing_reason ?? null,
          invoiceStatus: invRaw.status ?? null,
          opsAction: 'payment_recovered_or_renewed',
        });
        break;
      }

      case 'invoice.payment_failed': {
        const inv = event.data.object as Stripe.Invoice;
        const invFailedRaw = inv as unknown as {
          attempt_count?: number;
          next_payment_attempt?: number | null;
          subscription?: string | null;
          amount_due?: number;
          currency?: string;
          status?: string;
          hosted_invoice_url?: string | null;
          payment_intent?: { status?: string } | string | null;
        };
        const attemptCount = invFailedRaw.attempt_count ?? null;
        const nextAttempt = invFailedRaw.next_payment_attempt ?? null;
        const piStatus = typeof invFailedRaw.payment_intent === 'object' && invFailedRaw.payment_intent !== null
          ? invFailedRaw.payment_intent.status ?? null
          : null;

        console.warn('[Stripe/webhook] invoice.payment_failed', {
          customerId: inv.customer as string,
          attemptCount,
          nextPaymentAttempt: nextAttempt !== null ? new Date(nextAttempt * 1000).toISOString() : null,
          willRetry: nextAttempt !== null,
          livemode: event.livemode,
        });

        logStripeOps('invoice_payment_failed', {
          stripeEventId: event.id,
          eventType: event.type,
          livemode: event.livemode,
          customerId: inv.customer as string,
          subscriptionId: invFailedRaw.subscription ?? null,
          invoiceStatus: invFailedRaw.status ?? null,
          attemptCount,
          nextPaymentAttempt: nextAttempt !== null ? new Date(nextAttempt * 1000).toISOString() : null,
          willRetry: nextAttempt !== null,
          amountDue: invFailedRaw.amount_due ?? null,
          currency: invFailedRaw.currency ?? null,
          hostedInvoiceUrlPresent: invFailedRaw.hosted_invoice_url != null,
          paymentIntentStatus: piStatus,
          opsAction: 'monitor_retry',
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
