-- AlterTable
ALTER TABLE "ScanScore" ADD COLUMN     "strengths" TEXT[] DEFAULT ARRAY[]::TEXT[];
