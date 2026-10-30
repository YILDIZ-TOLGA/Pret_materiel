import { prisma } from "@/lib/db";
import { error, json, withUser, zodError } from "@/lib/api";
import { limitsFor } from "@/lib/sitemode";
import { newBorrowerRefusal, onLoanCreated } from "@/lib/loans";
import { borrowerFullName, checkBorrowerAge, checkDates, checkLoanKind, loanSchema } from "@/lib/validation";

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
  const lentAt = data.lentAt ?? new Date();
  const kindError = checkLoanKind(data) ?? checkDates(lentAt, data.dueAt) ?? checkBorrowerAge(data.borrowerBirthDate, lentAt);
  if (kindError) return error(kindError);
  const borrowerName = borrowerFullName(data.borrowerFirstName, data.borrowerLastName);

  // Anti-abus : pas d'e-mail envoyé à un tiers depuis un compte dont l'adresse n'est pas prouvée
  if (!user.emailVerifiedAt) {
    return json({ error: "Confirme d'abord ton adresse e-mail avec le lien reçu à l'inscription.", code: "EMAIL_NOT_VERIFIED" }, 403);
  }
  const active = await prisma.loan.count({ where: { lenderId: user.id, status: "ACTIVE" } });
  const { maxLoans: limit } = await limitsFor(user);
  if (active >= limit) {
    return json({ error: limit === 0 ? "Un abonnement est nécessaire pour enregistrer des prêts : choisis l'offre Entreprise." : `Limite atteinte : ${limit} prêts en cours avec ton offre.`, code: "LIMIT_REACHED" }, 402);
  }
  const refusal = await newBorrowerRefusal(user, data.borrowerEmail, borrowerName);
  if (refusal) return json({ error: refusal.error, code: refusal.code }, refusal.status);

  const borrower = await prisma.user.findFirst({ where: { email: data.borrowerEmail, emailVerifiedAt: { not: null } }, select: { id: true } });
  const loan = await prisma.loan.create({
    data: {
      ...data,
      borrowerName,
      kind: data.kind ?? "OBJECT",
      item: data.item || "Prêt d'argent",
      amountCents: data.kind === "MONEY" ? data.amountCents : null,
      lenderId: user.id,
      borrowerId: borrower?.id ?? null,
      // l'emprunteur reçoit tout de suite la demande de signature de l'accusé de réception
      ackStatus: "PENDING",
      ackRequestedAt: new Date(),
    },
  });
  const signRequest = (await onLoanCreated(loan, user)) ? "sent" : "not_sent";
  return json({ loan, signRequest }, 201);
});
