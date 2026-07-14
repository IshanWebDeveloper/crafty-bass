-- AlterTable
ALTER TABLE "Job" ADD COLUMN     "cancellationReason" TEXT;

-- AlterTable
ALTER TABLE "MaterialRequest" ADD COLUMN     "declineReason" TEXT;

-- AlterTable
ALTER TABLE "Quote" ADD COLUMN     "rejectionReason" TEXT;

-- AlterTable
ALTER TABLE "Review" ADD COLUMN     "moderationReason" TEXT;
