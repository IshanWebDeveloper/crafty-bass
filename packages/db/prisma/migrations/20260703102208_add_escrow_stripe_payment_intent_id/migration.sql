-- AlterTable
ALTER TABLE "JobEscrow" ADD COLUMN     "stripePaymentIntentId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "JobEscrow_stripePaymentIntentId_key" ON "JobEscrow"("stripePaymentIntentId");
