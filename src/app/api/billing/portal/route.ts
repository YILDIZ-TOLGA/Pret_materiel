import { stripe } from "@/lib/stripe";
import { error, json, withUser } from "@/lib/api";

/** Portail Stripe : changer de carte, d'offre, télécharger les factures, résilier. */
export const POST = withUser(async (user, req) => {
  if (!stripe || !user.stripeCustomerId) return error("Aucun abonnement à gérer", 400);
  const appUrl = process.env.APP_URL || new URL(req.url).origin;
  const portal = await stripe.billingPortal.sessions.create({ customer: user.stripeCustomerId, return_url: `${appUrl}/abonnement` });
  return json({ url: portal.url });
});
