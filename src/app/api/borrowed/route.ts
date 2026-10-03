import { prisma } from "@/lib/db";
import { json, withUser } from "@/lib/api";

/** Objets que les autres m'ont prêtés (liés à mon e-mail, seulement une fois l'adresse confirmée). */
export const GET = withUser(async (user) => {
  const loans = await prisma.loan.findMany({
    where: user.emailVerifiedAt ? { OR: [{ borrowerId: user.id }, { borrowerEmail: user.email }] } : { borrowerId: user.id },
    orderBy: [{ status: "asc" }, { dueAt: "asc" }],
    include: { lender: { select: { name: true, email: true } } },
  });
  return json({ loans });
});
