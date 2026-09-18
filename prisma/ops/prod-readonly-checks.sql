-- SOLA LETTURA. La transazione e' dichiarata READ ONLY: qualunque scrittura
-- verrebbe rifiutata da Postgres. Va eseguita su produzione solo da chi ha
-- accesso, ad esempio:  psql "$PROD_READONLY_URL" -f prod-readonly-checks.sql
BEGIN TRANSACTION READ ONLY;

\echo '=== 1) Vincoli di chiave esterna reali e regola di cancellazione'
\echo '    (attesi 16 prima della migration, 17 dopo: tutte CASCADE tranne Site.organizationId = SET NULL)'
SELECT conrelid::regclass AS tabella,
       a.attname          AS colonna,
       confrelid::regclass AS riferisce,
       CASE confdeltype WHEN 'c' THEN 'CASCADE' WHEN 'n' THEN 'SET NULL'
                        WHEN 'a' THEN 'NO ACTION' WHEN 'r' THEN 'RESTRICT' END AS alla_cancellazione
FROM pg_constraint c
JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
WHERE contype = 'f'
ORDER BY 1, 2;

\echo ''
\echo '=== 2) Migration registrate come applicate'
SELECT migration_name, finished_at IS NOT NULL AS completata, rolled_back_at IS NOT NULL AS annullata
FROM _prisma_migrations ORDER BY started_at;

\echo ''
\echo '=== 3) Notifiche riferite a siti che non esistono piu'' (candidate alla pulizia)'
\echo '    Stessa regola di collegamento della migration: URL del sito + terminatore usato dal codice.'
SELECT n.id, n."userId", n.type, n."createdAt", n.message
FROM "Notification" n
WHERE n.type IN ('score_change', 'issues_found', 'help_request')
  AND NOT EXISTS (
    SELECT 1 FROM "Site" s
    WHERE s."ownerId" = n."userId"
      AND (strpos(n.message, s.url || '.') > 0
        OR strpos(n.message, s.url || ' e''') > 0
        OR strpos(n.message, s.url || ' salvata') > 0)
  )
ORDER BY n."createdAt" DESC;

\echo ''
\echo '=== 4) Riepilogo: notifiche totali / di siti esistenti / orfane'
SELECT count(*) AS totali,
       count(*) FILTER (WHERE EXISTS (SELECT 1 FROM "Site" s WHERE s."ownerId" = n."userId"
            AND (strpos(n.message, s.url || '.') > 0 OR strpos(n.message, s.url || ' e''') > 0 OR strpos(n.message, s.url || ' salvata') > 0))) AS di_siti_esistenti,
       count(*) FILTER (WHERE n.type IN ('score_change','issues_found','help_request') AND NOT EXISTS (SELECT 1 FROM "Site" s WHERE s."ownerId" = n."userId"
            AND (strpos(n.message, s.url || '.') > 0 OR strpos(n.message, s.url || ' e''') > 0 OR strpos(n.message, s.url || ' salvata') > 0))) AS orfane
FROM "Notification" n;

ROLLBACK;
