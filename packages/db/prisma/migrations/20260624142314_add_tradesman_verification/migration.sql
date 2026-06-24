-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "TradesmanVerification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
    "fullName" TEXT NOT NULL,
    "gender" TEXT,
    "dateOfBirth" TIMESTAMP(3),
    "nicNumber" TEXT NOT NULL,
    "addressLine" TEXT,
    "city" TEXT,
    "district" TEXT,
    "primaryTrade" TEXT,
    "yearsExperience" INTEGER NOT NULL DEFAULT 0,
    "nicFrontKey" TEXT,
    "nicBackKey" TEXT,
    "photoKey" TEXT,
    "gramaNiladhariKey" TEXT,
    "licenceKey" TEXT,
    "licenceNumber" TEXT,
    "policeClearanceKey" TEXT,
    "serviceRadiusKm" INTEGER NOT NULL DEFAULT 15,
    "crewType" TEXT,
    "helperCount" INTEGER,
    "portfolioKeys" JSONB,
    "guarantorName" TEXT,
    "guarantorNic" TEXT,
    "voiceIntroKey" TEXT,
    "payoutAccountHolder" TEXT,
    "payoutBank" TEXT,
    "payoutBranch" TEXT,
    "payoutAccountNumber" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TradesmanVerification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TradesmanVerification_userId_key" ON "TradesmanVerification"("userId");

-- CreateIndex
CREATE INDEX "TradesmanVerification_status_createdAt_idx" ON "TradesmanVerification"("status", "createdAt");

-- CreateIndex
CREATE INDEX "TradesmanVerification_reviewedById_idx" ON "TradesmanVerification"("reviewedById");

-- AddForeignKey
ALTER TABLE "TradesmanVerification" ADD CONSTRAINT "TradesmanVerification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TradesmanVerification" ADD CONSTRAINT "TradesmanVerification_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
