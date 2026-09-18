import Stripe from "stripe";

let cachedClient: Stripe | null = null;

export function getStripeClient(): Stripe | null {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) return null;
  if (!cachedClient) {
    cachedClient = new Stripe(secretKey, { apiVersion: "2024-06-20" });
  }
  return cachedClient;
}

export interface CreateCheckoutResult {
  url: string | null;
  error?: string;
}

export async function createProCheckoutSession(
  userId: string,
  userEmail: string,
  appUrl: string
): Promise<CreateCheckoutResult> {
  const stripe = getStripeClient();
  const priceId = process.env.STRIPE_PRICE_ID_PRO;

  if (!stripe || !priceId) {
    return {
      url: null,
      error:
        "Pagamenti non configurati: STRIPE_SECRET_KEY o STRIPE_PRICE_ID_PRO mancanti in .env.",
    };
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer_email: userEmail,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${appUrl}/dashboard?upgraded=1`,
    cancel_url: `${appUrl}/dashboard?upgrade_cancelled=1`,
    client_reference_id: userId,
    metadata: { userId },
  });

  return { url: session.url };
}

export interface CreatePortalResult {
  url: string | null;
  error?: string;
}

/**
 * Portale Stripe per gestire l'abbonamento gia' attivo (cambio piano,
 * aggiornamento metodo di pagamento, cancellazione) — brief sezione 38.
 */
export async function createBillingPortalSession(
  stripeCustomerId: string,
  appUrl: string
): Promise<CreatePortalResult> {
  const stripe = getStripeClient();
  if (!stripe) {
    return { url: null, error: "Pagamenti non configurati: STRIPE_SECRET_KEY mancante in .env." };
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: stripeCustomerId,
    return_url: `${appUrl}/dashboard/settings`,
  });

  return { url: session.url };
}

/**
 * Cancella subito l'abbonamento su Stripe (usata quando un admin elimina
 * un account: senza questo, l'abbonamento resterebbe attivo e continuerebbe
 * ad addebitare un cliente il cui account non esiste piu' nel nostro DB).
 * Se Stripe non e' configurato o l'abbonamento non esiste piu' lato Stripe,
 * non blocchiamo l'eliminazione dell'account: logghiamo e proseguiamo.
 */
export async function cancelSubscriptionImmediately(stripeSubscriptionId: string): Promise<void> {
  const stripe = getStripeClient();
  if (!stripe) return;
  try {
    await stripe.subscriptions.cancel(stripeSubscriptionId);
  } catch (err) {
    console.error(
      `[stripe] impossibile cancellare l'abbonamento ${stripeSubscriptionId} durante l'eliminazione account:`,
      err instanceof Error ? err.message : err
    );
  }
}
