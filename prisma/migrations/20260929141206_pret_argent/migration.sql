-- CreateEnum
CREATE TYPE "LoanKind" AS ENUM ('OBJECT', 'MONEY');

-- AlterTable
ALTER TABLE "Loan" ADD COLUMN     "amountCents" INTEGER,
ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'eur',
ADD COLUMN     "kind" "LoanKind" NOT NULL DEFAULT 'OBJECT',
ADD COLUMN     "repaidCents" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "Repayment" (
    "id" TEXT NOT NULL,
    "loanId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Repayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Repayment_loanId_idx" ON "Repayment"("loanId");

-- AddForeignKey
ALTER TABLE "Repayment" ADD CONSTRAINT "Repayment_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "Loan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
