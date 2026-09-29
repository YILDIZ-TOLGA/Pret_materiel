import { prisma } from "@/lib/db";
import { error, json, withUser, zodError } from "@/lib/api";
import { onLoanReturned } from "@/lib/loans";
import { loanSchema } from "@/lib/validation";

type Ctx = { params: Promise<{ id: string }> };

async function own(userId: string, id: string) {
  const loan = await prisma.loan.findUnique({ where: { id } });
  return loan && loan.lenderId === userId ? loan : null;
}

export const GET = withUser<Ctx>(async (user, _req, { params }) => {
  const loan = await own(user.id, (await params).id);
  return loan ? json({ loan }) : error("Prêt introuvable", 404);
});

/** Modifier un prêt, ou le clôturer avec { "action": "return" } / le rouvrir avec { "action": "reopen" }. */
export const PATCH = withUser<Ctx>(async (user, req, { params }) => {
  const loan = await own(user.id, (await params).id);
  if (!loan) return error("Prêt introuvable", 404);
  const body = await req.json().catch(() => ({}));

  if (body.action === "return") {
    if (loan.status === "RETURNED") return json({ loan });
    const updated = await prisma.loan.update({ where: { id: loan.id }, data: { status: "RETURNED", returnedAt: new Date() } });
    await onLoanReturned(updated, user);
    return json({ loan: updated });
  }
  if (body.action === "reopen") {
    const updated = await prisma.loan.update({ where: { id: loan.id }, data: { status: "ACTIVE", returnedAt: null } });
    return json({ loan: updated });
  }

  const parsed = loanSchema.partial().safeParse(body);
  if (!parsed.success) return zodError(parsed.error);
  const data = { ...parsed.data } as Record<string, unknown>;
  if (parsed.data.borrowerEmail && parsed.data.borrowerEmail !== loan.borrowerEmail) {
    const borrower = await prisma.user.findUnique({ where: { email: parsed.data.borrowerEmail }, select: { id: true } });
    data.borrowerId = borrower?.id ?? null;
  }
  // Nouvelle échéance : on repart sur un cycle de rappels propre.
  if (parsed.data.dueAt) Object.assign(data, { reminderCount: 0, lastReminderAt: null });
  const updated = await prisma.loan.update({ where: { id: loan.id }, data });
  return json({ loan: updated });
});

export const DELETE = withUser<Ctx>(async (user, _req, { params }) => {
  const loan = await own(user.id, (await params).id);
  if (!loan) return error("Prêt introuvable", 404);
  await prisma.loan.delete({ where: { id: loan.id } });
  return json({ ok: true });
});
