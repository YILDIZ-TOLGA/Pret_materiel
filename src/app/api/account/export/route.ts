import { prisma } from "@/lib/db";
import { publicUser } from "@/lib/auth";
import { withUser } from "@/lib/api";

/** Droits d'accès et à la portabilité (art. 15 et 20 RGPD) : toutes les données du compte en JSON. */
export const GET = withUser(async (user) => {
  const [loansGiven, loansReceived, notifications, payments, sessions, emailsSent] = await Promise.all([
    // prêts enregistrés, avec leurs documents signés (contenu, tracé, éléments de preuve)
    prisma.loan.findMany({ where: { lenderId: user.id }, include: { repayments: true, receipts: true }, orderBy: { createdAt: "asc" } }),
    prisma.loan.findMany({
      where: { borrowerId: user.id },
      // les notes privées du prêteur ne concernent que lui
      select: {
        id: true, kind: true, item: true, amountCents: true, repaidCents: true, currency: true, description: true, lentAt: true, dueAt: true, status: true, returnedAt: true,
        ackStatus: true, ackAt: true, ackRefusalReason: true, lender: { select: { name: true, email: true, organization: true } },
        // documents du prêt ; l'adresse IP et le navigateur ne sont donnés que pour ce que l'emprunteur a signé lui-même
        receipts: { select: { number: true, kind: true, content: true, signature: true, signerName: true, signerEmail: true, signedAt: true, ip: true, userAgent: true, hash: true } },
      },
      orderBy: { createdAt: "asc" },
    }).then((loans) => loans.map((l) => ({ ...l, receipts: l.receipts.map((r) => (r.kind === "LOAN" ? r : { ...r, ip: undefined, userAgent: undefined })) }))),
    prisma.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: "asc" } }),
    prisma.payment.findMany({ where: { userId: user.id }, orderBy: { createdAt: "asc" } }),
    prisma.session.findMany({ where: { userId: user.id }, select: { createdAt: true, expiresAt: true }, orderBy: { createdAt: "asc" } }),
    // e-mails envoyés aux emprunteurs en ton nom (journal technique)
    prisma.emailLog.findMany({ where: { senderId: user.id }, select: { createdAt: true, to: true, subject: true, kind: true, ok: true }, orderBy: { createdAt: "asc" } }),
  ]);
  const { stripeCustomerId: _c, stripeSubscriptionId: _s, ...account } = publicUser(user);
  const data = { exportedAt: new Date().toISOString(), account, loansGiven, loansReceived, notifications, payments, sessions, emailsSent };
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="pret-materiel-mes-donnees-${new Date().toISOString().slice(0, 10)}.json"`,
      "Cache-Control": "no-store",
    },
  });
});
