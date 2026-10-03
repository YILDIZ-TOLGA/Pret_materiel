import { prisma } from "@/lib/db";
import { publicUser } from "@/lib/auth";
import { withUser } from "@/lib/api";

/** Droits d'accès et à la portabilité (art. 15 et 20 RGPD) : toutes les données du compte en JSON. */
export const GET = withUser(async (user) => {
  const [loansGiven, loansReceived, notifications, payments] = await Promise.all([
    prisma.loan.findMany({ where: { lenderId: user.id }, include: { repayments: true }, orderBy: { createdAt: "asc" } }),
    prisma.loan.findMany({
      where: { borrowerId: user.id },
      // les notes privées du prêteur ne concernent que lui
      select: { id: true, kind: true, item: true, amountCents: true, repaidCents: true, currency: true, description: true, lentAt: true, dueAt: true, status: true, returnedAt: true, lender: { select: { name: true, email: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: "asc" } }),
    prisma.payment.findMany({ where: { userId: user.id }, orderBy: { createdAt: "asc" } }),
  ]);
  const { stripeCustomerId: _c, stripeSubscriptionId: _s, ...account } = publicUser(user);
  const data = { exportedAt: new Date().toISOString(), account, loansGiven, loansReceived, notifications, payments };
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="pret-materiel-mes-donnees-${new Date().toISOString().slice(0, 10)}.json"`,
      "Cache-Control": "no-store",
    },
  });
});
