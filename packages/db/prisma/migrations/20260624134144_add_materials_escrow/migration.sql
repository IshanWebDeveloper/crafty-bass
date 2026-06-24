-- CreateEnum
CREATE TYPE "EscrowStatus" AS ENUM ('REQUESTED', 'FUNDED', 'MATERIALS_RELEASED', 'WORK_COMPLETED', 'RELEASED', 'REFUNDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "EscrowTransactionType" AS ENUM ('FUND', 'RELEASE_MATERIALS', 'RELEASE_BALANCE', 'REFUND');

-- AlterTable
ALTER TABLE "Quote" ADD COLUMN     "depositRequested" DECIMAL(10,2),
ADD COLUMN     "materialsAmount" DECIMAL(10,2);

-- AlterTable
ALTER TABLE "TradesmanProfile" ADD COLUMN     "backgroundChecked" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "JobEscrow" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "homeownerId" TEXT NOT NULL,
    "tradesmanId" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'LKR',
    "quoteTotal" DECIMAL(10,2) NOT NULL,
    "materialsAmount" DECIMAL(10,2) NOT NULL,
    "depositAmount" DECIMAL(10,2) NOT NULL,
    "balanceAmount" DECIMAL(10,2) NOT NULL,
    "status" "EscrowStatus" NOT NULL DEFAULT 'REQUESTED',
    "paymentMethod" TEXT,
    "paymentRef" TEXT,
    "fundedAt" TIMESTAMP(3),
    "materialsReleasedAt" TIMESTAMP(3),
    "workCompletedAt" TIMESTAMP(3),
    "releasedAt" TIMESTAMP(3),
    "refundedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobEscrow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EscrowTransaction" (
    "id" TEXT NOT NULL,
    "escrowId" TEXT NOT NULL,
    "type" "EscrowTransactionType" NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EscrowTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "JobEscrow_jobId_key" ON "JobEscrow"("jobId");

-- CreateIndex
CREATE UNIQUE INDEX "JobEscrow_quoteId_key" ON "JobEscrow"("quoteId");

-- CreateIndex
CREATE INDEX "JobEscrow_homeownerId_idx" ON "JobEscrow"("homeownerId");

-- CreateIndex
CREATE INDEX "JobEscrow_tradesmanId_idx" ON "JobEscrow"("tradesmanId");

-- CreateIndex
CREATE INDEX "JobEscrow_status_idx" ON "JobEscrow"("status");

-- CreateIndex
CREATE INDEX "EscrowTransaction_escrowId_idx" ON "EscrowTransaction"("escrowId");

-- AddForeignKey
ALTER TABLE "JobEscrow" ADD CONSTRAINT "JobEscrow_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobEscrow" ADD CONSTRAINT "JobEscrow_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobEscrow" ADD CONSTRAINT "JobEscrow_homeownerId_fkey" FOREIGN KEY ("homeownerId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobEscrow" ADD CONSTRAINT "JobEscrow_tradesmanId_fkey" FOREIGN KEY ("tradesmanId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EscrowTransaction" ADD CONSTRAINT "EscrowTransaction_escrowId_fkey" FOREIGN KEY ("escrowId") REFERENCES "JobEscrow"("id") ON DELETE CASCADE ON UPDATE CASCADE;
