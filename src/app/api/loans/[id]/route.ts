import type { Loan } from "@prisma/client";
import { prisma } from "@/lib/db";
import { error, json, withUser, zodError } from "@/lib/api";
import { MAIL_LIMITS } from "@/lib/limits";
import { newBorrowerRefusal, onLoanCreated, onLoanRepaid, onLoanReturned, sendSignRequest } from "@/lib/loans";
import { isOptedOut } from "@/lib/optout";
import { signatureProof } from "@/lib/pdf-response";
import { deliverReceipt, receiptSummary, repaymentReceipt, returnReceipt } from "@/lib/receipts";
import { limitsFor } from "@/lib/sitemode";
import { borrowerFullName, checkBorrowerAge, checkDates, checkLoanKind, checkSignature, identityMissing, loanSchema, repaySchema, returnSchema } from "@/lib/validation";

type Ctx = { params: Promise<{ id: string }> };
const details = {
  repayments: { orderBy: { createdAt: "desc" as const }, include: { receipt: { select: { id: true, number: true } } } },
  receipts: { orderBy: { signedAt: "desc" as const }, select: { ...receiptSummary, downloadedAt: true } },
};
// Remboursement ajouté quand on clôturait un prêt d'argent sans reçu (prêts antérieurs aux reçus signés)
const CLOSING_NOTE = "Solde à la clôture";
// Ce qui figure sur l'accusé de réception : le modifier demande une nouvelle signature à l'emprunteur
const SIGNED_FIELDS = [
  "kind", "item", "amountCents", "description", "lentAt", "dueAt",
  "borrowerName", "borrowerFirstName", "borrowerLastName", "borrowerBirthDate", "borrowerEmail",
] as const;

async function own(userId: string, id: string) {
  const loan = await prisma.loan.findUnique({ where: { id }, include: details });
  return loan && loan.lenderId === userId ? loan : null;
}

/**
 * Deux valeurs de champ identiques ? Champ vide = null ; les dates se comparent au jour près (heure de Paris),
 * comme elles s'affichent et s'impriment : le formulaire renvoie la même date à une heure qui peut différer.
 */
const parisDay = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "Europe/Paris" });
const same = (a: unknown, b: unknown) => {
  const n = (v: unknown) => (v === undefined || v === "" ? null : v instanceof Date ? parisDay(v) : v);
  return n(a) === n(b);
};

export const GET = withUser<Ctx>(async (user, _req, { params }) => {
  const loan = await own(user.id, (await params).id);
  if (!loan) return error("Prêt introuvable", 404);
  // l'emprunteur a bloqué les e-mails : ni demande de signature, ni reçu, ni rappel ne lui parviennent
  return json({ loan, borrowerOptedOut: await isOptedOut(loan.borrowerEmail) });
});

/**
 * Modifier un prêt, ou :
 *  { "action": "repay", "amountCents": 2600, signature… }  → remboursement reçu, reçu signé par le prêteur
 *  { "action": "return", signature… }                       → objet rendu (attestation signée) ou prêt d'argent soldé (reçu du reste)
 *  { "action": "reopen" }                                   → rouvrir (impossible une fois le retour attesté par un document signé)
 * Signature du prêteur : { signerName, signature, accept: true } (voir src/lib/validation.ts).
 */
