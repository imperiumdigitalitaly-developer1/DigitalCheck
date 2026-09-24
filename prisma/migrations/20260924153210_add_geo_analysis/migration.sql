-- CreateEnum
CREATE TYPE "GeoCategoryKey" AS ENUM ('AI_ACCESSIBILITY', 'SEMANTIC_UNDERSTANDING', 'ENTITY_CLARITY', 'INFORMATION_COMPLETENESS', 'ANSWERABILITY', 'CONTENT_STRUCTURE', 'TRUST_SIGNALS', 'STRUCTURED_DATA', 'LOCAL_GEO');

-- CreateEnum
CREATE TYPE "GeoIssueSeverity" AS ENUM ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW');

-- CreateTable
CREATE TABLE "GeoAnalysis" (
    "id" TEXT NOT NULL,
    "scanId" TEXT NOT NULL,
    "overallScore" INTEGER NOT NULL,
    "localApplicable" BOOLEAN NOT NULL DEFAULT false,
    "strengths" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "entities" JSONB NOT NULL,
    "informationCompleteness" JSONB NOT NULL,
    "answerabilityQueries" JSONB NOT NULL,
    "aiSummary" TEXT,
    "aiComparisonNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GeoAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GeoCategoryScore" (
    "id" TEXT NOT NULL,
    "geoAnalysisId" TEXT NOT NULL,
    "category" "GeoCategoryKey" NOT NULL,
    "score" INTEGER NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL,
    "applicable" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,

    CONSTRAINT "GeoCategoryScore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GeoIssue" (
    "id" TEXT NOT NULL,
    "geoAnalysisId" TEXT NOT NULL,
    "category" "GeoCategoryKey" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "whyItMatters" TEXT NOT NULL,
    "recommendation" TEXT NOT NULL,
    "example" TEXT,
    "severity" "GeoIssueSeverity" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GeoIssue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GeoAnalysis_scanId_key" ON "GeoAnalysis"("scanId");

-- CreateIndex
CREATE INDEX "GeoCategoryScore_geoAnalysisId_idx" ON "GeoCategoryScore"("geoAnalysisId");

-- CreateIndex
CREATE INDEX "GeoIssue_geoAnalysisId_idx" ON "GeoIssue"("geoAnalysisId");

-- AddForeignKey
ALTER TABLE "GeoAnalysis" ADD CONSTRAINT "GeoAnalysis_scanId_fkey" FOREIGN KEY ("scanId") REFERENCES "Scan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeoCategoryScore" ADD CONSTRAINT "GeoCategoryScore_geoAnalysisId_fkey" FOREIGN KEY ("geoAnalysisId") REFERENCES "GeoAnalysis"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeoIssue" ADD CONSTRAINT "GeoIssue_geoAnalysisId_fkey" FOREIGN KEY ("geoAnalysisId") REFERENCES "GeoAnalysis"("id") ON DELETE CASCADE ON UPDATE CASCADE;
