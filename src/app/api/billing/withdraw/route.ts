import { prisma } from "@/lib/db";
import { error, json, withUser } from "@/lib/api";
import { openWithdrawal, sendWithdrawalReceipt } from "@/lib/billing";
import { notify } from "@/lib/loans";
import { stripe } from "@/lib/stripe";

/**
 * Fonction de rétractation en ligne (directive 2011/83/UE modifiée par la directive 2023/2673, art. 11 bis ;
 * art. L221-18 et suivants C. conso.) : pendant 14 jours après la souscription, le client se rétracte en deux
 * clics depuis la page Offre. L'abonnement s'arrête tout de suite et tout ce qui a été payé depuis la
 * souscription est remboursé (les CGV, art. 13, promettent un remboursement intégral). Un accusé de réception
 * daté part par e-mail.
 */
export const POST = withUser(async (user) => {
  const deadline = openWithdrawal(user);
  if (!deadline || !user.subscriptionStartedAt) {
    return error("Le délai de rétractation de 14 jours est dépassé, ou tu n'as pas d'abonnement en cours. Tu peux toujours résilier : l'abonnement s'arrêtera à la fin de la période payée.");
  }
  const startedAt = user.subscriptionStartedAt;
  const plan = user.plan;
  const at = new Date();

  // Une seule rétractation, même en cas de double clic : on « réserve » la demande avant tout appel à Stripe
  const { count } = await prisma.user.updateMany({ where: { id: user.id, subscriptionStartedAt: startedAt }, data: { subscriptionStartedAt: null } });
  if (!count) return error("Ta rétractation est déjà en cours de traitement.", 409);

  let refundedCents = 0;
  let refundOk = true;
  if (user.stripeCustomerId && stripe) {
    if (user.stripeSubscriptionId) {
      try { await stripe.subscriptions.cancel(user.stripeSubscriptionId); }
      catch (e) {
        // déjà annulé côté Stripe : rien à faire. Sinon on rend la main au client pour qu'il réessaie.
        if ((e as { code?: string }).code !== "resource_missing") {
          console.error("Rétractation : annulation Stripe impossible", e);
          await prisma.user.update({ where: { id: user.id }, data: { subscriptionStartedAt: startedAt } });
          return error("Impossible d'arrêter l'abonnement pour le moment, réessaie dans quelques minutes.", 502);
        }
      }
    }
    try {
      const since = Math.floor(startedAt.getTime() / 1000) - 3600;
      const charges = await stripe.charges.list({ customer: user.stripeCustomerId, created: { gte: since }, limit: 100 });
      for (const charge of charges.data) {
        const rest = charge.amount - charge.amount_refunded;
        if (charge.status !== "succeeded" || rest <= 0) continue;
        const refund = await stripe.refunds.create(
          { charge: charge.id, amount: rest, reason: "requested_by_customer", metadata: { userId: user.id, motif: "rétractation" } },
          { idempotencyKey: `retractation-${charge.id}` },
        );
        refundedCents += refund.amount;
        // remboursement enregistré en négatif : les revenus de l'admin restent justes
        await prisma.payment.create({ data: { userId: user.id, plan, amountCents: -refund.amount, currency: refund.currency, provider: "stripe", providerRef: refund.id } });
      }
    } catch (e) {
      refundOk = false;
      console.error("Rétractation : remboursement Stripe à faire à la main", user.id, e);
    }
  } else if (user.stripeCustomerId && !stripe) {
    refundOk = false;
    console.error("Rétractation : Stripe non configuré, remboursement à faire à la main", user.id);
  } else {
    // Paiement démo (local, sans Stripe) : on annule les paiements de démo depuis la souscription
    const paid = await prisma.payment.aggregate({ _sum: { amountCents: true }, where: { userId: user.id, createdAt: { gte: new Date(startedAt.getTime() - 3600000) } } });
    refundedCents = Math.max(0, paid._sum.amountCents ?? 0);
    if (refundedCents) {
      await prisma.payment.create({ data: { userId: user.id, plan, amountCents: -refundedCents, provider: "demo", providerRef: `demo_retractation_${Date.now()}_${user.id}` } });
    }
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { plan: "FREE", planExpiresAt: null, stripeSubscriptionId: null, cancelAtPeriodEnd: false },
  });
  await sendWithdrawalReceipt(user, plan, startedAt, at, refundOk ? refundedCents : 0);
  await notify(user.id, "Rétractation enregistrée", "Ton abonnement est arrêté et tu vas être remboursé. Un accusé de réception t'a été envoyé par e-mail.", "/abonnement");
  if (!refundOk) {
    // Le remboursement reste dû sous 14 jours : on prévient les administrateurs pour qu'ils le fassent à la main
    const admins = await prisma.user.findMany({ where: { role: "ADMIN" }, select: { id: true } });
    await Promise.all(admins.map((a) => notify(a.id, "Remboursement à faire", `Rétractation de ${user.email} : le remboursement automatique a échoué, à faire depuis le tableau de bord Stripe sous 14 jours.`, "/admin/utilisateurs")));
  }
  return json({ ok: true, refundedCents, refundOk });
});
