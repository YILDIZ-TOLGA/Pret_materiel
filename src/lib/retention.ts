import { prisma } from "./db";
import { LEGAL, RETENTION } from "./legal";
import { fmtDate } from "./loans";
import { sendMail } from "./mail";
import { PLANS } from "./plans";

const DAY = 86400000;
const appUrl = () => process.env.APP_URL || "http://localhost:3000";
const monthsAgo = (n: number) => { const d = new Date(); d.setMonth(d.getMonth() - n); return d; };
const yearsAgo = (n: number) => { const d = new Date(); d.setFullYear(d.getFullYear() - n); return d; };

/**
 * Loi Chatel (art. L215-1 C. conso.) : pour un abonnement annuel reconduit tacitement, prévenir
 * par un e-mail dédié entre 3 mois et 1 mois avant l'échéance. On vise 35 à 75 jours avant.
 */
async function sendRenewalNotices() {
  const now = Date.now();
  const users = await prisma.user.findMany({
    where: {
      plan: { in: ["YEARLY_10", "YEARLY_20"] },
      stripeSubscriptionId: { not: null },
      cancelAtPeriodEnd: false,
      planExpiresAt: { gt: new Date(now + 35 * DAY), lte: new Date(now + 75 * DAY) },
    },
  });
  let sent = 0;
  for (const u of users) {
    // un seul préavis par échéance
    if (u.renewalNoticeAt && u.renewalNoticeAt.getTime() > u.planExpiresAt!.getTime() - 90 * DAY) continue;
    const plan = PLANS[u.plan];
    await sendMail({
      to: u.email,
      kind: "renewal_notice",
      subject: `Ton abonnement ${plan.name} sera renouvelé le ${fmtDate(u.planExpiresAt!)}`,
      title: `Bonjour ${u.name},`,
      paragraphs: [
        `Ton abonnement ${plan.name} (${plan.priceLabel}) arrive à échéance le ${fmtDate(u.planExpiresAt!)}. Sans action de ta part, il sera reconduit pour un an et ${plan.priceLabel.replace(" / an", "")} seront prélevés à cette date.`,
        `DATE LIMITE POUR NE PAS RECONDUIRE TON ABONNEMENT : ${fmtDate(new Date(u.planExpiresAt!.getTime() - DAY))}.`,
        "Tu peux résilier à tout moment en quelques clics depuis la page Offre de l'application. L'abonnement restera actif jusqu'à l'échéance, puis ton compte repassera à l'offre gratuite sans perdre tes prêts.",
        `Question ? ${LEGAL.editor.email}`,
      ],
      cta: { label: "Gérer mon abonnement", url: `${appUrl()}/abonnement` },
    });
    await prisma.user.update({ where: { id: u.id }, data: { renewalNoticeAt: new Date() } });
    sent++;
  }
  return sent;
}

/** Comptes inactifs : préavis 30 jours avant la suppression, puis suppression. Jamais un compte payant. */
async function purgeInactiveAccounts() {
  const cutoff = yearsAgo(RETENTION.inactiveAccountYears);
  const warnCutoff = new Date(cutoff.getTime() + 30 * DAY);
  const unpaid = { OR: [{ plan: "FREE" as const }, { planExpiresAt: { lt: new Date() } }], role: "USER" as const };
  const inactiveSince = (d: Date) => ({ OR: [{ lastLoginAt: { lt: d } }, { lastLoginAt: null, createdAt: { lt: d } }] });

  const toWarn = await prisma.user.findMany({
    where: { AND: [unpaid, inactiveSince(warnCutoff)], inactivityNoticeAt: null },
    take: 200,
  });
  for (const u of toWarn) {
    await sendMail({
      to: u.email,
      kind: "inactivity_notice",
      subject: "Ton compte Prêt Matériel va être supprimé",
      title: `Bonjour ${u.name},`,
      paragraphs: [
        `Tu ne t'es pas connecté à Prêt Matériel depuis près de ${RETENTION.inactiveAccountYears} ans. Pour ne pas conserver tes données plus longtemps que nécessaire, ton compte et tes prêts seront supprimés dans 30 jours.`,
        "Pour garder ton compte, il suffit de te connecter avant cette date.",
      ],
      cta: { label: "Me connecter", url: `${appUrl()}/connexion` },
    });
    await prisma.user.update({ where: { id: u.id }, data: { inactivityNoticeAt: new Date() } });
  }

  const { count } = await prisma.user.deleteMany({
    where: {
      AND: [unpaid, inactiveSince(cutoff)],
      inactivityNoticeAt: { lt: new Date(Date.now() - 30 * DAY) },
    },
  });
  return { warned: toWarn.length, deleted: count };
}

/** Applique les durées de conservation annoncées dans la politique de confidentialité. */
export async function runRetention() {
  const renewalNotices = await sendRenewalNotices();
  const accounts = await purgeInactiveAccounts();
  const now = new Date();
  const [loans, pageViews, emailLogs, notifications, sessions, authTokens] = await Promise.all([
    prisma.loan.deleteMany({ where: { status: "RETURNED", returnedAt: { lt: yearsAgo(RETENTION.returnedLoanYears) } } }),
    prisma.pageView.deleteMany({ where: { createdAt: { lt: monthsAgo(RETENTION.pageViewMonths) } } }),
    prisma.emailLog.deleteMany({ where: { createdAt: { lt: monthsAgo(RETENTION.emailLogMonths) } } }),
    prisma.notification.deleteMany({ where: { read: true, createdAt: { lt: monthsAgo(RETENTION.readNotificationMonths) } } }),
    prisma.session.deleteMany({ where: { expiresAt: { lt: now } } }),
    prisma.authToken.deleteMany({ where: { expiresAt: { lt: now } } }),
  ]);
  return {
    renewalNotices, ...accounts, loans: loans.count, pageViews: pageViews.count, emailLogs: emailLogs.count, notifications: notifications.count,
    sessions: sessions.count, authTokens: authTokens.count,
  };
}
