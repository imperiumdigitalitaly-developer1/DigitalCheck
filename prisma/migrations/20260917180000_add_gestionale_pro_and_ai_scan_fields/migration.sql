-- AlterTable
ALTER TABLE "Scan" ADD COLUMN     "aiContentAnalysis" TEXT,
ADD COLUMN     "aiConversionAnalysis" TEXT,
ADD COLUMN     "aiPriorities" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "UsageLimit" ADD COLUMN     "maxScansWeek" INTEGER,
ADD COLUMN     "maxSitesMonth" INTEGER;

-- CreateTable
CREATE TABLE "AnalyticsConnection" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "connected" BOOLEAN NOT NULL DEFAULT false,
    "propertyId" TEXT,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "connectedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnalyticsConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SearchConsoleConnection" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "connected" BOOLEAN NOT NULL DEFAULT false,
    "siteUrl" TEXT,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "connectedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SearchConsoleConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MonitoringConfig" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "configured" BOOLEAN NOT NULL DEFAULT false,
    "provider" TEXT,
    "checkUrl" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MonitoringConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIConversation" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AIConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AIMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AnalyticsConnection_siteId_key" ON "AnalyticsConnection"("siteId");

-- CreateIndex
CREATE UNIQUE INDEX "SearchConsoleConnection_siteId_key" ON "SearchConsoleConnection"("siteId");

-- CreateIndex
CREATE UNIQUE INDEX "MonitoringConfig_siteId_key" ON "MonitoringConfig"("siteId");

-- CreateIndex
CREATE INDEX "AIConversation_siteId_userId_idx" ON "AIConversation"("siteId", "userId");

-- CreateIndex
CREATE INDEX "AIMessage_conversationId_idx" ON "AIMessage"("conversationId");

-- AddForeignKey
ALTER TABLE "AnalyticsConnection" ADD CONSTRAINT "AnalyticsConnection_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SearchConsoleConnection" ADD CONSTRAINT "SearchConsoleConnection_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonitoringConfig" ADD CONSTRAINT "MonitoringConfig_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIConversation" ADD CONSTRAINT "AIConversation_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIMessage" ADD CONSTRAINT "AIMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "AIConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
