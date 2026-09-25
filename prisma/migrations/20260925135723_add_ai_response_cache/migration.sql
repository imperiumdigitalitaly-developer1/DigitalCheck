-- CreateTable
CREATE TABLE "AiResponseCache" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "response" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiResponseCache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AiResponseCache_key_key" ON "AiResponseCache"("key");

-- CreateIndex
CREATE INDEX "AiResponseCache_siteId_idx" ON "AiResponseCache"("siteId");

-- CreateIndex
CREATE INDEX "AiResponseCache_expiresAt_idx" ON "AiResponseCache"("expiresAt");

-- AddForeignKey
ALTER TABLE "AiResponseCache" ADD CONSTRAINT "AiResponseCache_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

