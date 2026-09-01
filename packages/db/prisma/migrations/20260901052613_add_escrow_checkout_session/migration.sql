-- AlterTable
ALTER TABLE "JobEscrow" ADD COLUMN     "stripeCheckoutSessionId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "JobEscrow_stripeCheckoutSessionId_key" ON "JobEscrow"("stripeCheckoutSessionId");
