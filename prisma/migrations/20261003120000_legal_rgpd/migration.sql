-- AlterTable
ALTER TABLE "User" ADD COLUMN     "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "termsAcceptedAt" TIMESTAMP(3),
ADD COLUMN     "termsVersion" TEXT,
ADD COLUMN     "salesTermsAcceptedAt" TIMESTAMP(3),
ADD COLUMN     "renewalNoticeAt" TIMESTAMP(3),
ADD COLUMN     "inactivityNoticeAt" TIMESTAMP(3);

-- Analytics : plus de lien entre une page vue et un compte (exemption de consentement CNIL)
ALTER TABLE "PageView" DROP COLUMN "userId";

-- CreateTable
CREATE TABLE "EmailOptOut" (
    "email" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailOptOut_pkey" PRIMARY KEY ("email")
);
