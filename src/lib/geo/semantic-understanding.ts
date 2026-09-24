import type { BusinessType, CrawlResult, SeoFacts } from "@/types";
import type { GeoIssue } from "./geo-types";
import { stripHtmlToText } from "./text-utils";

// Parole che identificano la categoria di attivita': distinte dai segnali
// di conversione (src/lib/scoring/scoring-engine.ts, CONVERSION_SIGNALS,
// che cercano prenotazioni/prezzi/contatti). Qui si valuta se un lettore
// capisce "che tipo di attivita' e' questa" dai primi contenuti visibili.
const CATEGORY_IDENTITY_PATTERN: Record<BusinessType, RegExp | null> = {
  bnb: /b&b|bed\s*(and|&)\s*breakfast|casa\s+vacanz|affittacamere|guest\s*house/i,
  hotel: /hotel|albergo|resort/i,
  restaurant: /ristorante|trattoria|pizzeria|osteria|cucina|menu/i,
  shop: /negozio|shop|store|boutique|prodott[oi]/i,
  professional: /studio|professionist[ae]|consulen[tz]|avvocato|commercialista|architett[oa]|servizi/i,
  other: null,
};

/**
 * Categoria "Semantic Understanding" (brief GEO sezione 3B): quanto e'
 * facile, per un sistema che legge solo il testo, capire di cosa tratta il
 * sito e a quale categoria di attivita' appartiene — non se e' ben
 * posizionato (quello e' SEO), ma se e' comprensibile.
 */
export function scoreSemanticUnderstanding(
  facts: SeoFacts,
  crawl: CrawlResult,
  businessType: BusinessType,
  issues: GeoIssue[]
): { score: number; notes?: string } {
  let score = 100;
  const notes: string[] = [];

  if (facts.h1.length === 0) {
    score -= 22;
    issues.push({
      category: "semantic_understanding",
      title: "Nessun titolo principale (H1) identificabile",
      description: "La homepage non ha un tag H1.",
      whyItMatters:
        "Senza un H1 chiaro, un sistema che analizza la struttura della pagina non ha un punto di partenza esplicito per capire il tema principale del contenuto.",
      recommendation: "Aggiungi un H1 che dichiari in modo diretto chi sei e cosa offri (es. nome attivita' + proposta di valore).",
      severity: "high",
    });
  } else if (facts.h1.length > 1) {
    score -= 8;
    notes.push(`${facts.h1.length} tag H1 rilevati: la gerarchia dei contenuti risulta meno netta.`);
  }

  const hasSubstructure = facts.h2Count > 0 || facts.h3Count > 0;
  const home = crawl.pages[0];
  const visibleLength = home ? stripHtmlToText(home.html).length : 0;
  if (!hasSubstructure && visibleLength > 1500) {
    score -= 15;
    issues.push({
      category: "semantic_understanding",
      title: "Contenuto lungo senza sotto-sezioni",
      description: `La pagina contiene circa ${visibleLength} caratteri di testo visibile ma nessun H2/H3 che lo suddivida in sezioni.`,
      whyItMatters:
        "Un testo lungo e indifferenziato e' piu' difficile da sintetizzare correttamente: un sistema generativo fatica a isolare la parte rilevante per una domanda specifica.",
      recommendation: "Suddividi i contenuti piu' lunghi in sezioni con titoli H2/H3 che ne descrivano chiaramente l'argomento.",
      severity: "medium",
    });
  }

  const identityPattern = CATEGORY_IDENTITY_PATTERN[businessType];
  if (identityPattern && home) {
    const earlyText = stripHtmlToText(home.html).slice(0, 800);
    const combinedEarly = `${facts.title ?? ""} ${facts.h1.join(" ")} ${earlyText}`;
    if (!identityPattern.test(combinedEarly)) {
      score -= 20;
      issues.push({
        category: "semantic_understanding",
        title: "Il tipo di attivita' non e' esplicito nei contenuti iniziali",
        description:
          "Nei primi contenuti visibili della homepage (titolo, H1, primi paragrafi) non e' stato rilevato un riferimento chiaro alla categoria di attivita' indicata in fase di analisi.",
        whyItMatters:
          "Un sistema che legge solo l'inizio della pagina, o che deve riassumerla in poche parole, potrebbe non identificare correttamente il tipo di attivita' se questo non e' dichiarato presto ed esplicitamente.",
        recommendation:
          "Dichiara esplicitamente, gia' nel titolo o nell'H1, il tipo di attivita' (es. 'B&B a...', 'Ristorante di...', 'Studio di consulenza...').",
        severity: "medium",
      });
    }
  }

  if (!facts.metaDescription) {
    score -= 10;
    notes.push("Nessuna meta description rilevata: manca una sintesi dichiarata dal sito stesso sul proprio contenuto.");
  }

  return { score: Math.max(0, Math.min(100, score)), notes: notes.length > 0 ? notes.join(" ") : undefined };
}
