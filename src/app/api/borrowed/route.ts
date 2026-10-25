import { prisma } from "@/lib/db";
import { json, withUser } from "@/lib/api";

/**
 * Objets que les autres m'ont prêtés (liés à mon e-mail, seulement une fois l'adresse confirmée).
 * Liste blanche des champs : les notes privées du prêteur, ses options et l'état des relances ne
 * concernent que lui (même liste que l'export, src/app/api/account/export/route.ts).
 */
export const GET = withUser(async (user) => {
  const loans = await prisma.loan.findMany({
    where: user.emailVerifiedAt ? { OR: [{ borrowerId: user.id }, { borrowerEmail: user.email }] } : { borrowerId: user.id },
    orderBy: [{ status: "asc" }, { dueAt: "asc" }],
    select: {
      id: true, kind: true, item: true, amountCents: true, repaidCents: true, currency: true, description: true,
      borrowerName: true, lentAt: true, dueAt: true, status: true, returnedAt: true,
      lender: { select: { name: true, email: true } },
    },
  });
  return json({ loans });
});
