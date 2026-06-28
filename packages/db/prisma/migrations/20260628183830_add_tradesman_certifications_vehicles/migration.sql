-- AlterTable
ALTER TABLE "TradesmanProfile" ADD COLUMN     "certifications" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "vehicles" TEXT[] DEFAULT ARRAY[]::TEXT[];
