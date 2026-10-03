import type Stripe from "stripe";
import { prisma } from "@/lib/db";
import { stripe } from "@/lib/stripe";
import { planFromPriceId } from "@/lib/plans";
import { notify } from "@/lib/loans";

async function syncSubscription(sub: Stripe.Subscription) {
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  const user = await prisma.user.findUnique({ where: { stripeCustomerId: customerId } });
  if (!user) return;
  const item = sub.items.data[0];
  const plan = item ? planFromPriceId(item.price.id) : null;
  const alive = ["active", "trialing", "past_due"].includes(sub.status);

  if (alive && plan) {
    await prisma.user.update({
      where: { id: user.id },
      data: { plan, stripeSubscriptionId: sub.id, planExpiresAt: new Date(item.current_period_end * 1000), cancelAtPeriodEnd: sub.cancel_at_period_end || !!sub.cancel_at },
    });
  } else if (user.stripeSubscriptionId === sub.id) {
    await prisma.user.update({ where: { id: user.id }, data: { plan: "FREE", planExpiresAt: null, stripeSubscriptionId: null, cancelAtPeriodEnd: false } });
    await notify(user.id, "Abonnement terminé", "Ton abonnement est terminé : tu repasses à l'offre gratuite.", "/abonnement");
  }
}

async function recordPayment(invoice: Stripe.Invoice) {
  if (!invoice.id || !invoice.amount_paid) return;
  const customerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
  const user = customerId ? await prisma.user.findUnique({ where: { stripeCustomerId: customerId } }) : null;
  const priceId = invoice.lines.data[0]?.pricing?.price_details?.price;
  const plan = (typeof priceId === "string" && planFromPriceId(priceId)) || user?.plan || "MONTHLY";
  await prisma.payment.upsert({
    where: { providerRef: invoice.id },
    update: {},
    create: { userId: user?.id, amountCents: invoice.amount_paid, currency: invoice.currency, plan, provider: "stripe", providerRef: invoice.id },
  });
}

export async function POST(req: Request) {
  if (!stripe || !process.env.STRIPE_WEBHOOK_SECRET) return new Response("Stripe non configuré", { status: 503 });
  const sig = req.headers.get("stripe-signature");
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(await req.text(), sig ?? "", process.env.STRIPE_WEBHOOK_SECRET);
  } catch {
    return new Response("Signature invalide", { status: 400 });
  }

  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      await syncSubscription(event.data.object);
      break;
    case "invoice.paid":
      await recordPayment(event.data.object);
      break;
  }
  return new Response("ok");
}
