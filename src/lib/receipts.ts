import { createHash, randomBytes } from "node:crypto";
import type { Loan, Prisma, Receipt, ReceiptKind, User } from "@prisma/client";
import { prisma } from "./db";
import { LEGAL } from "./legal";
import { eur, fmtDate, isMoney, notify, what } from "./loans";
import { sendMail } from "./mail";
import { receiptPdf, type PdfReceipt } from "./pdf";
import { DOC_PREFIX, DOC_TITLES, docDateTime, docRef, lenderLabel, loanStatement, repaymentStatement, returnStatement, type ReceiptContent } from "./receipt-text";
import { signUrl } from "./signlink";
import type { SignatureData } from "./signature";

/**
 * Documents signés électroniquement (signature électronique simple, art. 1366 et 1367 C. civ.) :
 *  - accusé de réception du prêt, signé par l'emprunteur depuis son lien personnel ;
 *  - reçu de remboursement et attestation de restitution, signés par le prêteur depuis son compte.
 * Chaque document est figé à la signature (contenu lu, tracé, éléments de preuve, empreinte SHA-256), puis
 * envoyé en PDF aux deux parties : le prêteur doit l'imprimer et le garder, Prêt Matériel n'archive pas (CGU).
 */
const appUrl = () => process.env.APP_URL || "http://localhost:3000";
type Proof = { ip: string | null; userAgent: string | null };
type Lender = Pick<User, "id" | "name" | "email" | "organization">;

