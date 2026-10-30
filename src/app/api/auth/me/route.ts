import { prisma } from "@/lib/db";
import { publicUser } from "@/lib/auth";
import { json, withUser } from "@/lib/api";
import { openWithdrawal } from "@/lib/billing";
import { termsUpToDate } from "@/lib/legal";
import { limitsFor } from "@/lib/sitemode";

export const GET = withUser(async (user) => {
  // Dernière activité, utilisée pour la purge des comptes inactifs (applis mobiles comprises)
  if (!user.lastLoginAt || Date.now() - user.lastLoginAt.getTime() > 86400000) {
    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date(), inactivityNoticeAt: null } });
  }
  const limits = await limitsFor(user);
  const [activeLoans, overdueLoans, unread] = await Promise.all([
    prisma.loan.count({ where: { lenderId: user.id, status: "ACTIVE" } }),
    prisma.loan.count({ where: { lenderId: user.id, status: "ACTIVE", dueAt: { lt: new Date() } } }),
    prisma.notification.count({ where: { userId: user.id, read: false } }),
  ]);
  // date limite de rétractation, tant qu'elle est ouverte (bouton « Se rétracter du contrat ici » de la page Offre)
  const withdrawalUntil = openWithdrawal(user)?.toISOString() ?? null;
  // En phase de test, un compte sans abonnement affiche les limites larges de la phase de test
  const beta = limits.mode === "BETA" && limits.plan.id === "FREE";
  const plan = { ...limits.plan, maxLoans: limits.maxLoans, maxNewLoansPerDay: limits.maxNewLoansPerDay, ...(beta ? { name: "Phase de test" } : {}) };
  const site = { mode: limits.mode, paidFrom: limits.paidFrom };
  // conditions acceptées dans une version trop ancienne : à accepter de nouveau pour enregistrer des prêts
  return json({ user: publicUser(user), plan, activeLoans, overdueLoans, unread, withdrawalUntil, site, termsUpToDate: termsUpToDate(user) });
});
