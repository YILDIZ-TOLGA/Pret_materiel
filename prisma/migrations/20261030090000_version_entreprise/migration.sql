-- Version Entreprise : une seule offre payante (Entreprise, annuelle), accusés de réception signés et reçus.

-- 1. Offres. Les anciennes offres payantes (Perso, Pro 50, Pro 200 : jamais vendues, le site était en phase de
--    test) deviennent l'offre Entreprise, avec la même date de fin : aucun compte ne perd ce qu'on lui avait offert.
CREATE TYPE "Plan_new" AS ENUM ('FREE', 'ENTREPRISE_YEARLY');
ALTER TABLE "User" ALTER COLUMN "plan" DROP DEFAULT;
ALTER TABLE "User" ALTER COLUMN "plan" TYPE "Plan_new"
  USING (CASE WHEN "plan"::text = 'FREE' THEN 'FREE' ELSE 'ENTREPRISE_YEARLY' END)::"Plan_new";
ALTER TABLE "Payment" ALTER COLUMN "plan" TYPE "Plan_new"
  USING (CASE WHEN "plan"::text = 'FREE' THEN 'FREE' ELSE 'ENTREPRISE_YEARLY' END)::"Plan_new";
ALTER TYPE "Plan" RENAME TO "Plan_old";
ALTER TYPE "Plan_new" RENAME TO "Plan";
DROP TYPE "Plan_old";
ALTER TABLE "User" ALTER COLUMN "plan" SET DEFAULT 'FREE';

-- 2. Accusés de réception et documents signés
CREATE TYPE "AckStatus" AS ENUM ('NONE', 'PENDING', 'SIGNED', 'REFUSED');
CREATE TYPE "ReceiptKind" AS ENUM ('LOAN', 'REPAYMENT', 'RETURN');

-- Les prêts déjà enregistrés n'ont pas d'accusé (NONE) ; les nouveaux attendent la signature (PENDING).
ALTER TABLE "Loan" ADD COLUMN "ackAt" TIMESTAMP(3),
ADD COLUMN "ackRefusalReason" TEXT,
ADD COLUMN "ackRemindedAt" TIMESTAMP(3),
ADD COLUMN "ackRequestedAt" TIMESTAMP(3),
ADD COLUMN "ackStatus" "AckStatus" NOT NULL DEFAULT 'NONE',
ADD COLUMN "ackVersion" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Loan" ALTER COLUMN "ackStatus" SET DEFAULT 'PENDING';

CREATE TABLE "Receipt" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "kind" "ReceiptKind" NOT NULL,
    "loanId" TEXT NOT NULL,
    "repaymentId" TEXT,
    "content" JSONB NOT NULL,
    "signature" JSONB NOT NULL,
    "signerName" TEXT NOT NULL,
    "signerEmail" TEXT NOT NULL,
    "signedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip" TEXT,
    "userAgent" TEXT,
    "hash" TEXT NOT NULL,
    "downloadedAt" TIMESTAMP(3),

    CONSTRAINT "Receipt_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Receipt_number_key" ON "Receipt"("number");
CREATE UNIQUE INDEX "Receipt_repaymentId_key" ON "Receipt"("repaymentId");
CREATE INDEX "Receipt_loanId_idx" ON "Receipt"("loanId");

ALTER TABLE "Receipt" ADD CONSTRAINT "Receipt_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "Loan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Receipt" ADD CONSTRAINT "Receipt_repaymentId_fkey" FOREIGN KEY ("repaymentId") REFERENCES "Repayment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
