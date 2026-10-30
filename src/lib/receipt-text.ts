import { amountInFigures, amountInWords } from "./amount-words";

/**
 * Textes des documents signés : accusé de réception (emprunteur), reçu de remboursement et attestation de
 * restitution (prêteur). Le même code construit l'aperçu affiché avant de signer et le texte enregistré
 * à la signature : ce qui est signé est exactement ce qui a été lu. Sans dépendance (navigateur et serveur).
 */
export type DocKind = "LOAN" | "REPAYMENT" | "RETURN";
export type DocLender = { organization: string | null; name: string; email: string };
export type DocLoan = { kind: "OBJECT" | "MONEY"; item: string; description: string | null; amountCents: number | null; lentAt: string; dueAt: string };

/** Contenu figé d'un document, enregistré dans Receipt.content. */
export type ReceiptContent = {
  title: string;
  // numéro de fiche du prêt, comme dans l'application
  ref: string;
  lender: DocLender;
  borrower: { name: string; email: string; phone: string | null };
  loan: DocLoan;
  statement: string[];
  // reçus : numéro de l'accusé de réception du prêt, s'il a été signé
  ackNumber?: string | null;
  payment?: { amountCents: number; repaidBeforeCents: number; repaidAfterCents: number; remainingCents: number; note: string | null };
  returned?: { note: string | null };
  // prêt d'argent : somme écrite par l'emprunteur lui-même, en lettres et en chiffres (art. 1376 C. civ.)
  mention?: { words: string; figures: string };
};

export const DOC_TITLES: Record<DocKind, string> = {
  LOAN: "Accusé de réception de prêt",
  REPAYMENT: "Reçu de remboursement",
  RETURN: "Attestation de restitution",
};

/** Préfixe du numéro imprimé sur le document. */
export const DOC_PREFIX: Record<DocKind, string> = { LOAN: "AR", REPAYMENT: "RR", RETURN: "AT" };

export const NAME_PLACEHOLDER = "[nom et prénom]";

/** « 3 octobre 2026 », heure de Paris (la même date sur le serveur et dans le navigateur). */
export const docDay = (d: string | Date) => new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Paris" });
/** « 3 octobre 2026 à 14:32 » */
export const docDateTime = (d: string | Date) => `${docDay(d)} à ${new Date(d).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" })}`;

/** « Atelier Martin (Claire Martin) », ou le nom seul pour un compte sans structure. */
export const lenderLabel = (l: { organization: string | null; name: string }) => (l.organization ? `${l.organization} (${l.name})` : l.name);
export const docRef = (loanId: string) => loanId.slice(-5).toUpperCase();

/** « de Julien », « d'Atelier Martin » (élision devant une voyelle). */
export const de = (name: string) => (/^[aeiouyàâäéèêëîïôöùûüœæ]/i.test(name.trim()) ? `d'${name}` : `de ${name}`);

/** « cinq cents euros (500 €) » */
const sum = (cents: number) => `${amountInWords(cents)} (${amountInFigures(cents)})`;
const isMoneyLoan = (l: DocLoan) => l.kind === "MONEY" && !!l.amountCents;
const motive = (l: DocLoan) => (l.item && l.item !== "Prêt d'argent" ? `, pour le motif suivant : ${l.item}` : "");
const forOrg = (l: { organization: string | null }) => (l.organization ? `, agissant pour ${l.organization},` : "");

/** Déclaration de l'accusé de réception, signée par l'emprunteur. */
export function loanStatement(signer: string, lender: { organization: string | null; name: string }, loan: DocLoan) {
  const from = lenderLabel(lender);
  if (isMoneyLoan(loan)) {
    return [
      `Je soussigné(e) ${signer} reconnais avoir reçu ${de(from)}, le ${docDay(loan.lentAt)}, à titre de prêt, la somme de ${sum(loan.amountCents!)}${motive(loan)}.`,
      `Je m'engage à rembourser cette somme au plus tard le ${docDay(loan.dueAt)}.`,
    ];
  }
  return [
    `Je soussigné(e) ${signer} reconnais avoir reçu ${de(from)}, le ${docDay(loan.lentAt)}, à titre de prêt, le bien suivant : ${loan.item}${loan.description ? ` (${loan.description})` : ""}.`,
    `Je m'engage à en prendre soin et à le restituer au plus tard le ${docDay(loan.dueAt)}.`,
  ];
}

/** Déclaration du reçu de remboursement, signée par le prêteur. */
export function repaymentStatement(signer: string, lender: { organization: string | null }, borrowerName: string, loan: DocLoan,
  p: { amountCents: number; repaidAfterCents: number }) {
  const total = loan.amountCents ?? 0;
  const rest = Math.max(0, total - p.repaidAfterCents);
  return [
    `Je soussigné(e) ${signer}${forOrg(lender)} reconnais avoir reçu ${de(borrowerName)} la somme de ${sum(p.amountCents)}, en remboursement du prêt de ${amountInFigures(total)} consenti le ${docDay(loan.lentAt)}.`,
    rest > 0
      ? `Total remboursé à ce jour : ${amountInFigures(p.repaidAfterCents)} sur ${amountInFigures(total)}. Reste dû : ${amountInFigures(rest)}.`
      : `Total remboursé : ${amountInFigures(total)}. Le prêt est intégralement remboursé.`,
  ];
}

/** Déclaration de l'attestation de restitution, signée par le prêteur. */
export function returnStatement(signer: string, lender: { organization: string | null }, borrowerName: string, loan: DocLoan, note: string | null) {
  return [
    `Je soussigné(e) ${signer}${forOrg(lender)} atteste que ${borrowerName} a restitué le bien suivant : ${loan.item}, prêté le ${docDay(loan.lentAt)}.`,
    note ? `Observations sur l'état du bien au retour : ${note}` : "Aucune observation sur l'état du bien au retour.",
  ];
}
