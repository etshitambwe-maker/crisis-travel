import Stripe from 'stripe';

// Singleton serveur (jamais exposé côté client)
let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!_stripe) {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error('STRIPE_SECRET_KEY manquant');
    }
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2026-05-27.dahlia',
    });
  }
  return _stripe;
}

// IDs des produits Stripe — à créer dans le dashboard Stripe
export const STRIPE_PRICES = {
  premiumMonthly: process.env.STRIPE_PRICE_PREMIUM_MONTHLY ?? '',
  premiumAnnual: process.env.STRIPE_PRICE_PREMIUM_ANNUAL ?? '',
} as const;

export async function createCheckoutSession(
  userId: string,
  userEmail: string,
  priceId: string,
  successUrl: string,
  cancelUrl: string
): Promise<Stripe.Checkout.Session> {
  const stripe = getStripe();

  // Vérifier si le client Stripe existe déjà
  const existingCustomers = await stripe.customers.list({
    email: userEmail,
    limit: 1,
  });

  let customerId: string;
  if (existingCustomers.data.length > 0) {
    customerId = existingCustomers.data[0].id;
  } else {
    const customer = await stripe.customers.create({
      email: userEmail,
      metadata: { supabase_user_id: userId },
    });
    customerId = customer.id;
  }

  return stripe.checkout.sessions.create({
    customer: customerId,
    payment_method_types: ['card'],
    line_items: [{ price: priceId, quantity: 1 }],
    mode: 'subscription',
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: { supabase_user_id: userId },
    subscription_data: {
      metadata: { supabase_user_id: userId },
    },
    allow_promotion_codes: true,
    billing_address_collection: 'auto',
  });
}

export async function createPortalSession(
  customerId: string,
  returnUrl: string
): Promise<Stripe.BillingPortal.Session> {
  const stripe = getStripe();
  return stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });
}

export function constructWebhookEvent(
  payload: string | Buffer,
  sig: string,
  secret: string
): Stripe.Event {
  const stripe = getStripe();
  return stripe.webhooks.constructEvent(payload, sig, secret);
}
