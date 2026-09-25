import { createHash } from "crypto";
import { prisma } from "@/lib/db/prisma";

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

/** Minuscolo e spazi extra collassati: "Come  Migliorо?" e "come migliorо?" devono produrre la stessa chiave. */
function normalizeQuestion(question: string): string {
  return question.trim().toLowerCase().replace(/\s+/g, " ");
}

function buildCacheKey(siteId: string, latestScanId: string, question: string): string {
  return createHash("sha256")
    .update(siteId)
    .update("\u0000")
    .update(latestScanId)
    .update("\u0000")
    .update(normalizeQuestion(question))
    .digest("hex");
}

/**
 * Risposta gia' in cache per una domanda equivalente sullo stesso sito e
 * sulla stessa scansione (gestione errori AI e cache analisi, punto B):
 * evita di richiamare Gemini per una domanda gia' posta, entro il TTL.
 * La chiave include l'id dell'ultima scansione cosi' che una nuova
 * scansione (dati aggiornati) invalidi implicitamente la cache precedente.
 */
export async function getCachedAdvisorResponse(
  siteId: string,
  latestScanId: string,
  question: string
): Promise<string | null> {
  const key = buildCacheKey(siteId, latestScanId, question);
  const row = await prisma.aiResponseCache.findUnique({ where: { key } });
  if (!row || row.expiresAt <= new Date()) return null;
  return row.response;
}

export async function setCachedAdvisorResponse(
  siteId: string,
  latestScanId: string,
  question: string,
  response: string
): Promise<void> {
  const key = buildCacheKey(siteId, latestScanId, question);
  const expiresAt = new Date(Date.now() + CACHE_TTL_MS);
  await prisma.aiResponseCache.upsert({
    where: { key },
    create: { siteId, key, response, expiresAt },
    update: { response, expiresAt },
  });
}
