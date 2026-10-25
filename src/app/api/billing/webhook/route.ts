import type Stripe from "stripe";
import { prisma } from "@/lib/db";
import { stripe } from "@/lib/stripe";
import { LEGAL } from "@/lib/legal";
import { notify } from "@/lib/loans";
import { sendMail } from "@/lib/mail";
import { PLANS, planFromPriceId } from "@/lib/plans";

async function syncSubscription(sub: Stripe.Subscription) {
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  const user = await prisma.user.findUnique({ where: { stripeCustomerId: customerId } });
  if (!user) return;
  const item = sub.items.data[0];
  const plan = item ? planFromPriceId(item.price.id) : null;
  const alive = ["active", "trialing", "past_due"].includes(sub.status);

  if (alive && !plan) {
    // Prix inconnu (ancien tarif, variable STRIPE_PRICE_* manquante) : ne surtout pas repasser le client en
    // gratuit alors qu'il paie. On garde son offre et on met juste à jour la période.
    console.error(`Webhook Stripe : prix ${item?.price.id} inconnu pour l'abonnement ${sub.id}, offre ${user.plan} conservée`);
    if (item) {
      await prisma.user.update({
        where: { id: user.id },
        data: { stripeSubscriptionId: sub.id, planExpiresAt: new Date(item.current_period_end * 1000), cancelAtPeriodEnd: sub.cancel_at_period_end || !!sub.cancel_at },
      });
    }
  } else if (alive && plan) {
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
  const plan = (typeof priceId === "string" && planFromPriceId(priceId)) || user?.plan || "PERSO_MONTHLY";
  await prisma.payment.upsert({
    where: { providerRef: invoice.id },
    update: {},
    create: { userId: user?.id, amountCents: invoice.amount_paid, currency: invoice.currency, plan, provider: "stripe", providerRef: invoice.id },
  });
}

/** Prélèvement refusé : Stripe retente plusieurs fois ; on prévient le client pour qu'il mette à jour sa carte. */
async function paymentFailed(invoice: Stripe.Invoice) {
  const customerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
  const user = customerId ? await prisma.user.findUnique({ where: { stripeCustomerId: customerId } }) : null;
  if (!user) return;
  const appUrl = process.env.APP_URL || "http://localhost:3000";
  await notify(user.id, "Paiement refusé", "Le prélèvement de ton abonnement n'a pas abouti. Mets à jour ton moyen de paiement pour garder ton offre.", "/abonnement");
  await sendMail({
    to: user.email,
    kind: "payment_failed",
    subject: "Le paiement de ton abonnement n'a pas abouti",
    title: `Bonjour ${user.name},`,
    paragraphs: [
      `Le prélèvement de ton abonnement ${PLANS[user.plan].name} n'a pas abouti. Notre prestataire de paiement va réessayer dans les prochains jours.`,
      "Pour garder ton offre, vérifie ou mets à jour ton moyen de paiement. Sans paiement, ton compte repassera à l'offre gratuite ; tes prêts sont conservés.",
      `Une question ? Écris-nous à ${LEGAL.editor.email}.`,
    ],
    cta: { label: "Mettre à jour mon moyen de paiement", url: `${appUrl}/abonnement` },
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
    case "invoice.payment_failed":
      await paymentFailed(event.data.object);
      break;
  }
  return new Response("ok");
}
