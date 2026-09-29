import { prisma } from "@/lib/db";
import { error, json, withUser, zodError } from "@/lib/api";
import { maxLoans } from "@/lib/plans";
import { onLoanCreated } from "@/lib/loans";
import { loanSchema } from "@/lib/validation";

export const GET = withUser(async (user, req) => {
  const status = new URL(req.url).searchParams.get("status");
  const loans = await prisma.loan.findMany({
    where: { lenderId: user.id, ...(status === "ACTIVE" || status === "RETURNED" ? { status } : {}) },
    orderBy: [{ status: "asc" }, { dueAt: "asc" }],
  });
  return json({ loans });
});

export const POST = withUser(async (user, req) => {
  const parsed = loanSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return zodError(parsed.error);
  const data = parsed.data;

  const active = await prisma.loan.count({ where: { lenderId: user.id, status: "ACTIVE" } });
  const limit = maxLoans(user);
  if (active >= limit) {
    return json({ error: `Limite atteinte : ${limit} prêt${limit > 1 ? "s" : ""} en cours avec ton offre.`, code: "LIMIT_REACHED" }, 402);
  }
  if (data.borrowerEmail === user.email) return error("Tu ne peux pas te prêter un objet à toi-même");

  const borrower = await prisma.user.findUnique({ where: { email: data.borrowerEmail }, select: { id: true } });
  const loan = await prisma.loan.create({
    data: { ...data, lenderId: user.id, borrowerId: borrower?.id ?? null },
  });
  await onLoanCreated(loan, user);
  return json({ loan }, 201);
});
