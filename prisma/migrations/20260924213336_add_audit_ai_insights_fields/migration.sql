-- AlterTable
ALTER TABLE "Scan" ADD COLUMN     "auditAiAvailable" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "auditFinalAssessment" TEXT,
ADD COLUMN     "auditQuickWins" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "auditStrategicImprovements" TEXT[] DEFAULT ARRAY[]::TEXT[];
