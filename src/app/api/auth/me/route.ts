import { prisma } from "@/lib/db";
import { publicUser } from "@/lib/auth";
import { json, withUser } from "@/lib/api";
import { PLANS, effectivePlan } from "@/lib/plans";

export const GET = withUser(async (user) => {
  // Dernière activité, utilisée pour la purge des comptes inactifs (applis mobiles comprises)
  if (!user.lastLoginAt || Date.now() - user.lastLoginAt.getTime() > 86400000) {
    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date(), inactivityNoticeAt: null } });
  }
  const plan = effectivePlan(user);
  const [activeLoans, overdueLoans, unread] = await Promise.all([
    prisma.loan.count({ where: { lenderId: user.id, status: "ACTIVE" } }),
    prisma.loan.count({ where: { lenderId: user.id, status: "ACTIVE", dueAt: { lt: new Date() } } }),
    prisma.notification.count({ where: { userId: user.id, read: false } }),
  ]);
  return json({ user: publicUser(user), plan: PLANS[plan], activeLoans, overdueLoans, unread });
});
