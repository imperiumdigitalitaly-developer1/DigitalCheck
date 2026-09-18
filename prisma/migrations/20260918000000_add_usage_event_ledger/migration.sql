-- CreateEnum
CREATE TYPE "UsageEventType" AS ENUM ('SCAN', 'NEW_SITE');

-- CreateTable
CREATE TABLE "UsageEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "UsageEventType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UsageEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UsageEvent_userId_type_createdAt_idx" ON "UsageEvent"("userId", "type", "createdAt");

-- AddForeignKey
ALTER TABLE "UsageEvent" ADD CONSTRAINT "UsageEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: senza questo, gli utenti che hanno gia' consumato quota
-- prima di questa migrazione (scan/siti esistenti nel periodo corrente)
-- vedrebbero il contatore ripartire da zero, permettendo temporaneamente
-- di superare il limite del periodo in corso. Un evento per ogni Scan/
-- Site esistente riallinea il registro allo stato attuale.
INSERT INTO "UsageEvent" ("id", "userId", "type", "createdAt")
SELECT gen_random_uuid()::text, "Site"."ownerId", 'SCAN', "Scan"."startedAt"
FROM "Scan"
JOIN "Site" ON "Site"."id" = "Scan"."siteId";

INSERT INTO "UsageEvent" ("id", "userId", "type", "createdAt")
SELECT gen_random_uuid()::text, "ownerId", 'NEW_SITE', "createdAt"
FROM "Site";
