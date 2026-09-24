import * as cheerio from "cheerio";
import type { CrawlResult } from "@/types";

export interface JsonLdEntry {
  type: string;
  raw: Record<string, unknown>;
}

/**
 * Estrae tutte le entita' JSON-LD dalle pagine gia' scaricate durante il
 * crawl (nessuna nuova richiesta di rete). A differenza di
 * seo-analyzer.ts (che cattura solo i valori @type per la SEO), qui si
 * conserva l'oggetto intero: il GEO ha bisogno di leggere campi come
 * sameAs, address, telephone per valutare la chiarezza dell'entita'
 * (brief GEO sezione 3).
 */
export function extractJsonLd(crawl: CrawlResult): JsonLdEntry[] {
  const entries: JsonLdEntry[] = [];

  for (const page of crawl.pages) {
    const $ = cheerio.load(page.html);
    $('script[type="application/ld+json"]').each((_, el) => {
      let parsed: unknown;
      try {
        parsed = JSON.parse($(el).contents().text());
      } catch {
        return; // JSON-LD malformato: ignorato, non blocca l'analisi
      }

      const candidates: unknown[] = Array.isArray(parsed)
        ? parsed
        : parsed && typeof parsed === "object" && Array.isArray((parsed as Record<string, unknown>)["@graph"])
          ? ((parsed as Record<string, unknown>)["@graph"] as unknown[])
          : [parsed];

      for (const candidate of candidates) {
        if (!candidate || typeof candidate !== "object" || !("@type" in candidate)) continue;
        const item = candidate as Record<string, unknown>;
        const typeValue = item["@type"];
        const types = Array.isArray(typeValue) ? typeValue : [typeValue];
        for (const t of types) {
          if (typeof t === "string") entries.push({ type: t, raw: item });
        }
      }
    });
  }

  return entries;
}

export interface JsonLdStats {
  blocksFound: number;
  blocksParsed: number;
  blocksInvalid: number;
}

/** Conta quanti blocchi <script type="application/ld+json"> esistono e quanti sono validi JSON — usato dalla categoria Structured Data (sintassi), separato da extractJsonLd che restituisce solo le entita' valide. */
export function collectJsonLdStats(crawl: { pages: { html: string }[] }): JsonLdStats {
  let blocksFound = 0;
  let blocksParsed = 0;

  for (const page of crawl.pages) {
    const $ = cheerio.load(page.html);
    $('script[type="application/ld+json"]').each((_, el) => {
      blocksFound++;
      try {
        JSON.parse($(el).contents().text());
        blocksParsed++;
      } catch {
        // conteggiato come non valido tramite blocksFound - blocksParsed
      }
    });
  }

  return { blocksFound, blocksParsed, blocksInvalid: blocksFound - blocksParsed };
}

export function findEntriesOfType(entries: JsonLdEntry[], types: string[]): JsonLdEntry[] {
  const wanted = new Set(types.map((t) => t.toLowerCase()));
  return entries.filter((e) => wanted.has(e.type.toLowerCase()));
}

/** sameAs puo' essere una stringa singola o un array — normalizza. */
export function extractSameAs(entries: JsonLdEntry[]): string[] {
  const links = new Set<string>();
  for (const entry of entries) {
    const value = entry.raw.sameAs;
    if (typeof value === "string") links.add(value);
    else if (Array.isArray(value)) {
      for (const v of value) if (typeof v === "string") links.add(v);
    }
  }
  return Array.from(links);
}

export function firstStringField(entries: JsonLdEntry[], field: string): string | null {
  for (const entry of entries) {
    const value = entry.raw[field];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}
