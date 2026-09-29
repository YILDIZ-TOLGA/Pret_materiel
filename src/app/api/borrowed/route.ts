import { prisma } from "@/lib/db";
import { json, withUser } from "@/lib/api";

/** Objets que les autres m'ont prêtés (liés à mon e-mail). */
export const GET = withUser(async (user) => {
  const loans = await prisma.loan.findMany({
    where: { OR: [{ borrowerId: user.id }, { borrowerEmail: user.email }] },
    orderBy: [{ status: "asc" }, { dueAt: "asc" }],
    include: { lender: { select: { name: true, email: true } } },
  });
  return json({ loans });
});
