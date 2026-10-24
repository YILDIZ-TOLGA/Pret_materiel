import { z } from "zod";
import { prisma } from "@/lib/db";
import { stripe, demoBilling } from "@/lib/stripe";
import { error, json, withUser, zodError } from "@/lib/api";
import { PAID_PLANS, PLANS, isProPlan, stripePriceId } from "@/lib/plans";
import { TERMS_VERSION } from "@/lib/legal";

const schema = z.object({
  plan: z.enum(PAID_PLANS),
  // CGV acceptées et demande expresse d'exécution immédiate (art. L221-25 du Code de la consommation)
  acceptSalesTerms: z.literal(true, { message: "Tu dois accepter les conditions générales de vente" }),
});

export const POST = withUser(async (user, req) => {
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return zodError(parsed.error);
  const plan = parsed.data.plan;
  const appUrl = process.env.APP_URL || new URL(req.url).origin;
  await prisma.user.update({ where: { id: user.id }, data: { salesTermsAcceptedAt: new Date() } });

  if (demoBilling) {
    const info = PLANS[plan];
    const expires = new Date();
    if (info.interval === "month") expires.setMonth(expires.getMonth() + 1);
    else expires.setFullYear(expires.getFullYear() + 1);
    await prisma.$transaction([
      prisma.user.update({ where: { id: user.id }, data: { plan, planExpiresAt: expires, cancelAtPeriodEnd: false } }),
      prisma.payment.create({ data: { userId: user.id, plan, amountCents: info.priceCents, provider: "demo", providerRef: `demo_${Date.now()}_${user.id}` } }),
    ]);
    return json({ url: `${appUrl}/abonnement?success=1` });
  }

  const price = stripePriceId(plan);
  if (!stripe || !price) return error("Paiement non configuré", 503);

  let customerId = user.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe.customers.create({ email: user.email, name: user.name, metadata: { userId: user.id } });
    customerId = customer.id;
    await prisma.user.update({ where: { id: user.id }, data: { stripeCustomerId: customerId } });
  }

  // Déjà abonné : on passe par le portail pour changer d'offre (prorata géré par Stripe).
  if (user.stripeSubscriptionId) {
    const portal = await stripe.billingPortal.sessions.create({ customer: customerId, return_url: `${appUrl}/abonnement` });
    return json({ url: portal.url });
  }

  // Pas de payment_method_types : Stripe affiche automatiquement les moyens activés
  // dans le dashboard (carte, PayPal, Apple Pay, Google Pay, SEPA, Link…).
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    client_reference_id: user.id,
    line_items: [{ price, quantity: 1 }],
    subscription_data: { metadata: { userId: user.id, plan, salesTermsVersion: TERMS_VERSION, immediateStartRequested: "true" } },
    allow_promotion_codes: true,
    // Offres Pro : nom, adresse et n° de TVA de la structure, pour une facture à son nom
    ...(isProPlan(plan) && {
      billing_address_collection: "required" as const,
      tax_id_collection: { enabled: true },
      customer_update: { name: "auto" as const, address: "auto" as const },
    }),
    success_url: `${appUrl}/abonnement?success=1`,
    cancel_url: `${appUrl}/abonnement?canceled=1`,
  });
  return json({ url: session.url });
});
