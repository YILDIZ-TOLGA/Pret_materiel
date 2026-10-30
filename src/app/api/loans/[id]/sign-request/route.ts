import { prisma } from "@/lib/db";
import { error, json, withUser } from "@/lib/api";
import { termsUpToDate } from "@/lib/legal";
import { MAIL_LIMITS } from "@/lib/limits";
import { sendSignRequest } from "@/lib/loans";
import { isOptedOut } from "@/lib/optout";
import { identityMissing } from "@/lib/validation";

type Ctx = { params: Promise<{ id: string }> };
const DAY = 86400000;

/**
 * Renvoie la demande de signature de l'accusé de réception (au plus une fois par 24 h), ou la demande pour la
 * première fois sur un prêt enregistré avant les accusés de réception. Comptée dans le plafond de rappels du prêt.
 */
export const POST = withUser<Ctx>(async (user, _req, { params }) => {
  const loan = await prisma.loan.findUnique({ where: { id: (await params).id } });
  if (!loan || loan.lenderId !== user.id) return error("Prêt introuvable", 404);
  if (loan.status !== "ACTIVE") return error("Ce prêt est clôturé");
  if (loan.ackStatus === "SIGNED") return error("L'accusé de réception est déjà signé");
  if (loan.ackStatus === "REFUSED") {
    return error(`${loan.borrowerName} conteste ce prêt. Corrige-le (une nouvelle demande partira) ou contacte cette personne directement.`, 409);
  }
  // prêt enregistré avant que l'identité soit demandée : à compléter avant toute demande de signature
  const missing = identityMissing(loan);
  if (missing) return error(missing);
  if (!termsUpToDate(user) || !user.organization) {
    return error("Accepte d'abord les nouvelles conditions et indique le nom de ta structure (bandeau en haut de l'application).", 403);
  }
  if (loan.ackStatus === "PENDING" && loan.ackRequestedAt && Date.now() - loan.ackRequestedAt.getTime() < DAY) {
    return error("La demande est partie il y a moins de 24 heures : laisse à l'emprunteur le temps de la lire.", 429);
  }
  if (loan.reminderCount >= MAIL_LIMITS.remindersPerLoan) {
    return error(`${loan.borrowerName} a déjà reçu ${MAIL_LIMITS.remindersPerLoan} e-mails pour ce prêt : contacte cette personne directement.`, 429);
  }
  if (await isOptedOut(loan.borrowerEmail)) {
    return error(`${loan.borrowerName} ne reçoit plus les e-mails de Prêt Matériel : demande-lui de signer autrement, ou garde une autre preuve du prêt.`, 409);
  }
  const updated = await prisma.loan.update({ where: { id: loan.id }, data: { ackStatus: "PENDING", ackRequestedAt: new Date(), ackRemindedAt: null } });
  if (!(await sendSignRequest(updated, user, "resend"))) {
    await prisma.loan.update({ where: { id: loan.id }, data: { ackStatus: loan.ackStatus, ackRequestedAt: loan.ackRequestedAt, ackRemindedAt: loan.ackRemindedAt } });
    return error("La demande n'a pas pu être envoyée, réessaie dans quelques minutes.", 502);
  }
  await prisma.loan.update({ where: { id: loan.id }, data: { reminderCount: { increment: 1 } } });
  return json({ ok: true, ackRequestedAt: updated.ackRequestedAt });
});
