-- AlterTable
ALTER TABLE "EmailLog" ADD COLUMN     "senderId" TEXT,
ADD COLUMN     "thirdParty" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "EmailLog_senderId_kind_createdAt_idx" ON "EmailLog"("senderId", "kind", "createdAt");

-- CreateIndex
CREATE INDEX "EmailLog_to_createdAt_idx" ON "EmailLog"("to", "createdAt");

-- AddForeignKey
ALTER TABLE "EmailLog" ADD CONSTRAINT "EmailLog_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Les e-mails déjà envoyés aux emprunteurs comptent dans les plafonds par destinataire
UPDATE "EmailLog" SET "thirdParty" = true WHERE "kind" IN ('loan_created', 'loan_due_soon', 'loan_overdue');
