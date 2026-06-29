-- CreateEnum
CREATE TYPE "TaskSize" AS ENUM ('SMALL', 'MEDIUM', 'LARGE');

-- CreateEnum
CREATE TYPE "VehicleRequirement" AS ENUM ('NONE', 'CAR', 'TRUCK');

-- AlterTable
ALTER TABLE "Job" ADD COLUMN     "taskSize" "TaskSize",
ADD COLUMN     "vehicleRequirement" "VehicleRequirement";
