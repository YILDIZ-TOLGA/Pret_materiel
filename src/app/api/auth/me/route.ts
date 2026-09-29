import { prisma } from "@/lib/db";
import { publicUser } from "@/lib/auth";
import { json, withUser } from "@/lib/api";
import { PLANS, effectivePlan } from "@/lib/plans";

export const GET = withUser(async (user) => {
  const plan = effectivePlan(user);
  const [activeLoans, unread] = await Promise.all([
    prisma.loan.count({ where: { lenderId: user.id, status: "ACTIVE" } }),
    prisma.notification.count({ where: { userId: user.id, read: false } }),
  ]);
  return json({ user: publicUser(user), plan: PLANS[plan], activeLoans, unread });
});
