-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "IssueSeverity" ADD VALUE 'CRITICAL';
ALTER TYPE "IssueSeverity" ADD VALUE 'INFO';

-- AlterTable
ALTER TABLE "Recommendation" ADD COLUMN     "action" TEXT,
ADD COLUMN     "category" TEXT,
ADD COLUMN     "evidence" TEXT,
ADD COLUMN     "explanation" TEXT,
ADD COLUMN     "impact" TEXT,
ADD COLUMN     "severity" "IssueSeverity";

-- AlterTable
ALTER TABLE "Scan" ADD COLUMN     "auditCrossAnalysis" JSONB,
ADD COLUMN     "auditExecutiveSummary" TEXT;

-- AlterTable
ALTER TABLE "ScanScore" ADD COLUMN     "dataAvailability" TEXT,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "shortSummary" TEXT,
ADD COLUMN     "status" TEXT,
ADD COLUMN     "subScores" JSONB;
