import { prisma } from "@/lib/db";
import { error, json, withUser, zodError } from "@/lib/api";
import { newBorrowerRefusal, onLoanCreated, onLoanRepaid, onLoanReturned } from "@/lib/loans";
import { limitsFor } from "@/lib/sitemode";
import { checkDates, checkLoanKind, loanSchema, repaySchema } from "@/lib/validation";

type Ctx = { params: Promise<{ id: string }> };
const withRepayments = { repayments: { orderBy: { createdAt: "desc" as const } } };
// Remboursement ajouté quand on clôture un prêt d'argent pas encore soldé (annulé si on le rouvre)
const CLOSING_NOTE = "Solde à la clôture";

async function own(userId: string, id: string) {
  const loan = await prisma.loan.findUnique({ where: { id }, include: withRepayments });
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
        ...(rest > 0 ? { repaidCents: loan.amountCents!, repayments: { create: { amountCents: rest, note: CLOSING_NOTE } } } : {}),
      },
      include: withRepayments,
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
    // Verrou optimiste : deux remboursements envoyés en même temps ne doivent pas dépasser le montant prêté
    const updated = await prisma.$transaction(async (tx) => {
      const { count } = await tx.loan.updateMany({
        where: { id: loan.id, status: "ACTIVE", repaidCents: loan.repaidCents },
        data: { repaidCents: { increment: amount }, ...(done ? { status: "RETURNED" as const, returnedAt: new Date() } : {}) },
      });
      if (!count) return null;
      await tx.repayment.create({ data: { loanId: loan.id, amountCents: amount, note: parsed.data.note || null } });
      return tx.loan.findUniqueOrThrow({ where: { id: loan.id }, include: withRepayments });
    });
    if (!updated) return error("Ce prêt vient d'être modifié : recharge la page et réessaie.", 409);
    await (done ? onLoanReturned(updated, user) : onLoanRepaid(updated, user, amount));
    return json({ loan: updated });
  }
  if (body.action === "reopen") {
    if (loan.status === "ACTIVE") return json({ loan });
    // Rouvrir compte comme un prêt en cours : même limite que la création
    const active = await prisma.loan.count({ where: { lenderId: user.id, status: "ACTIVE" } });
    const { maxLoans: limit } = await limitsFor(user);
    if (active >= limit) {
      return json({ error: `Limite atteinte : ${limit} prêt${limit > 1 ? "s" : ""} en cours avec ton offre. Clôture un prêt ou change d'offre pour rouvrir celui-ci.`, code: "LIMIT_REACHED" }, 402);
    }
    // Prêt d'argent : on annule le « solde à la clôture » ajouté automatiquement, pour retrouver le vrai reste dû
    const closing = loan.kind === "MONEY" && loan.returnedAt
      ? loan.repayments.find((r) => r.note === CLOSING_NOTE && r.createdAt.getTime() >= loan.returnedAt!.getTime() - 5000)
      : undefined;
    if (loan.kind === "MONEY" && loan.amountCents && loan.repaidCents - (closing?.amountCents ?? 0) >= loan.amountCents) {
      return error("Ce prêt est entièrement remboursé : il n'y a plus rien à attendre. Modifie le montant si tu t'es trompé.");
    }
    const updated = await prisma.loan.update({
      where: { id: loan.id },
      data: {
        status: "ACTIVE", returnedAt: null,
        ...(closing ? { repaidCents: { decrement: closing.amountCents }, repayments: { delete: { id: closing.id } } } : {}),
      },
      include: withRepayments,
    });
    return json({ loan: updated });
  }

  const parsed = loanSchema.partial().safeParse(body);
  if (!parsed.success) return zodError(parsed.error);
  const kind = parsed.data.kind ?? loan.kind;
  const kindError = checkLoanKind({ kind, item: parsed.data.item ?? loan.item, amountCents: parsed.data.amountCents ?? loan.amountCents })
    ?? checkDates(parsed.data.lentAt ?? loan.lentAt, parsed.data.dueAt ?? loan.dueAt);
  if (kindError) return error(kindError);
  if (kind === "MONEY" && parsed.data.amountCents) {
    if (parsed.data.amountCents < loan.repaidCents) return error("Le montant ne peut pas être inférieur à ce qui a déjà été remboursé");
    if (loan.status === "ACTIVE" && parsed.data.amountCents === loan.repaidCents) return error("Avec ce montant, le prêt est entièrement remboursé : clôture-le plutôt.");
  }
  const data = { ...parsed.data } as Record<string, unknown>;
  if (kind === "MONEY" && !parsed.data.item && parsed.data.item !== undefined) data.item = "Prêt d'argent";
  if (kind === "OBJECT") data.amountCents = null;
  // Nouvel emprunteur sur un prêt en cours : il reçoit l'e-mail de confirmation (information art. 14 RGPD),
  // avec les mêmes plafonds qu'une création. Sinon, changer l'adresse permettrait d'écrire à n'importe qui.
  const newEmail = parsed.data.borrowerEmail && parsed.data.borrowerEmail !== loan.borrowerEmail ? parsed.data.borrowerEmail : null;
  if (newEmail) {
    if (loan.status === "ACTIVE") {
      const refusal = await newBorrowerRefusal(user, newEmail, parsed.data.borrowerName ?? loan.borrowerName);
      if (refusal) return json({ error: refusal.error, code: refusal.code }, refusal.status);
      Object.assign(data, { reminderCount: 0, lastReminderAt: null });
    }
    const borrower = await prisma.user.findFirst({ where: { email: newEmail, emailVerifiedAt: { not: null } }, select: { id: true } });
    data.borrowerId = borrower?.id ?? null;
  }
  // Nouvelle échéance : le prêteur sera réalerté et le rappel de la veille repartira. Le compteur de rappels,
  // lui, n'est pas remis à zéro (plafond sur toute la vie du prêt, voir runReminders).
  if (parsed.data.dueAt) data.lastReminderAt = null;
  const updated = await prisma.loan.update({ where: { id: loan.id }, data, include: withRepayments });
  if (newEmail && updated.status === "ACTIVE") await onLoanCreated(updated, user);
  return json({ loan: updated });
});

export const DELETE = withUser<Ctx>(async (user, _req, { params }) => {
  const loan = await own(user.id, (await params).id);
  if (!loan) return error("Prêt introuvable", 404);
  await prisma.loan.delete({ where: { id: loan.id } });
  return json({ ok: true });
});
