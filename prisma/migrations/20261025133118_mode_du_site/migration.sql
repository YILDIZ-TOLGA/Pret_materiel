-- CreateEnum
CREATE TYPE "SiteMode" AS ENUM ('BETA', 'PAID');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "paidModeNoticeFor" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "SiteSetting" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "mode" "SiteMode" NOT NULL DEFAULT 'BETA',
    "paidFrom" TIMESTAMP(3),
    "paidSince" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" TEXT,

    CONSTRAINT "SiteSetting_pkey" PRIMARY KEY ("id")
);

-- Le site démarre en phase de test (tout gratuit) : on passe au payant depuis l'admin
INSERT INTO "SiteSetting" ("id", "mode", "updatedAt") VALUES (1, 'BETA', CURRENT_TIMESTAMP) ON CONFLICT ("id") DO NOTHING;
