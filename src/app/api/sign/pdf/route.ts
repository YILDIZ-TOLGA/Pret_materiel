import { prisma } from "@/lib/db";
import { error } from "@/lib/api";
import { pdfResponse } from "@/lib/pdf-response";
import { rateLimited } from "@/lib/ratelimit";
import { receiptPdfOf } from "@/lib/receipts";
import { parseSignToken } from "@/lib/signlink";

/** Copie d'un document signé du prêt, pour l'emprunteur, depuis son lien personnel (sans compte). */
export async function GET(req: Request) {
  if (await rateLimited("sign-pdf", 60, 60 * 60 * 1000)) return error("Trop de téléchargements, réessayez dans quelques minutes.", 429);
  const q = new URL(req.url).searchParams;
  const parsed = parseSignToken(q.get("t") ?? "");
  if (!parsed) return error("Lien invalide", 400);
  const receipt = await prisma.receipt.findUnique({ where: { id: q.get("r") ?? "" }, include: { loan: { select: { ackVersion: true } } } });
  if (!receipt || receipt.loanId !== parsed.loanId) return error("Document introuvable", 404);
  if (receipt.loan.ackVersion !== parsed.version) return error("Ce lien n'est plus valable : utilisez le lien du dernier e-mail reçu.", 410);
  return pdfResponse(await receiptPdfOf(receipt), `${receipt.number}.pdf`);
}