export const PATCH = withUser<Ctx>(async (user, req, { params }) => {
  const loan = await own(user.id, (await params).id);
  if (!loan) return error("Prêt introuvable", 404);
  const body = await req.json().catch(() => ({}));
  const money = loan.kind === "MONEY" && !!loan.amountCents;

  // Remboursement, ou solde d'un prêt d'argent : un reçu signé par le prêteur est envoyé à l'emprunteur
  if (body.action === "repay" || (body.action === "return" && money)) {
    if (!money) return error("Ce n'est pas un prêt d'argent");
    if (loan.status === "RETURNED") return error("Ce prêt est déjà clôturé");
    const rest = loan.amountCents! - loan.repaidCents;
    const parsed = repaySchema.safeParse(body.action === "return" ? { ...body, amountCents: rest } : body);
    if (!parsed.success) return zodError(parsed.error);
    const sigError = checkSignature(parsed.data.signature);
    if (sigError) return error(sigError);
    const amount = Math.min(parsed.data.amountCents, rest);
    const done = loan.repaidCents + amount >= loan.amountCents!;
    const proof = await signatureProof(req);
    // Verrou optimiste : deux remboursements envoyés en même temps ne doivent pas dépasser le montant prêté
    const result = await prisma.$transaction(async (tx) => {
      const { count } = await tx.loan.updateMany({
        where: { id: loan.id, status: "ACTIVE", repaidCents: loan.repaidCents },
        data: { repaidCents: { increment: amount }, ...(done ? { status: "RETURNED" as const, returnedAt: new Date() } : {}) },
      });
      if (!count) return null;
      const repayment = await tx.repayment.create({ data: { loanId: loan.id, amountCents: amount, note: parsed.data.note || null } });
      const receipt = await repaymentReceipt(tx, loan, user, {
        repaymentId: repayment.id, amountCents: amount, repaidBeforeCents: loan.repaidCents, note: parsed.data.note || null,
        signerName: parsed.data.signerName, signature: parsed.data.signature, ...proof,
      });
      return { receipt, loan: await tx.loan.findUniqueOrThrow({ where: { id: loan.id }, include: details }) };
    });
    if (!result) return error("Ce prêt vient d'être modifié : recharge la page et réessaie.", 409);
    await deliverReceipt(result.receipt, { ...result.loan, lender: user });
    await (done ? onLoanReturned(result.loan, user) : onLoanRepaid(result.loan, user, amount));
    return json({ loan: result.loan, receipt: { id: result.receipt.id, number: result.receipt.number } });
  }

  // Objet rendu : attestation de restitution signée par le prêteur, envoyée à l'emprunteur
  if (body.action === "return") {
    if (loan.status === "RETURNED") return json({ loan });
    const parsed = returnSchema.safeParse(body);
    if (!parsed.success) return zodError(parsed.error);
    const sigError = checkSignature(parsed.data.signature);
    if (sigError) return error(sigError);
    const proof = await signatureProof(req);
    const result = await prisma.$transaction(async (tx) => {
      const { count } = await tx.loan.updateMany({ where: { id: loan.id, status: "ACTIVE" }, data: { status: "RETURNED", returnedAt: new Date() } });
      if (!count) return null;
      const receipt = await returnReceipt(tx, loan, user, { note: parsed.data.note || null, signerName: parsed.data.signerName, signature: parsed.data.signature, ...proof });
      return { receipt, loan: await tx.loan.findUniqueOrThrow({ where: { id: loan.id }, include: details }) };
    });
    if (!result) return error("Ce prêt vient d'être modifié : recharge la page et réessaie.", 409);
    await deliverReceipt(result.receipt, { ...result.loan, lender: user });
    await onLoanReturned(result.loan, user);
    return json({ loan: result.loan, receipt: { id: result.receipt.id, number: result.receipt.number } });
  }

  if (body.action === "reopen") {
    if (loan.status === "ACTIVE") return json({ loan });
    // L'emprunteur a reçu une attestation ou un reçu signé : le prêt ne peut plus être rouvert
    if (!money && loan.receipts.some((r) => r.kind === "RETURN")) {
      return error("Le retour est attesté par un document signé, envoyé à l'emprunteur : ce prêt ne peut pas être rouvert. Enregistre un nouveau prêt si l'objet est prêté de nouveau.", 409);
    }
    // Rouvrir compte comme un prêt en cours : même limite que la création
    const active = await prisma.loan.count({ where: { lenderId: user.id, status: "ACTIVE" } });
    const { maxLoans: limit } = await limitsFor(user);
    if (active >= limit) {
      return json({ error: limit === 0 ? "Un abonnement est nécessaire pour rouvrir un prêt : choisis l'offre Entreprise." : `Limite atteinte : ${limit} prêts en cours avec ton offre. Clôture un prêt pour rouvrir celui-ci.`, code: "LIMIT_REACHED" }, 402);
    }
    // Ancien prêt d'argent : on annule le « solde à la clôture » ajouté automatiquement, pour retrouver le vrai reste dû
    const closing = money && loan.returnedAt
      ? loan.repayments.find((r) => r.note === CLOSING_NOTE && !r.receipt && r.createdAt.getTime() >= loan.returnedAt!.getTime() - 5000)
      : undefined;
    if (money && loan.repaidCents - (closing?.amountCents ?? 0) >= loan.amountCents!) {
      return error(loan.receipts.length
        ? "Ce prêt est entièrement remboursé et les reçus sont signés : il ne peut pas être rouvert."
        : "Ce prêt est entièrement remboursé : il n'y a plus rien à attendre. Modifie le montant si tu t'es trompé.");
    }
    const updated = await prisma.loan.update({
      where: { id: loan.id },
      data: {
        status: "ACTIVE", returnedAt: null,
        ...(closing ? { repaidCents: { decrement: closing.amountCents }, repayments: { delete: { id: closing.id } } } : {}),
      },
      include: details,
    });
    return json({ loan: updated });
  }

  const parsed = loanSchema.partial().safeParse(body);
  if (!parsed.success) return zodError(parsed.error);
  const kind = parsed.data.kind ?? loan.kind;
  // identité de l'emprunteur après la modification (les prêts antérieurs peuvent ne pas l'avoir)
  const identity = {
    borrowerFirstName: parsed.data.borrowerFirstName ?? loan.borrowerFirstName,
    borrowerLastName: parsed.data.borrowerLastName ?? loan.borrowerLastName,
    borrowerBirthDate: parsed.data.borrowerBirthDate ?? loan.borrowerBirthDate,
  };
  const lentAt = parsed.data.lentAt ?? loan.lentAt;
  const kindError = checkLoanKind({ kind, item: parsed.data.item ?? loan.item, amountCents: parsed.data.amountCents ?? loan.amountCents })
    ?? checkDates(lentAt, parsed.data.dueAt ?? loan.dueAt)
    ?? (identity.borrowerBirthDate && (parsed.data.borrowerBirthDate || parsed.data.lentAt) ? checkBorrowerAge(identity.borrowerBirthDate, lentAt) : null);
  if (kindError) return error(kindError);
  if (kind === "MONEY" && parsed.data.amountCents) {
    if (parsed.data.amountCents < loan.repaidCents) return error("Le montant ne peut pas être inférieur à ce qui a déjà été remboursé");
    if (loan.status === "ACTIVE" && parsed.data.amountCents === loan.repaidCents) return error("Avec ce montant, le prêt est entièrement remboursé : solde-le plutôt.");
  }
  const data = { ...parsed.data } as Record<string, unknown>;
  if (kind === "MONEY" && !parsed.data.item && parsed.data.item !== undefined) data.item = "Prêt d'argent";
  if (kind === "OBJECT") data.amountCents = null;
  if ((parsed.data.borrowerFirstName || parsed.data.borrowerLastName) && identity.borrowerFirstName && identity.borrowerLastName) {
    data.borrowerName = borrowerFullName(identity.borrowerFirstName, identity.borrowerLastName);
  }
  const changed = (k: string) => k in data && !same(data[k], loan[k as keyof Loan]);

  // Prêt clôturé dont les documents sont signés : il est figé, seules les notes privées restent modifiables
  if (loan.status === "RETURNED" && loan.receipts.length && Object.keys(data).some((k) => k !== "notes" && changed(k))) {
    return error("Ce prêt est clôturé et ses documents sont signés : seules les notes privées peuvent encore être modifiées.", 409);
  }
  // Nouvel emprunteur sur un prêt en cours : mêmes contrôles et mêmes plafonds qu'une création. Sinon, changer
  // l'adresse permettrait d'écrire à n'importe qui.
  const newEmail = parsed.data.borrowerEmail && parsed.data.borrowerEmail !== loan.borrowerEmail ? parsed.data.borrowerEmail : null;
  if (newEmail) {
    if (loan.status === "ACTIVE") {
      const refusal = await newBorrowerRefusal(user, newEmail, (data.borrowerName as string | undefined) ?? loan.borrowerName);
      if (refusal) return json({ error: refusal.error, code: refusal.code }, refusal.status);
      Object.assign(data, { reminderCount: 0, lastReminderAt: null });
    }
    const borrower = await prisma.user.findFirst({ where: { email: newEmail, emailVerifiedAt: { not: null } }, select: { id: true } });
    data.borrowerId = borrower?.id ?? null;
  }
  // Ce qui figure sur l'accusé de réception a changé : l'emprunteur signe la nouvelle version (les liens déjà
  // envoyés ne permettent plus de signer l'ancienne). Les documents déjà signés restent dans l'historique.
  const resign = loan.status === "ACTIVE" && SIGNED_FIELDS.some(changed) && (loan.ackStatus !== "NONE" || !!newEmail);
  if (resign) {
    // l'accusé de réception porte l'identité complète de l'emprunteur
    const missing = identityMissing(identity);
    if (missing) return error(missing);
    Object.assign(data, { ackStatus: "PENDING", ackVersion: { increment: 1 }, ackRequestedAt: new Date(), ackAt: null, ackRefusalReason: null, ackRemindedAt: null });
  }
  // Nouvelle échéance : le prêteur sera réalerté et le rappel de la veille repartira. Le compteur de rappels,
  // lui, n'est pas remis à zéro (plafond sur toute la vie du prêt, voir runReminders).
  if (parsed.data.dueAt && changed("dueAt")) data.lastReminderAt = null;
  let updated = await prisma.loan.update({ where: { id: loan.id }, data, include: details });

  let signRequest: "sent" | "not_sent" | null = null;
  if (resign) {
    if (newEmail) {
      signRequest = (await onLoanCreated(updated, user)) ? "sent" : "not_sent";
    } else if (updated.reminderCount < MAIL_LIMITS.remindersPerLoan && (await sendSignRequest(updated, user, "update"))) {
      updated = await prisma.loan.update({ where: { id: loan.id }, data: { reminderCount: { increment: 1 } }, include: details });
      signRequest = "sent";
    } else {
      signRequest = "not_sent";
    }
  }
  return json({ loan: updated, signRequest });
});

export const DELETE = withUser<Ctx>(async (user, _req, { params }) => {
  const loan = await own(user.id, (await params).id);
  if (!loan) return error("Prêt introuvable", 404);
  // les documents signés partent avec le prêt : c'est au prêteur d'en garder la copie imprimée (CGU art. 3 bis)
  await prisma.loan.delete({ where: { id: loan.id } });
  return json({ ok: true });
});
