import { prisma } from "@/lib/db";
import { stripe } from "@/lib/stripe";
import { error, json, withUser } from "@/lib/api";
import { LEGAL } from "@/lib/legal";
import { fmtDate, notify } from "@/lib/loans";
import { sendMail } from "@/lib/mail";
import { PLANS, effectivePlan } from "@/lib/plans";

/**
 * Résiliation en ligne (art. L215-1-1 et D215-1 s. du Code de la consommation) :
 * l'abonnement reste actif jusqu'à la fin de la période payée, puis n'est pas renouvelé.
 * Une confirmation est envoyée par e-mail (support durable).
 */
export const POST = withUser(async (user, req) => {
  const plan = effectivePlan(user);
  if (plan === "FREE") return error("Aucun abonnement en cours", 400);
  if (user.cancelAtPeriodEnd) return error("Ton abonnement est déjà résilié", 400);

  let endsAt = user.planExpiresAt;
  if (user.stripeSubscriptionId) {
    if (!stripe) return error("Paiement non configuré", 503);
    const sub = await stripe.subscriptions.update(user.stripeSubscriptionId, { cancel_at_period_end: true });
    const end = sub.items.data[0]?.current_period_end;
    if (end) endsAt = new Date(end * 1000);
  }
  await prisma.user.update({ where: { id: user.id }, data: { cancelAtPeriodEnd: true, ...(endsAt ? { planExpiresAt: endsAt } : {}) } });

  const appUrl = process.env.APP_URL || new URL(req.url).origin;
  const until = endsAt ? fmtDate(endsAt) : null;
  await sendMail({
    to: user.email,
    kind: "subscription_canceled",
    subject: "Confirmation de résiliation de ton abonnement",
    title: `Bonjour ${user.name},`,
    paragraphs: [
      `Nous confirmons la résiliation de ton abonnement ${PLANS[plan].name} (${PLANS[plan].priceLabel}), enregistrée le ${fmtDate(new Date())}.`,
      until
        ? `La résiliation prend effet le ${until}. D'ici là, tu gardes l'accès à toutes les fonctions de ton offre. Aucun prélèvement ne sera plus effectué.`
        : "Aucun prélèvement ne sera plus effectué.",
      `Ensuite, ton compte repasse à l'offre gratuite (${PLANS.FREE.maxLoans} prêt${PLANS.FREE.maxLoans > 1 ? "s" : ""} en cours) : tes prêts et ton historique sont conservés.`,
      `Une question ou un problème ? Écris-nous à ${LEGAL.editor.email}.`,
    ],
    cta: { label: "Voir mon offre", url: `${appUrl}/abonnement` },
  });
  await notify(user.id, "Abonnement résilié", until ? `Ton abonnement reste actif jusqu'au ${until}, puis ne sera pas renouvelé.` : "Ton abonnement ne sera pas renouvelé.", "/abonnement");
  return json({ ok: true, endsAt });
});
