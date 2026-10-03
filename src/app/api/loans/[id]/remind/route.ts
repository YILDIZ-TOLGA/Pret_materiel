import { prisma } from "@/lib/db";
import { error, json, withUser } from "@/lib/api";
import { sendOverdueReminder } from "@/lib/loans";
import { isOptedOut } from "@/lib/optout";

type Ctx = { params: Promise<{ id: string }> };

/** Relance manuelle (max 1 par heure pour éviter le spam). */
export const POST = withUser<Ctx>(async (user, _req, { params }) => {
  const loan = await prisma.loan.findUnique({ where: { id: (await params).id }, include: { lender: true } });
  if (!loan || loan.lenderId !== user.id) return error("Prêt introuvable", 404);
  if (loan.status !== "ACTIVE") return error("Ce prêt est clôturé");
  if (loan.dueAt.getTime() > Date.now()) return error("La relance est possible après la date de retour");
  if (loan.lastReminderAt && Date.now() - loan.lastReminderAt.getTime() < 3600000) return error("Une relance a déjà été envoyée il y a moins d'une heure", 429);
  if (await isOptedOut(loan.borrowerEmail)) {
    return error(`${loan.borrowerName} ne reçoit plus les e-mails de Prêt Matériel : contacte cette personne directement.`, 409);
  }
  if (!(await sendOverdueReminder(loan))) return error("La relance n'a pas pu être envoyée, réessaie dans quelques minutes.", 502);
  return json({ ok: true });
});
