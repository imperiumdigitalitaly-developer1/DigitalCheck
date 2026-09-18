-- Monitor UptimeRobot da eliminare sul provider dopo che il sito (o l'utente)
-- a cui appartenevano e' stato eliminato. Non collegata a Site/User di
-- proposito: deve sopravvivere alla loro eliminazione.

-- CreateTable
CREATE TABLE "MonitorCleanup" (
    "id" TEXT NOT NULL,
    "monitorId" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MonitorCleanup_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MonitorCleanup_monitorId_key" ON "MonitorCleanup"("monitorId");
