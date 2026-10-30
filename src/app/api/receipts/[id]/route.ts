import { prisma } from "@/lib/db";
import { error, withUser } from "@/lib/api";
import { pdfResponse } from "@/lib/pdf-response";
import { receiptPdfOf } from "@/lib/receipts";

type Ctx = { params: Promise<{ id: string }> };

/**
 * PDF d'un document signé, pour le prêteur ou pour l'emprunteur qui a un compte (adresse confirmée).
 * Le premier téléchargement par le prêteur est noté : jusque-là, l'appli lui rappelle d'imprimer le document.
 */
export const GET = withUser<Ctx>(async (user, _req, { params }) => {
  const receipt = await prisma.receipt.findUnique({ where: { id: (await params).id }, include: { loan: { select: { lenderId: true, borrowerId: true, borrowerEmail: true } } } });
  const lender = receipt?.loan.lenderId === user.id;
  const borrower = !!receipt && (receipt.loan.borrowerId === user.id || (!!user.emailVerifiedAt && receipt.loan.borrowerEmail === user.email));
  if (!receipt || (!lender && !borrower)) return error("Document introuvable", 404);
  const pdf = await receiptPdfOf(receipt);
  if (lender && !receipt.downloadedAt) await prisma.receipt.update({ where: { id: receipt.id }, data: { downloadedAt: new Date() } });
  return pdfResponse(pdf, `${receipt.number}.pdf`);
});
