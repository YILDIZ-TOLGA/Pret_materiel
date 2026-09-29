import type { Loan, User } from "@prisma/client";
import { prisma } from "./db";
import { sendMail } from "./mail";

const appUrl = () => process.env.APP_URL || "http://localhost:3000";
export const fmtDate = (d: Date) => d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Paris" });

export const isOverdue = (l: Pick<Loan, "status" | "dueAt">) => l.status === "ACTIVE" && l.dueAt.getTime() < Date.now();

export async function notify(userId: string, title: string, body: string, link?: string) {
  await prisma.notification.create({ data: { userId, title, body, link } });
}

/** Nouveau prêt : e-mail à l'emprunteur + notification in-app s'il a un compte. */
export async function onLoanCreated(loan: Loan, lender: User) {
  await sendMail({
    to: loan.borrowerEmail,
    kind: "loan_created",
    subject: `${lender.name} vous a prêté : ${loan.item}`,
    title: `Bonjour ${loan.borrowerName},`,
    paragraphs: [
      `${lender.name} vous a prêté « ${loan.item} » le ${fmtDate(loan.lentAt)}.`,
      `Merci de le rendre avant le ${fmtDate(loan.dueAt)}.`,
      "Vous recevrez un rappel si la date est dépassée.",
    ],
    cta: { label: "Voir mes emprunts", url: `${appUrl()}/emprunts` },
  });
  if (loan.borrowerId) {
    await notify(loan.borrowerId, "Nouvel emprunt", `${lender.name} vous a prêté « ${loan.item} » — à rendre le ${fmtDate(loan.dueAt)}.`, "/emprunts");
  }
}

export async function onLoanReturned(loan: Loan, lender: User) {
  if (loan.borrowerId) {
    await notify(loan.borrowerId, "Emprunt clôturé", `${lender.name} a confirmé le retour de « ${loan.item} ». Merci !`, "/emprunts");
  }
}

/** Relance manuelle ou automatique pour un prêt en retard. */
export async function sendOverdueReminder(loan: Loan & { lender: User }) {
  const days = Math.max(1, Math.floor((Date.now() - loan.dueAt.getTime()) / 86400000));
  await sendMail({
    to: loan.borrowerEmail,
    kind: "loan_overdue",
    subject: `Rappel : « ${loan.item} » à rendre à ${loan.lender.name}`,
    title: `Bonjour ${loan.borrowerName},`,
    paragraphs: [
      `Petit rappel : « ${loan.item} », prêté par ${loan.lender.name}, devait être rendu le ${fmtDate(loan.dueAt)} (il y a ${days} jour${days > 1 ? "s" : ""}).`,
      `Pensez à le rendre dès que possible. Vous pouvez contacter ${loan.lender.name} à ${loan.lender.email}.`,
    ],
    cta: { label: "Voir mes emprunts", url: `${appUrl()}/emprunts` },
  });
  if (loan.borrowerId) {
    await notify(loan.borrowerId, "Emprunt en retard", `« ${loan.item} » devait être rendu à ${loan.lender.name} le ${fmtDate(loan.dueAt)}.`, "/emprunts");
  }
  await prisma.loan.update({ where: { id: loan.id }, data: { lastReminderAt: new Date(), reminderCount: { increment: 1 } } });
}

/**
 * Tâche planifiée (à lancer toutes les heures ou une fois par jour) :
 *  - J-1 : rappel à l'emprunteur
 *  - échéance dépassée : alerte au prêteur (une fois) + relance à l'emprunteur tous les 3 jours
 */
export async function runReminders() {
  const now = new Date();
  const in24h = new Date(now.getTime() + 86400000);
  const threeDaysAgo = new Date(now.getTime() - 3 * 86400000);
  let soon = 0, overdue = 0;

  const dueSoon = await prisma.loan.findMany({
    where: { status: "ACTIVE", remindBefore: true, dueAt: { gt: now, lte: in24h }, reminderCount: 0 },
    include: { lender: true },
  });
  for (const loan of dueSoon) {
    await sendMail({
      to: loan.borrowerEmail,
      kind: "loan_due_soon",
      subject: `Demain : « ${loan.item} » à rendre à ${loan.lender.name}`,
      title: `Bonjour ${loan.borrowerName},`,
      paragraphs: [`« ${loan.item} », prêté par ${loan.lender.name}, est à rendre le ${fmtDate(loan.dueAt)}.`],
      cta: { label: "Voir mes emprunts", url: `${appUrl()}/emprunts` },
    });
    if (loan.borrowerId) await notify(loan.borrowerId, "Échéance demain", `« ${loan.item} » est à rendre à ${loan.lender.name} demain.`, "/emprunts");
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
      await notify(loan.lenderId, "Prêt en retard", `${loan.borrowerName} n'a pas rendu « ${loan.item} » (échéance ${fmtDate(loan.dueAt)}).`, `/prets/${loan.id}`);
    }
    if (loan.autoReminder) {
      await sendOverdueReminder(loan);
    } else {
      await prisma.loan.update({ where: { id: loan.id }, data: { lastReminderAt: now } });
    }
    overdue++;
  }
  return { soon, overdue };
}
