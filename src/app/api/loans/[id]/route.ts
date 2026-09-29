import { prisma } from "@/lib/db";
import { error, json, withUser, zodError } from "@/lib/api";
import { onLoanRepaid, onLoanReturned } from "@/lib/loans";
import { checkLoanKind, loanSchema, repaySchema } from "@/lib/validation";

type Ctx = { params: Promise<{ id: string }> };

async function own(userId: string, id: string) {
  const loan = await prisma.loan.findUnique({ where: { id }, include: { repayments: { orderBy: { createdAt: "desc" } } } });
  return loan && loan.lenderId === userId ? loan : null;
}

export const GET = withUser<Ctx>(async (user, _req, { params }) => {
  const loan = await own(user.id, (await params).id);
  return loan ? json({ loan }) : error("Prêt introuvable", 404);
});

/**
 * Modifier un prêt, ou :
 *  { "action": "return" }                       → clôturer (objet rendu / argent remboursé)
 *  { "action": "reopen" }                       → rouvrir
 *  { "action": "repay", "amountCents": 2000 }   → remboursement partiel d'un prêt d'argent
 */
export const PATCH = withUser<Ctx>(async (user, req, { params }) => {
  const loan = await own(user.id, (await params).id);
  if (!loan) return error("Prêt introuvable", 404);
  const body = await req.json().catch(() => ({}));

  if (body.action === "return") {
    if (loan.status === "RETURNED") return json({ loan });
    // Clôturer un prêt d'argent = considérer le reste comme remboursé
    const rest = loan.kind === "MONEY" && loan.amountCents ? Math.max(0, loan.amountCents - loan.repaidCents) : 0;
    const updated = await prisma.loan.update({
      where: { id: loan.id },
      data: {
        status: "RETURNED", returnedAt: new Date(),
        ...(rest > 0 ? { repaidCents: loan.amountCents!, repayments: { create: { amountCents: rest, note: "Solde à la clôture" } } } : {}),
      },
      include: { repayments: { orderBy: { createdAt: "desc" } } },
    });
    await onLoanReturned(updated, user);
    return json({ loan: updated });
  }
  if (body.action === "repay") {
    if (loan.kind !== "MONEY" || !loan.amountCents) return error("Ce n'est pas un prêt d'argent");
    if (loan.status === "RETURNED") return error("Ce prêt est déjà clôturé");
    const parsed = repaySchema.safeParse(body);
    if (!parsed.success) return zodError(parsed.error);
    const rest = loan.amountCents - loan.repaidCents;
    const amount = Math.min(parsed.data.amountCents, rest);
    const done = loan.repaidCents + amount >= loan.amountCents;
    const updated = await prisma.loan.update({
      where: { id: loan.id },
      data: {
        repaidCents: { increment: amount },
        repayments: { create: { amountCents: amount, note: parsed.data.note || null } },
        ...(done ? { status: "RETURNED", returnedAt: new Date() } : {}),
      },
      include: { repayments: { orderBy: { createdAt: "desc" } } },
    });
    await (done ? onLoanReturned(updated, user) : onLoanRepaid(updated, user, amount));
    return json({ loan: updated });
  }
  if (body.action === "reopen") {
    const updated = await prisma.loan.update({ where: { id: loan.id }, data: { status: "ACTIVE", returnedAt: null }, include: { repayments: { orderBy: { createdAt: "desc" } } } });
    return json({ loan: updated });
  }

  const parsed = loanSchema.partial().safeParse(body);
  if (!parsed.success) return zodError(parsed.error);
  const kind = parsed.data.kind ?? loan.kind;
  const kindError = checkLoanKind({ kind, item: parsed.data.item ?? loan.item, amountCents: parsed.data.amountCents ?? loan.amountCents });
  if (kindError) return error(kindError);
  if (kind === "MONEY" && parsed.data.amountCents && parsed.data.amountCents < loan.repaidCents) return error("Le montant ne peut pas être inférieur à ce qui a déjà été remboursé");
  const data = { ...parsed.data } as Record<string, unknown>;
  if (kind === "MONEY" && !parsed.data.item && parsed.data.item !== undefined) data.item = "Prêt d'argent";
  if (kind === "OBJECT") data.amountCents = null;
  if (parsed.data.borrowerEmail && parsed.data.borrowerEmail !== loan.borrowerEmail) {
    const borrower = await prisma.user.findUnique({ where: { email: parsed.data.borrowerEmail }, select: { id: true } });
    data.borrowerId = borrower?.id ?? null;
  }
  // Nouvelle échéance : on repart sur un cycle de rappels propre.
  if (parsed.data.dueAt) Object.assign(data, { reminderCount: 0, lastReminderAt: null });
  const updated = await prisma.loan.update({ where: { id: loan.id }, data, include: { repayments: { orderBy: { createdAt: "desc" } } } });
  return json({ loan: updated });
});

export const DELETE = withUser<Ctx>(async (user, _req, { params }) => {
  const loan = await own(user.id, (await params).id);
  if (!loan) return error("Prêt introuvable", 404);
  await prisma.loan.delete({ where: { id: loan.id } });
  return json({ ok: true });
});
