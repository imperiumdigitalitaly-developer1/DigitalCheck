-- Le notifiche (score_change, issues_found, help_request) erano legate solo
-- all'utente, con l'URL scritto nel testo: eliminando un sito restavano
-- visibili nel Gestionale. Le si collega al sito, cosi' la cascade le rimuove.

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "siteId" TEXT;

-- CreateIndex
CREATE INDEX "Notification_siteId_idx" ON "Notification"("siteId");

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Collega le notifiche esistenti al sito ancora presente dello stesso utente:
-- l'URL deve comparire nel messaggio seguito da uno dei tre terminatori usati
-- dal codice (".", " e'", " salvata"), cosi' "https://a.it" non si attacca a
-- un messaggio su "https://a.it/blog". Solo UPDATE: non cancella nulla. Le
-- notifiche di siti gia' eliminati restano con siteId NULL (non c'e' un sito
-- a cui collegarle) e vanno ripulite a parte, dopo verifica.
UPDATE "Notification" n
SET "siteId" = s."id"
FROM "Site" s
WHERE n."siteId" IS NULL
  AND s."ownerId" = n."userId"
  AND (
    strpos(n."message", s."url" || '.') > 0
    OR strpos(n."message", s."url" || ' e''') > 0
    OR strpos(n."message", s."url" || ' salvata') > 0
  );
