import { prisma } from "@/lib/db";
import { error, json, withUser, zodError } from "@/lib/api";
import { maxLoans, maxNewLoansPerDay } from "@/lib/plans";
import { onLoanCreated } from "@/lib/loans";
import { MAIL_LIMITS } from "@/lib/limits";
import { thirdPartyMailsToday } from "@/lib/mail";
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
  // Anti-abus : chaque prêt envoie un e-mail à un tiers, donc on plafonne les créations sur 24 h selon l'offre
  // (écrit dans les CGU). Compté dans le journal EmailLog : supprimer puis recréer un prêt ne remet pas
  // le compteur à zéro, et un redémarrage du serveur non plus.
  const perDay = maxNewLoansPerDay(user);
  const createdToday = await prisma.emailLog.count({
    where: { senderId: user.id, kind: "loan_created", createdAt: { gt: new Date(Date.now() - 86400000) } },
  });
  if (createdToday >= perDay) {
    return json({ error: `Tu as déjà créé ${perDay} prêts ces dernières 24 heures. Réessaie demain.`, code: "DAILY_LIMIT" }, 429);
  }
  if ((await thirdPartyMailsToday(data.borrowerEmail)) >= MAIL_LIMITS.perRecipientPerDay) {
    return error(`${data.borrowerName} a déjà reçu plusieurs e-mails de Prêt Matériel aujourd'hui : réessaie demain.`, 429);
  }

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