/** JSON aux clés triées : l'empreinte se recalcule à l'identique depuis la base (PostgreSQL réordonne les clés). */
function canonical(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonical).join(",")}]`;
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    return `{${Object.keys(o).filter((k) => o[k] !== undefined).sort().map((k) => `${JSON.stringify(k)}:${canonical(o[k])}`).join(",")}}`;
  }
  return JSON.stringify(v ?? null);
}

type Hashed = Pick<Receipt, "number" | "kind" | "signerName" | "signerEmail" | "signedAt" | "ip" | "userAgent"> & { content: unknown; signature: unknown };
/** Empreinte SHA-256 du document signé : contenu, tracé, signataire, date et éléments de preuve. */
export const receiptHash = (r: Hashed) => createHash("sha256").update(canonical({
  number: r.number, kind: r.kind, content: r.content, signature: r.signature, signerName: r.signerName,
  signerEmail: r.signerEmail, signedAt: r.signedAt.toISOString(), ip: r.ip, userAgent: r.userAgent,
})).digest("hex");

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const newNumber = (kind: ReceiptKind) => `${DOC_PREFIX[kind]}-${[...randomBytes(8)].map((b) => ALPHABET[b % 32]).join("")}`;

const docLoan = (l: Loan) => ({ kind: l.kind, item: l.item, description: l.description, amountCents: l.amountCents, lentAt: l.lentAt.toISOString(), dueAt: l.dueAt.toISOString() });

/** Parties et prêt, communs aux trois documents. */
function docBase(kind: ReceiptKind, loan: Loan, lender: Lender) {
  return {
    title: DOC_TITLES[kind],
    ref: docRef(loan.id),
    lender: { organization: lender.organization, name: lender.name, email: lender.email },
    borrower: { name: loan.borrowerName, email: loan.borrowerEmail, phone: loan.borrowerPhone },
    loan: docLoan(loan),
  };
}

/** Texte que l'emprunteur lit puis signe (aperçu de la page de signature, avec le nom à compléter). */
export const loanStatementFor = (signer: string, loan: Loan, lender: Lender) => loanStatement(signer, lender, docLoan(loan));

/** Numéro de l'accusé de réception signé le plus récent du prêt, rappelé sur les reçus. */
async function ackNumber(tx: Prisma.TransactionClient, loanId: string) {
  return (await tx.receipt.findFirst({ where: { loanId, kind: "LOAN" }, orderBy: { signedAt: "desc" }, select: { number: true } }))?.number ?? null;
}

async function createReceipt(tx: Prisma.TransactionClient, d: {
  kind: ReceiptKind; loanId: string; repaymentId?: string; content: ReceiptContent; signature: SignatureData; signerName: string; signerEmail: string;
} & Proof) {
  const signedAt = new Date();
  const number = newNumber(d.kind);
  const hash = receiptHash({ ...d, number, signedAt });
  return tx.receipt.create({
    data: { ...d, number, signedAt, hash, content: d.content as unknown as Prisma.InputJsonValue, signature: d.signature as unknown as Prisma.InputJsonValue },
  });
}

/** L'emprunteur signe l'accusé de réception (version `version` de la demande). null : déjà signé, contesté ou modifié entre-temps. */
export async function signLoanAck(loan: Loan & { lender: User }, version: number, s: { signerName: string; signature: SignatureData; mention?: { words: string; figures: string } }, proof: Proof) {
  const content: ReceiptContent = {
    ...docBase("LOAN", loan, loan.lender),
    statement: loanStatementFor(s.signerName, loan, loan.lender),
    ...(s.mention ? { mention: s.mention } : {}),
  };
  const receipt = await prisma.$transaction(async (tx) => {
    const { count } = await tx.loan.updateMany({
      where: { id: loan.id, status: "ACTIVE", ackStatus: "PENDING", ackVersion: version },
      data: { ackStatus: "SIGNED", ackAt: new Date(), ackRefusalReason: null },
    });
    if (!count) return null;
    return createReceipt(tx, { kind: "LOAN", loanId: loan.id, content, signature: s.signature, signerName: s.signerName, signerEmail: loan.borrowerEmail, ...proof });
  });
  if (receipt) await deliverReceipt(receipt, loan);
  return receipt;
}

/** L'emprunteur conteste le prêt : plus aucun rappel, le prêteur est prévenu (dans l'appli et par e-mail). */
export async function refuseLoanAck(loan: Loan & { lender: User }, version: number, reason: string | null) {
  const { count } = await prisma.loan.updateMany({
    where: { id: loan.id, status: "ACTIVE", ackStatus: "PENDING", ackVersion: version },
    data: { ackStatus: "REFUSED", ackAt: new Date(), ackRefusalReason: reason },
  });
  if (!count) return false;
  const msg = `${loan.borrowerName} conteste le prêt de ${what(loan)} et n'a pas signé l'accusé de réception${reason ? ` : « ${reason} »` : "."}`;
  await notify(loan.lenderId, "Prêt contesté", msg, `/prets/${loan.id}`);
  await sendMail({
    to: loan.lender.email,
    kind: "loan_refused",
    subject: `${loan.borrowerName} conteste le prêt de ${isMoney(loan) ? eur(loan.amountCents!) : `« ${loan.item} »`}`,
    title: `Bonjour ${loan.lender.name},`,
    paragraphs: [
      msg,
      "Prêt Matériel n'enverra plus de rappel à cette personne pour ce prêt. Si c'est une erreur de saisie (montant, objet, date, adresse), corrige le prêt : une nouvelle demande de signature partira. Sinon, contacte-la directement ou supprime le prêt.",
    ],
    cta: { label: "Voir le prêt", url: `${appUrl()}/prets/${loan.id}` },
  });
  return true;
}

/** Contenu du reçu d'un remboursement, signé par le prêteur. */
export async function repaymentReceipt(tx: Prisma.TransactionClient, loan: Loan, lender: Lender, p: {
  repaymentId: string; amountCents: number; repaidBeforeCents: number; note: string | null; signerName: string; signature: SignatureData;
} & Proof) {
  const repaidAfterCents = p.repaidBeforeCents + p.amountCents;
  const content: ReceiptContent = {
    ...docBase("REPAYMENT", loan, lender),
    statement: repaymentStatement(p.signerName, lender, loan.borrowerName, docLoan(loan), { amountCents: p.amountCents, repaidAfterCents }),
    ackNumber: await ackNumber(tx, loan.id),
    payment: { amountCents: p.amountCents, repaidBeforeCents: p.repaidBeforeCents, repaidAfterCents, remainingCents: Math.max(0, (loan.amountCents ?? 0) - repaidAfterCents), note: p.note },
  };
  return createReceipt(tx, { kind: "REPAYMENT", loanId: loan.id, repaymentId: p.repaymentId, content, signature: p.signature, signerName: p.signerName, signerEmail: lender.email, ip: p.ip, userAgent: p.userAgent });
}

/** Contenu de l'attestation de restitution d'un objet, signée par le prêteur. */
export async function returnReceipt(tx: Prisma.TransactionClient, loan: Loan, lender: Lender, p: { note: string | null; signerName: string; signature: SignatureData } & Proof) {
  const content: ReceiptContent = {
    ...docBase("RETURN", loan, lender),
    statement: returnStatement(p.signerName, lender, loan.borrowerName, docLoan(loan), p.note),
    ackNumber: await ackNumber(tx, loan.id),
    returned: { note: p.note },
  };
  return createReceipt(tx, { kind: "RETURN", loanId: loan.id, content, signature: p.signature, signerName: p.signerName, signerEmail: lender.email, ip: p.ip, userAgent: p.userAgent });
}

export const toPdfReceipt = (r: Receipt): PdfReceipt => ({ ...r, content: r.content as unknown as ReceiptContent, signature: r.signature as unknown as SignatureData });
export const receiptPdfOf = async (r: Receipt) => Buffer.from(await receiptPdf(toPdfReceipt(r)));

/**
 * Envoie le document signé en PDF : au prêteur, qui doit l'imprimer et le garder, et à l'emprunteur (copie).
 * Notifications dans l'appli. Un envoi qui échoue n'annule rien : le document reste téléchargeable.
 */
export async function deliverReceipt(receipt: Receipt, loan: Loan & { lender: User }) {
  const lender = loan.lender;
  const c = receipt.content as unknown as ReceiptContent;
  let pdf: Buffer | null = null;
  try { pdf = await receiptPdfOf(receipt); } catch (e) { console.error("PDF du document signé", receipt.number, e); }
  const attachments = pdf ? [{ filename: `${receipt.number}.pdf`, content: pdf, contentType: "application/pdf" }] : undefined;
  const attached = pdf ? `Le document signé est joint à cet e-mail (PDF n° ${receipt.number}).` : `Le document signé (n° ${receipt.number}) est à télécharger depuis l'application.`;
  const who = lender.organization ?? lender.name;
  const paid = c.payment;

  const forLender = {
    LOAN: { subject: `Accusé de réception signé par ${loan.borrowerName} : à imprimer`, intro: `${loan.borrowerName} a signé l'accusé de réception du prêt de ${what(loan)}, le ${docDateTime(receipt.signedAt)}.` },
    REPAYMENT: { subject: `Reçu de remboursement signé : ${paid ? eur(paid.amountCents) : ""} de ${loan.borrowerName}`, intro: `Tu as signé le reçu du remboursement de ${paid ? eur(paid.amountCents) : ""} par ${loan.borrowerName}. Une copie lui a été envoyée.` },
    RETURN: { subject: `Attestation de restitution signée : « ${loan.item} »`, intro: `Tu as signé l'attestation de restitution de « ${loan.item} » par ${loan.borrowerName}. Une copie lui a été envoyée.` },
  }[receipt.kind];
  await sendMail({
    to: lender.email,
    kind: "receipt_lender",
    subject: forLender.subject,
    title: `Bonjour ${lender.name},`,
    paragraphs: [
      forLender.intro,
      `${attached} Imprime-le et range-le avec tes papiers : c'est ta preuve${receipt.kind === "LOAN" ? " du prêt" : ""}.`,
      `${LEGAL.siteName} n'est pas un service d'archivage : si le prêt ou ton compte est supprimé, en cas d'arrêt du service ou d'incident technique, le document peut ne plus être disponible dans l'application (conditions générales, article 3 bis).`,
    ],
    cta: { label: "Voir le prêt", url: `${appUrl()}/prets/${loan.id}` },
    attachments,
  });

  const forBorrower = {
    LOAN: {
      subject: `Votre copie de l'accusé de réception signé (${who})`,
      paragraphs: [
        `Vous avez signé le ${docDateTime(receipt.signedAt)} l'accusé de réception du prêt de ${what(loan)} consenti par ${lenderLabel(lender)}, ${isMoney(loan) ? "à rembourser" : "à rendre"} le ${fmtDate(loan.dueAt)}.`,
        `${attached} Conservez-le.`,
      ],
    },
    REPAYMENT: {
      subject: `Reçu de votre remboursement de ${paid ? eur(paid.amountCents) : ""} (${who})`,
      paragraphs: [
        `${lenderLabel(lender)} confirme avoir reçu ${paid ? eur(paid.amountCents) : ""} en remboursement du prêt de ${loan.amountCents ? eur(loan.amountCents) : ""} consenti le ${fmtDate(loan.lentAt)}. ${paid && paid.remainingCents > 0 ? `Reste dû : ${eur(paid.remainingCents)}.` : "Le prêt est intégralement remboursé."}`,
        `${attached} Conservez-le : il prouve votre paiement.`,
      ],
    },
    RETURN: {
      subject: `Attestation de restitution : « ${loan.item} » (${who})`,
      paragraphs: [
        `${lenderLabel(lender)} atteste que vous avez rendu « ${loan.item} », prêté le ${fmtDate(loan.lentAt)}.`,
        `${attached} Conservez-la : elle prouve que vous avez rendu le bien.`,
      ],
    },
  }[receipt.kind];
  await sendMail({
    to: loan.borrowerEmail,
    kind: `receipt_${receipt.kind.toLowerCase()}`,
    subject: forBorrower.subject,
    title: `Bonjour ${loan.borrowerName},`,
    paragraphs: forBorrower.paragraphs,
    cta: { label: "Voir le prêt", url: signUrl(loan) },
    thirdParty: { lenderName: lender.name, lenderId: lender.id, organization: lender.organization },
    attachments,
  });

  if (receipt.kind === "LOAN") {
    await notify(loan.lenderId, "Accusé de réception signé", `${loan.borrowerName} a signé l'accusé de réception pour ${what(loan)}. Imprime le document et garde-le.`, `/prets/${loan.id}`);
    if (loan.borrowerId) await notify(loan.borrowerId, "Accusé de réception signé", `Votre copie pour ${what(loan)} vous a été envoyée par e-mail.`, "/emprunts");
  }
}

/** Résumé d'un document pour les listes (fiche du prêt, emprunts). */
export const receiptSummary = { id: true, number: true, kind: true, signedAt: true, signerName: true, repaymentId: true } as const;
