import type { CrawlResult } from "@/types";
import type { EntityData, GeoIssue } from "./geo-types";
import { collectJsonLdStats } from "./json-ld";

const RELEVANT_TYPES = [
  "Organization",
  "LocalBusiness",
  "WebSite",
  "WebPage",
  "Article",
  "FAQPage",
  "Product",
  "Service",
  "Person",
  "BreadcrumbList",
  "Event",
  "Review",
  "AggregateRating",
];

/**
 * Categoria "Structured Data" (brief GEO sezione 10): a differenza di
 * Entity Clarity (che valuta se l'ENTITA' e' identificabile, anche solo
 * testualmente), qui si valuta la salute complessiva del markup JSON-LD in
 * se' — presenza, validita' sintattica, copertura dei tipi rilevanti. Non
 * suggerisce mai un tipo di schema non pertinente al contenuto rilevato
 * (brief: "NON suggerire markup non pertinente").
 */
export function scoreStructuredData(
  crawl: CrawlResult,
  entities: EntityData,
  issues: GeoIssue[]
): { score: number; notes?: string } {
  const stats = collectJsonLdStats(crawl);
  let score = 100;
  const notes: string[] = [];

  if (stats.blocksFound === 0) {
    score -= 40;
    issues.push({
      category: "structured_data",
      title: "Nessun dato strutturato (JSON-LD) presente",
      description: "Non e' stato trovato alcun blocco <script type=\"application/ld+json\"> nelle pagine analizzate.",
      whyItMatters: "I dati strutturati sono il canale piu' esplicito ed efficiente per comunicare informazioni a sistemi automatici, incluso chi opera nella ricerca generativa.",
      recommendation: "Aggiungi almeno un blocco JSON-LD di base (es. Organization o WebSite) come punto di partenza.",
      severity: "high",
    });
    return { score: Math.max(0, score) };
  }

  if (stats.blocksInvalid > 0) {
    score -= Math.min(30, stats.blocksInvalid * 15);
    issues.push({
      category: "structured_data",
      title: "Alcuni blocchi di dati strutturati non sono JSON valido",
      description: `${stats.blocksInvalid} blocco/i JSON-LD su ${stats.blocksFound} rilevati non sono sintatticamente validi e sono stati ignorati dall'analisi.`,
      whyItMatters: "Un JSON-LD malformato viene tipicamente ignorato anche dai sistemi che lo leggono: equivale, di fatto, a non averlo.",
      recommendation: "Valida la sintassi dei blocchi JSON-LD (es. con lo strumento di test dei dati strutturati di Google) e correggi gli errori.",
      severity: "medium",
    });
  }

  const relevantFound = entities.detectedSchemaTypes.filter((t) => RELEVANT_TYPES.includes(t));
  if (relevantFound.length === 0) {
    score -= 15;
    notes.push("Presente markup JSON-LD, ma nessuno dei tipi rilevati rientra tra quelli piu' comunemente utili (Organization, LocalBusiness, WebSite, ecc.).");
  } else {
    notes.push(`Tipi rilevanti rilevati: ${relevantFound.join(", ")}.`);
  }

  return { score: Math.max(0, Math.min(100, score)), notes: notes.length > 0 ? notes.join(" ") : undefined };
}
