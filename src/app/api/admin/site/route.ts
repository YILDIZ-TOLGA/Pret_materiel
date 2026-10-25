import { z } from "zod";
import { prisma } from "@/lib/db";
import { error, json, withAdmin, zodError } from "@/lib/api";
import { PAID_PLANS, effectivePlan, stripePriceId } from "@/lib/plans";
import { BETA_LIMITS, PAID_NOTICE_DAYS, earliestPaidDay, lendersOverFreeCap, parisMidnight, siteSettings, siteState } from "@/lib/sitemode";
import { demoBilling, stripe } from "@/lib/stripe";

/** État du mode du site, avec ce qu'il faut savoir avant de changer. */
async function state() {
  const settings = await siteSettings();
  const { mode, paidFrom } = await siteState();
  const [users, verified, paying, noticed, updatedBy, overFreeCap] = await Promise.all([
    prisma.user.count({ where: { disabled: false } }),
    prisma.user.count({ where: { disabled: false, emailVerifiedAt: { not: null } } }),
    prisma.user.findMany({ where: { plan: { not: "FREE" } }, select: { plan: true, planExpiresAt: true, stripeSubscriptionId: true } }),
    paidFrom ? prisma.user.count({ where: { paidModeNoticeFor: paidFrom } }) : Promise.resolve(0),
    settings.updatedById ? prisma.user.findUnique({ where: { id: settings.updatedById }, select: { name: true, email: true } }) : Promise.resolve(null),
    lendersOverFreeCap(),
  ]);
  // Paiement prêt : clés Stripe et les 6 prix, ou paiement de démo (local uniquement)
  const paymentReady = demoBilling || (!!stripe && PAID_PLANS.every((p) => !!stripePriceId(p)));
  return {
    mode, paidFrom, paidSince: settings.paidSince, updatedAt: settings.updatedAt, updatedBy,
    earliestPaidDay: earliestPaidDay(), noticeDays: PAID_NOTICE_DAYS, betaLimits: BETA_LIMITS, paymentReady,
    stats: {
      users, verified, noticed, overFreeCap: overFreeCap.length,
      paying: paying.filter((u) => effectivePlan(u) !== "FREE").length,
      stripeSubscriptions: paying.filter((u) => u.stripeSubscriptionId && effectivePlan(u) !== "FREE").length,
    },
  };
}

export const GET = withAdmin(async () => json(await state()));

const schema = z.discriminatedUnion("action", [
  // programmer le passage au mode payant (au moins 30 jours plus tard)
  z.object({ action: z.literal("schedule"), day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide") }),
  // annuler un passage programmé
  z.object({ action: z.literal("cancel") }),
  // repasser en phase de test : immédiat, puisque c'est plus favorable aux utilisateurs
  z.object({ action: z.literal("beta") }),
]);

export const POST = withAdmin(async (admin, req) => {
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return zodError(parsed.error);
  const body = parsed.data;
  const current = await siteState();

  if (body.action === "schedule") {
    if (current.mode === "PAID") return error("Le site est déjà en mode payant.");
    if (body.day < earliestPaidDay()) {
      return error(`Le passage au mode payant doit être annoncé au moins ${PAID_NOTICE_DAYS} jours à l'avance (CGU, article 10) : choisis le ${earliestPaidDay()} ou plus tard.`);
    }
    const s = await state();
    if (!s.paymentReady) return error("Le paiement n'est pas configuré (clés Stripe et prix des 6 offres) : les utilisateurs ne pourraient pas s'abonner.", 409);
    await prisma.siteSetting.update({ where: { id: 1 }, data: { paidFrom: parisMidnight(body.day), updatedById: admin.id } });
  } else if (body.action === "cancel") {
    if (current.mode === "PAID") return error("Le site est déjà en mode payant : utilise « Repasser en site testeur ».");
    await prisma.siteSetting.update({ where: { id: 1 }, data: { paidFrom: null, updatedById: admin.id } });
  } else {
    await prisma.siteSetting.update({ where: { id: 1 }, data: { mode: "BETA", paidFrom: null, updatedById: admin.id } });
  }
  return json(await state());
});
