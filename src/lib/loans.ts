import type { Loan, User } from "@prisma/client";
import { prisma } from "./db";
import { termsUpToDate } from "./legal";
import { MAIL_LIMITS } from "./limits";
import { sendMail, thirdPartyMailsToday } from "./mail";
import { lenderLabel } from "./receipt-text";
import { signUrl } from "./signlink";
import { limitsFor } from "./sitemode";

export const fmtDate = (d: Date) => d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Paris" });

const parisDay = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "Europe/Paris" }); // AAAA-MM-JJ
const parisHour = (d: Date) => Number(d.toLocaleString("en-GB", { timeZone: "Europe/Paris", hour: "2-digit", hourCycle: "h23" }));
/** Écart en jours calendaires, heure de Paris (1 = demain), comme l'affiche l'application. */
const calendarDays = (from: Date, to: Date) => Math.round((Date.parse(parisDay(to)) - Date.parse(parisDay(from))) / 86400000);

export const eur = (cents: number) =>
  (cents / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR", minimumFractionDigits: cents % 100 ? 2 : 0 });

type LoanLike = Pick<Loan, "kind" | "item" | "amountCents" | "repaidCents">;
export const isMoney = (l: LoanLike) => l.kind === "MONEY" && !!l.amountCents;
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

/**
 * Avant d'écrire à un nouvel emprunteur (création d'un prêt ou changement d'adresse) : adresse du prêteur
 * prouvée, conditions en vigueur acceptées, structure nommée (elle est responsable des données de ses
 * emprunteurs, art. 14 RGPD), puis anti-abus : plafond de nouveaux prêts sur 24 h selon l'offre (écrit dans
 * les CGU) et plafond d'e-mails reçus par le destinataire. Compté dans le journal EmailLog : supprimer et
 * recréer un prêt, changer l'adresse d'un prêt existant ou redémarrer le serveur ne remet rien à zéro.
 * Renvoie le refus à transmettre tel quel au client, ou null.
 */
export async function newBorrowerRefusal(user: User, borrowerEmail: string, borrowerName: string) {
  if (!user.emailVerifiedAt) {
    return { status: 403, error: "Confirme d'abord ton adresse e-mail avec le lien reçu à l'inscription.", code: "EMAIL_NOT_VERIFIED" };
  }
  if (borrowerEmail === user.email) return { status: 400, error: "Tu ne peux pas te prêter quelque chose à toi-même" };
  if (!termsUpToDate(user)) {
    return { status: 403, error: "Nos conditions ont changé : Prêt Matériel est désormais réservé aux professionnels. Accepte-les (bandeau en haut de l'application) pour enregistrer de nouveaux prêts.", code: "TERMS_UPDATE_REQUIRED" };
  }
  if (!user.organization) {
    return { status: 403, error: "Indique d'abord le nom de ta structure dans Mon compte : il figure dans les e-mails et les documents envoyés à tes emprunteurs.", code: "ORGANIZATION_REQUIRED" };
  }
  const { maxNewLoansPerDay: perDay } = await limitsFor(user);
  if (perDay === 0) {
    return { status: 402, error: "Un abonnement est nécessaire pour écrire à un nouvel emprunteur : choisis l'offre Entreprise.", code: "SUBSCRIPTION_REQUIRED" };
  }
  const createdToday = await prisma.emailLog.count({
    where: { senderId: user.id, kind: "loan_created", createdAt: { gt: new Date(Date.now() - 86400000) } },
  });
  if (createdToday >= perDay) {
    return { status: 429, error: `Tu as déjà enregistré ${perDay} emprunteurs ces dernières 24 heures. Réessaie demain.`, code: "DAILY_LIMIT" };
  }
  if ((await thirdPartyMailsToday(borrowerEmail)) >= MAIL_LIMITS.perRecipientPerDay) {
    return { status: 429, error: `${borrowerName} a déjà reçu plusieurs e-mails de Prêt Matériel aujourd'hui : réessaie demain.` };
  }
  return null;
}

const thirdParty = (lender: User) => ({ lenderName: lender.name, lenderId: lender.id, organization: lender.organization });
const dueText = (l: LoanLike & Pick<Loan, "dueAt">) => `${isMoney(l) ? "à rembourser" : "à rendre"} le ${fmtDate(l.dueAt)}`;

/**
 * Demande de signature de l'accusé de réception : e-mail à l'emprunteur avec son lien personnel, et
 * notification dans l'appli s'il a un compte. `new` : nouveau prêt ou nouvel emprunteur (compté dans le
 * plafond de nouveaux prêts par jour) ; `update` : prêt modifié ; `resend` / `reminder` : relance.
 * Renvoie false si l'e-mail n'est pas parti (désinscription, plafond du destinataire, panne).
 */
export async function sendSignRequest(loan: Loan, lender: User, reason: "new" | "update" | "resend" | "reminder") {
  const from = lenderLabel(lender);
  const short = isMoney(loan) ? eur(loan.amountCents!) : `« ${loan.item} »`;
  const subject = {
    new: `${lender.organization ?? lender.name} vous a prêté ${short} : accusé de réception à signer`,
    update: `Prêt modifié par ${lender.organization ?? lender.name} : nouvel accusé de réception à signer`,
    resend: `Accusé de réception à signer : ${short} prêté par ${lender.organization ?? lender.name}`,
    reminder: `Rappel : accusé de réception à signer pour ${short}`,
  }[reason];
  const sent = await sendMail({
    to: loan.borrowerEmail,
    kind: reason === "new" ? "loan_created" : "loan_sign_request",
    subject,
    title: `Bonjour ${loan.borrowerName},`,
    paragraphs: [
      reason === "update"
        ? `${from} a modifié le prêt enregistré à votre nom : ${what(loan)}, prêté le ${fmtDate(loan.lentAt)}, ${dueText(loan)}. Merci de vérifier et de signer la nouvelle version de l'accusé de réception.`
        : `${from} vous a prêté ${what(loan)} le ${fmtDate(loan.lentAt)}, ${dueText(loan)}.`,
      "Merci de vérifier le récapitulatif et de signer l'accusé de réception en ligne : cela prend une minute, sans créer de compte. Vous recevrez une copie du document signé, en PDF.",
      "Si ce prêt ne vous concerne pas ou comporte une erreur, vous pouvez le contester depuis la même page.",
    ],
    cta: { label: "Lire et signer l'accusé de réception", url: signUrl(loan) },
    thirdParty: thirdParty(lender),
  });
  if (loan.borrowerId && (reason === "new" || reason === "update")) {
    await notify(loan.borrowerId, "Accusé de réception à signer", `${from} : ${what(loan)}, ${dueText(loan)}.`, "/emprunts");
  }
  return sent;
}

/** Nouveau prêt (ou nouvel emprunteur sur un prêt) : demande de signature de l'accusé de réception. */
export async function onLoanCreated(loan: Loan, lender: User) {
  return sendSignRequest(loan, lender, "new");
}

export async function onLoanReturned(loan: Loan, lender: User) {
  if (loan.borrowerId) {
    const who = lender.organization ?? lender.name;
    const msg = isMoney(loan) ? `${who} a confirmé le remboursement complet de ${what(loan)}. Le reçu signé vous a été envoyé par e-mail.` : `${who} a confirmé le retour de « ${loan.item} ». L'attestation signée vous a été envoyée par e-mail.`;
    await notify(loan.borrowerId, "Emprunt clôturé", msg, "/emprunts");
  }
}

export async function onLoanRepaid(loan: Loan, lender: User, amountCents: number) {
  if (loan.borrowerId) {
    await notify(loan.borrowerId, "Remboursement enregistré", `${lender.organization ?? lender.name} a bien reçu ${eur(amountCents)}. Reste à rembourser : ${eur(remaining(loan))}. Le reçu signé vous a été envoyé par e-mail.`, "/emprunts");
  }
}

/** Dans les rappels d'un prêt pas encore signé : invitation à signer, avec le même lien. */
const unsignedNote = (loan: Pick<Loan, "ackStatus">) =>
  loan.ackStatus === "PENDING" ? ["Vous n'avez pas encore signé l'accusé de réception de ce prêt : vous pouvez le faire depuis le lien ci-dessous."] : [];
const loanCta = (loan: Loan) => ({ label: loan.ackStatus === "PENDING" ? "Voir et signer l'accusé de réception" : "Voir le prêt", url: signUrl(loan) });

/** Relance manuelle ou automatique pour un prêt en retard. Renvoie false si l'e-mail n'est pas parti. */
export async function sendOverdueReminder(loan: Loan & { lender: User }) {
  const days = Math.max(1, calendarDays(loan.dueAt, new Date()));
  const sent = await sendMail({
    to: loan.borrowerEmail,
    kind: "loan_overdue",
    subject: isMoney(loan) ? `Rappel : ${eur(remaining(loan))} à rembourser à ${loan.lender.organization ?? loan.lender.name}` : `Rappel : « ${loan.item} » à rendre à ${loan.lender.organization ?? loan.lender.name}`,
    title: `Bonjour ${loan.borrowerName},`,
    paragraphs: [
      isMoney(loan)
        ? `Petit rappel : ${toGiveBack(loan)}, prêtés par ${lenderLabel(loan.lender)}, devaient être remboursés le ${fmtDate(loan.dueAt)} (il y a ${days} jour${days > 1 ? "s" : ""}).`
        : `Petit rappel : « ${loan.item} », prêté par ${lenderLabel(loan.lender)}, devait être rendu le ${fmtDate(loan.dueAt)} (il y a ${days} jour${days > 1 ? "s" : ""}).`,
      `Pensez à ${isMoney(loan) ? "rembourser" : "le rendre"} dès que possible. Vous pouvez contacter ${loan.lender.name} à ${loan.lender.email}.`,
      ...unsignedNote(loan),
    ],
    cta: loanCta(loan),
    thirdParty: thirdParty(loan.lender),
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
 *  - accusé de réception pas signé 48 h après la demande : une relance à l'emprunteur, le prêteur est prévenu
 *    (sauf si l'échéance est proche : le rappel de la veille ou de retard contient déjà le lien de signature)
 *  - veille de l'échéance : rappel à l'emprunteur
 *  - échéance dépassée : alerte au prêteur (une fois) + relance à l'emprunteur tous les 3 jours,
 *    jusqu'à MAIL_LIMITS.remindersPerLoan rappels ; le prêteur est alors prévenu que les relances s'arrêtent
 * Un prêt contesté par l'emprunteur ne donne plus lieu à aucun rappel.
 * `reminderCount` compte tous les rappels de la vie du prêt : changer la date de retour ne le remet pas
 * à zéro (sinon on pourrait relancer sans fin), seul un changement d'emprunteur le fait.
 */
export async function runReminders(now = new Date()) {
  let soon = 0, overdue = 0, signatures = 0;
  const hour = parisHour(now);
  if (hour < 9 || hour >= 21) return { soon, overdue, signatures };
  const in48h = new Date(now.getTime() + 2 * 86400000);
  const threeDaysAgo = new Date(now.getTime() - 3 * 86400000);

  const unsigned = await prisma.loan.findMany({
    where: {
      status: "ACTIVE", ackStatus: "PENDING", ackRemindedAt: null, ackRequestedAt: { lt: new Date(now.getTime() - 2 * 86400000) },
      dueAt: { gt: in48h }, reminderCount: { lt: MAIL_LIMITS.remindersPerLoan },
    },
    include: { lender: true },
  });
  for (const loan of unsigned) {
    const sent = await sendSignRequest(loan, loan.lender, "reminder");
    await prisma.loan.update({ where: { id: loan.id }, data: { ackRemindedAt: now, ...(sent ? { reminderCount: { increment: 1 } } : {}) } });
    await notify(loan.lenderId, "Accusé de réception pas encore signé",
      `${loan.borrowerName} n'a pas encore signé l'accusé de réception pour ${what(loan)}.${sent ? " Une relance vient de lui être envoyée." : ""} Sans signature, tu n'as pas de preuve écrite du prêt.`, `/prets/${loan.id}`);
    signatures++;
  }

  // L'échéance est fixée à 23 h 59 le jour du retour : on prévient la veille (jour calendaire), pas « dans les 24 h ».
  const dueSoon = (await prisma.loan.findMany({
    where: { status: "ACTIVE", ackStatus: { not: "REFUSED" }, remindBefore: true, dueAt: { gt: now, lte: in48h }, reminderCount: { lt: MAIL_LIMITS.remindersPerLoan } },
    include: { lender: true },
  })).filter((loan) => calendarDays(now, loan.dueAt) === 1
    // pas déjà prévenu pour cette échéance (un report de la date remet lastReminderAt à null)
    && (!loan.lastReminderAt || loan.lastReminderAt.getTime() < loan.dueAt.getTime() - 2 * 86400000));
  for (const loan of dueSoon) {
    await sendMail({
      to: loan.borrowerEmail,
      kind: "loan_due_soon",
      subject: `Demain : ${isMoney(loan) ? eur(remaining(loan)) : `« ${loan.item} »`} à rendre à ${loan.lender.organization ?? loan.lender.name}`,
      title: `Bonjour ${loan.borrowerName},`,
      paragraphs: [`${toGiveBack(loan)}, prêté par ${lenderLabel(loan.lender)}, est à rendre le ${fmtDate(loan.dueAt)}.`, ...unsignedNote(loan)],
      cta: loanCta(loan),
      thirdParty: thirdParty(loan.lender),
    });
    if (loan.borrowerId) await notify(loan.borrowerId, "Échéance demain", `${toGiveBack(loan)} : à rendre à ${loan.lender.name} demain.`, "/emprunts");
    await prisma.loan.update({ where: { id: loan.id }, data: { reminderCount: { increment: 1 }, lastReminderAt: now } });
    soon++;
  }

  const late = await prisma.loan.findMany({
    where: {
      status: "ACTIVE",
      ackStatus: { not: "REFUSED" },
      dueAt: { lt: now },
      reminderCount: { lt: MAIL_LIMITS.remindersPerLoan },
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
    else if (loan.reminderCount + 1 >= MAIL_LIMITS.remindersPerLoan) {
      await notify(loan.lenderId, "Fin des relances automatiques",
        `${loan.borrowerName} a reçu ${MAIL_LIMITS.remindersPerLoan} rappels pour ${toGiveBack(loan)}. Prêt Matériel n'en enverra plus : contacte cette personne directement.`, `/prets/${loan.id}`);
    }
    overdue++;
  }
  return { soon, overdue, signatures };
}
