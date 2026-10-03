import { prisma } from "@/lib/db";
import { error, json, withUser, zodError } from "@/lib/api";
import { maxLoans } from "@/lib/plans";
import { onLoanCreated } from "@/lib/loans";
import { checkLoanKind, loanSchema } from "@/lib/validation";

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
  const kindError = checkLoanKind(data);
  if (kindError) return error(kindError);

  // Anti-abus : pas d'e-mail envoyé à un tiers depuis un compte dont l'adresse n'est pas prouvée
  if (!user.emailVerifiedAt) {
    return json({ error: "Confirme d'abord ton adresse e-mail avec le lien reçu à l'inscription.", code: "EMAIL_NOT_VERIFIED" }, 403);
  }
  const active = await prisma.loan.count({ where: { lenderId: user.id, status: "ACTIVE" } });
  const limit = maxLoans(user);
  if (active >= limit) {
    return json({ error: `Limite atteinte : ${limit} prêt${limit > 1 ? "s" : ""} en cours avec ton offre.`, code: "LIMIT_REACHED" }, 402);
  }
  if (data.borrowerEmail === user.email) return error("Tu ne peux pas te prêter quelque chose à toi-même");

  const borrower = await prisma.user.findFirst({ where: { email: data.borrowerEmail, emailVerifiedAt: { not: null } }, select: { id: true } });
  const loan = await prisma.loan.create({
    data: {
      ...data,
      kind: data.kind ?? "OBJECT",
      item: data.item || "Prêt d'argent",
      amountCents: data.kind === "MONEY" ? data.amountCents : null,
      lenderId: user.id,
      borrowerId: borrower?.id ?? null,
    },
  });
  await onLoanCreated(loan, user);
  return json({ loan }, 201);
});
