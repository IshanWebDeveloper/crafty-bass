-- CreateEnum
CREATE TYPE "QuoteLineCategory" AS ENUM ('LABOUR', 'MATERIAL');

-- AlterTable
ALTER TABLE "Quote" ADD COLUMN     "calloutFee" DECIMAL(10,2),
ADD COLUMN     "discount" DECIMAL(10,2),
ADD COLUMN     "validUntil" TIMESTAMP(3),
ADD COLUMN     "vatRate" DECIMAL(5,2);

-- AlterTable
ALTER TABLE "QuoteMaterial" ADD COLUMN     "category" "QuoteLineCategory" NOT NULL DEFAULT 'MATERIAL';
