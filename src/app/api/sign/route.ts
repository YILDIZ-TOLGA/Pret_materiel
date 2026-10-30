import { prisma } from "@/lib/db";
import { error, json, zodError } from "@/lib/api";
import { amountInWords, sameAmountInFigures, sameAmountInWords } from "@/lib/amount-words";
import { maskEmail } from "@/lib/optout";
import { signatureProof } from "@/lib/pdf-response";
import { rateLimited } from "@/lib/ratelimit";
import { NAME_PLACEHOLDER, docRef } from "@/lib/receipt-text";
import { loanStatementFor, refuseLoanAck, signLoanAck } from "@/lib/receipts";
import { parseSignToken } from "@/lib/signlink";
import { borrowerSignSchema, checkSignature } from "@/lib/validation";

/**
 * Page personnelle de l'emprunteur (lien reçu par e-mail, sans compte) : récapitulatif du prêt, signature de
 * l'accusé de réception ou contestation, copies des documents signés. Le lien chiffré désigne le prêt et la
 * version de la demande : après une modification du prêt, seul le lien du dernier e-mail est valable.
 */
type Fail = { ok: false; error: string; status: number };
async function loanFromToken(t: string) {
  const fail = (error: string, status: number): Fail => ({ ok: false, error, status });
  const parsed = parseSignToken(t);
  if (!parsed) return fail("Lien invalide : vérifiez qu'il a été copié en entier depuis l'e-mail.", 400);
  const loan = await prisma.loan.findUnique({
    where: { id: parsed.loanId },
    include: { lender: true, receipts: { orderBy: { signedAt: "desc" }, select: { id: true, number: true, kind: true, signedAt: true } } },
  });
  if (!loan) return fail("Ce prêt n'existe plus : le prêteur l'a supprimé de Prêt Matériel.", 404);
  if (loan.ackVersion !== parsed.version) return fail("Ce lien n'est plus valable : le prêt a été modifié depuis. Utilisez le lien du dernier e-mail reçu.", 410);
  return { ok: true as const, loan, version: parsed.version };
}

export async function GET(req: Request) {
  if (await rateLimited("sign-view", 120, 60 * 60 * 1000)) return error("Trop de requêtes, réessayez dans quelques minutes.", 429);
  const found = await loanFromToken(new URL(req.url).searchParams.get("t") ?? "");
  if (!found.ok) return error(found.error, found.status);
  const { loan } = found;
  const money = loan.kind === "MONEY" && !!loan.amountCents;
  return json({
    ackStatus: loan.ackStatus,
    ackAt: loan.ackAt,
    refusalReason: loan.ackStatus === "REFUSED" ? loan.ackRefusalReason : null,
    canSign: loan.ackStatus === "PENDING" && loan.status === "ACTIVE",
    loan: {
      ref: docRef(loan.id), kind: loan.kind, item: loan.item, description: loan.description, amountCents: loan.amountCents, repaidCents: loan.repaidCents,
      lentAt: loan.lentAt, dueAt: loan.dueAt, status: loan.status, returnedAt: loan.returnedAt,
    },
    lender: { organization: loan.lender.organization, name: loan.lender.name, email: loan.lender.email },
    borrower: { name: loan.borrowerName, email: maskEmail(loan.borrowerEmail) },
    // aperçu de la déclaration, avec le nom à compléter : le texte signé est construit par le même code
    statement: loanStatementFor(NAME_PLACEHOLDER, loan, loan.lender),
    amountWords: money ? amountInWords(loan.amountCents!) : null,
    documents: loan.receipts,
  });
}

export async function POST(req: Request) {
  if (await rateLimited("sign", 20, 60 * 60 * 1000)) return error("Trop de tentatives, réessayez dans quelques minutes.", 429);
  const parsed = borrowerSignSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return zodError(parsed.error);
  const body = parsed.data;
  const found = await loanFromToken(body.t);
  if (!found.ok) return error(found.error, found.status);
  const { loan, version } = found;
  if (loan.status !== "ACTIVE") return error("Ce prêt est déjà clôturé.", 409);
  if (loan.ackStatus === "SIGNED") return error("Vous avez déjà signé cet accusé de réception.", 409);
  if (loan.ackStatus === "REFUSED") return error("Vous avez contesté ce prêt. Si c'est une erreur, contactez le prêteur : il pourra vous renvoyer une demande.", 409);
  if (loan.ackStatus !== "PENDING") return error("Aucun accusé de réception n'est demandé pour ce prêt.", 409);

  if (body.action === "refuse") {
    const ok = await refuseLoanAck(loan, version, body.reason || null);
    return ok ? json({ ok: true }) : error("Le prêt vient d'être modifié : rechargez la page.", 409);
  }

  const sigError = checkSignature(body.signature);
  if (sigError) return error(sigError);
  let mention: { words: string; figures: string } | undefined;
  if (loan.kind === "MONEY" && loan.amountCents) {
    // somme écrite par l'emprunteur lui-même, en toutes lettres et en chiffres (art. 1376 et 1174 C. civ.)
    if (!body.amountWords || !sameAmountInWords(body.amountWords, loan.amountCents)) {
      return error(`Écrivez la somme en toutes lettres, exactement : « ${amountInWords(loan.amountCents)} ».`);
    }
    if (!body.amountFigures || !sameAmountInFigures(body.amountFigures, loan.amountCents)) {
      return error("Écrivez la somme en chiffres, par exemple « 500 » ou « 500,00 ».");
    }
    mention = { words: body.amountWords, figures: body.amountFigures };
  }
  const receipt = await signLoanAck(loan, version, { signerName: body.signerName, signature: body.signature, mention }, await signatureProof(req));
  if (!receipt) return error("Le prêt vient d'être modifié ou signé : rechargez la page.", 409);
  return json({ ok: true, receipt: { id: receipt.id, number: receipt.number, signedAt: receipt.signedAt } });
}
