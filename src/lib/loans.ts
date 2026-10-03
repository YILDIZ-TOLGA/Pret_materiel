import type { Loan, User } from "@prisma/client";
import { prisma } from "./db";
import { sendMail } from "./mail";

const appUrl = () => process.env.APP_URL || "http://localhost:3000";
export const fmtDate = (d: Date) => d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Paris" });

const parisDay = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "Europe/Paris" }); // AAAA-MM-JJ
const parisHour = (d: Date) => Number(d.toLocaleString("en-GB", { timeZone: "Europe/Paris", hour: "2-digit", hourCycle: "h23" }));
/** Écart en jours calendaires, heure de Paris (1 = demain), comme l'affiche l'application. */
const calendarDays = (from: Date, to: Date) => Math.round((Date.parse(parisDay(to)) - Date.parse(parisDay(from))) / 86400000);

export const eur = (cents: number) =>
  (cents / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR", minimumFractionDigits: cents % 100 ? 2 : 0 });

type LoanLike = Pick<Loan, "kind" | "item" | "amountCents" | "repaidCents">;
const isMoney = (l: LoanLike) => l.kind === "MONEY" && !!l.amountCents;
/** Reste dû (prêt d'argent). */
export const remaining = (l: LoanLike) => (isMoney(l) ? Math.max(0, l.amountCents! - l.repaidCents) : 0);
/** « Perceuse » ou « 50 € (resto) » */
export function what(l: LoanLike) {
  if (!isMoney(l)) return `« ${l.item} »`;
  return l.item && l.item !== "Prêt d'argent" ? `${eur(l.amountCents!)} (${l.item})` : eur(l.amountCents!);
}
/** Ce qu'il reste à rendre : « Perceuse » ou « les 20 € restants » */
function toGiveBack(l: LoanLike) {
  if (!isMoney(l)) return `« ${l.item} »`;
  const rest = remaining(l);
  return rest < l.amountCents! ? `les ${eur(rest)} restants sur ${eur(l.amountCents!)}` : what(l);
}

export const isOverdue = (l: Pick<Loan, "status" | "dueAt">) => l.status === "ACTIVE" && l.dueAt.getTime() < Date.now();

export async function notify(userId: string, title: string, body: string, link?: string) {
  await prisma.notification.create({ data: { userId, title, body, link } });
}

/** Nouveau prêt : e-mail à l'emprunteur + notification in-app s'il a un compte. */
export async function onLoanCreated(loan: Loan, lender: User) {
  await sendMail({
    to: loan.borrowerEmail,
    kind: "loan_created",
    subject: `${lender.name} vous a prêté ${isMoney(loan) ? eur(loan.amountCents!) : `: ${loan.item}`}`,
    title: `Bonjour ${loan.borrowerName},`,
    paragraphs: [
      `${lender.name} vous a prêté ${what(loan)} le ${fmtDate(loan.lentAt)}.`,
      isMoney(loan) ? `Merci de le rembourser avant le ${fmtDate(loan.dueAt)}.` : `Merci de le rendre avant le ${fmtDate(loan.dueAt)}.`,
      "Vous recevrez un rappel si la date est dépassée.",
    ],
    cta: { label: "Voir mes emprunts", url: `${appUrl()}/emprunts` },
    thirdParty: { lenderName: lender.name },
  });
  if (loan.borrowerId) {
    await notify(loan.borrowerId, "Nouvel emprunt", `${lender.name} vous a prêté ${what(loan)} — à rendre le ${fmtDate(loan.dueAt)}.`, "/emprunts");
  }
}

export async function onLoanReturned(loan: Loan, lender: User) {
  if (loan.borrowerId) {
    const msg = isMoney(loan) ? `${lender.name} a confirmé le remboursement de ${what(loan)}. Merci !` : `${lender.name} a confirmé le retour de « ${loan.item} ». Merci !`;
    await notify(loan.borrowerId, "Emprunt clôturé", msg, "/emprunts");
  }
}

export async function onLoanRepaid(loan: Loan, lender: User, amountCents: number) {
  if (loan.borrowerId) {
    await notify(loan.borrowerId, "Remboursement enregistré", `${lender.name} a bien reçu ${eur(amountCents)}. Reste à rembourser : ${eur(remaining(loan))}.`, "/emprunts");
  }
}

/** Relance manuelle ou automatique pour un prêt en retard. Renvoie false si l'e-mail n'est pas parti. */
export async function sendOverdueReminder(loan: Loan & { lender: User }) {
  const days = Math.max(1, calendarDays(loan.dueAt, new Date()));
  const sent = await sendMail({
    to: loan.borrowerEmail,
    kind: "loan_overdue",
    subject: isMoney(loan) ? `Rappel : ${eur(remaining(loan))} à rembourser à ${loan.lender.name}` : `Rappel : « ${loan.item} » à rendre à ${loan.lender.name}`,
    title: `Bonjour ${loan.borrowerName},`,
    paragraphs: [
      isMoney(loan)
        ? `Petit rappel : ${toGiveBack(loan)}, prêtés par ${loan.lender.name}, devaient être remboursés le ${fmtDate(loan.dueAt)} (il y a ${days} jour${days > 1 ? "s" : ""}).`
        : `Petit rappel : « ${loan.item} », prêté par ${loan.lender.name}, devait être rendu le ${fmtDate(loan.dueAt)} (il y a ${days} jour${days > 1 ? "s" : ""}).`,
      `Pensez à ${isMoney(loan) ? "rembourser" : "le rendre"} dès que possible. Vous pouvez contacter ${loan.lender.name} à ${loan.lender.email}.`,
    ],
    cta: { label: "Voir mes emprunts", url: `${appUrl()}/emprunts` },
    thirdParty: { lenderName: loan.lender.name },
  });
  if (!sent) return false;
  if (loan.borrowerId) {
    await notify(loan.borrowerId, "Emprunt en retard", `${toGiveBack(loan)} : à rendre à ${loan.lender.name} depuis le ${fmtDate(loan.dueAt)}.`, "/emprunts");
  }
  await prisma.loan.update({ where: { id: loan.id }, data: { lastReminderAt: new Date(), reminderCount: { increment: 1 } } });
  return true;
}

/**
 * Tâche planifiée, à lancer toutes les heures. Les e-mails ne partent qu'entre 9 h et 21 h (heure de Paris) :
 *  - veille de l'échéance : rappel à l'emprunteur
 *  - échéance dépassée : alerte au prêteur (une fois) + relance à l'emprunteur tous les 3 jours
 */
export async function runReminders() {
  const now = new Date();
  let soon = 0, overdue = 0;
  const hour = parisHour(now);
  if (hour < 9 || hour >= 21) return { soon, overdue };
  const in48h = new Date(now.getTime() + 2 * 86400000);
  const threeDaysAgo = new Date(now.getTime() - 3 * 86400000);

  // L'échéance est fixée à 23 h 59 le jour du retour : on prévient la veille (jour calendaire), pas « dans les 24 h ».
  const dueSoon = (await prisma.loan.findMany({
    where: { status: "ACTIVE", remindBefore: true, dueAt: { gt: now, lte: in48h }, reminderCount: 0 },
    include: { lender: true },
  })).filter((loan) => calendarDays(now, loan.dueAt) === 1);
  for (const loan of dueSoon) {
    await sendMail({
      to: loan.borrowerEmail,
      kind: "loan_due_soon",
      subject: `Demain : ${isMoney(loan) ? eur(remaining(loan)) : `« ${loan.item} »`} à rendre à ${loan.lender.name}`,
      title: `Bonjour ${loan.borrowerName},`,
      paragraphs: [`${toGiveBack(loan)}, prêté par ${loan.lender.name}, est à rendre le ${fmtDate(loan.dueAt)}.`],
      cta: { label: "Voir mes emprunts", url: `${appUrl()}/emprunts` },
      thirdParty: { lenderName: loan.lender.name },
    });
    if (loan.borrowerId) await notify(loan.borrowerId, "Échéance demain", `${toGiveBack(loan)} : à rendre à ${loan.lender.name} demain.`, "/emprunts");
    await prisma.loan.update({ where: { id: loan.id }, data: { reminderCount: { increment: 1 }, lastReminderAt: now } });
    soon++;
  }

  const late = await prisma.loan.findMany({
    where: {
      status: "ACTIVE",
      dueAt: { lt: now },
      OR: [{ lastReminderAt: null }, { lastReminderAt: { lt: threeDaysAgo } }, { lastReminderAt: { lt: prisma.loan.fields.dueAt } }],
    },
    include: { lender: true },
  });
  for (const loan of late) {
    const firstAlert = !loan.lastReminderAt || loan.lastReminderAt < loan.dueAt;
    if (firstAlert) {
      const msg = isMoney(loan)
        ? `${loan.borrowerName} ne t'a pas remboursé ${toGiveBack(loan)} (échéance ${fmtDate(loan.dueAt)}).`
        : `${loan.borrowerName} n'a pas rendu « ${loan.item} » (échéance ${fmtDate(loan.dueAt)}).`;
      await notify(loan.lenderId, "Prêt en retard", msg, `/prets/${loan.id}`);
    }
    // Pas de relance (désactivée, emprunteur désinscrit ou envoi en échec) : on note quand même le passage
    // pour ne pas réalerter le prêteur ni retenter à chaque heure.
    const sent = loan.autoReminder && (await sendOverdueReminder(loan));
    if (!sent) await prisma.loan.update({ where: { id: loan.id }, data: { lastReminderAt: now } });
    overdue++;
  }
  return { soon, overdue };
}
