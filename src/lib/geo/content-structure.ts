import * as cheerio from "cheerio";
import type { CrawlResult } from "@/types";
import type { EntityData, GeoIssue } from "./geo-types";

// Frasi promozionali generiche, intercambiabili tra un sito e l'altro:
// segnale euristico di "claim vago", non un giudizio sulla qualita'
// commerciale del testo (brief GEO sezione 7: "non giudicare la qualita'
// commerciale del testo in se': valuta la sua utilita' informativa").
const VAGUE_PHRASES = [
  /soluzion[ei]\s+innovativ[ea]/i,
  /alta\s+qualit[aà]/i,
  /massima\s+professionalit[aà]/i,
  /eccellenza/i,
  /leader\s+(nel|del)\s+settore/i,
  /esperienza\s+pluriennale/i,
  /al\s+passo\s+coi\s+tempi/i,
  /su\s+misura\s+per\s+te/i,
  /qualit[aà]\s+e\s+professionalit[aà]/i,
];

const FAQ_HEADING_PATTERN = /domande\s+frequenti|faq\b|domande\s+e\s+risposte/i;

/**
 * Categoria "Content Structure for AI" (brief GEO sezione 6): quanto il
 * contenuto e' organizzato in forme facilmente estraibili (liste, tabelle,
 * FAQ) rispetto a testo indifferenziato e generico.
 */
export function scoreContentStructure(
  crawl: CrawlResult,
  entities: EntityData,
  issues: GeoIssue[]
): { score: number; notes?: string } {
  let score = 100;
  const notes: string[] = [];

  let paragraphs = 0;
  let lists = 0;
  let tables = 0;
  let vagueMatches = 0;
  let faqHeadingFound = entities.faqSchemaPresent;
  let plainText = "";

  for (const page of crawl.pages) {
    const $ = cheerio.load(page.html);
    paragraphs += $("p").filter((_, el) => $(el).text().trim().length > 40).length;
    lists += $("ul, ol").length;
    tables += $("table").length;
    $("h1, h2, h3, h4").each((_, el) => {
      if (FAQ_HEADING_PATTERN.test($(el).text())) faqHeadingFound = true;
    });
    plainText += ` ${$("body").text()}`;
  }

  for (const pattern of VAGUE_PHRASES) {
    if (pattern.test(plainText)) vagueMatches++;
  }

  if (lists === 0 && tables === 0) {
    score -= 15;
    issues.push({
      category: "content_structure",
      title: "Nessun elenco o tabella rilevato",
      description: "Non sono stati trovati elenchi puntati/numerati ne' tabelle nelle pagine analizzate.",
      whyItMatters: "Liste e tabelle sono formati che un sistema generativo puo' estrarre e riutilizzare direttamente; un testo scorrevole senza struttura e' piu' difficile da sintetizzare fedelmente.",
      recommendation: "Dove ha senso (caratteristiche, prezzi, passaggi), organizza le informazioni in elenchi o tabelle invece di un unico blocco di testo.",
      severity: "medium",
    });
  } else {
    notes.push(`${lists} elenco/i e ${tables} tabella/e rilevate.`);
  }

  if (!faqHeadingFound) {
    score -= 12;
    issues.push({
      category: "content_structure",
      title: "Nessuna struttura domanda/risposta rilevata",
      description: "Non e' stata trovata una sezione FAQ ne' un pattern domanda/risposta esplicito nel contenuto.",
      whyItMatters: "Il formato domanda/risposta e' tra i piu' direttamente riutilizzabili dai sistemi di risposta generativa.",
      recommendation: "Aggiungi una sezione FAQ con domande reali poste dai clienti.",
      severity: "medium",
    });
  }

  if (vagueMatches >= 3) {
    score -= Math.min(25, vagueMatches * 6);
    issues.push({
      category: "content_structure",
      title: "Diversi claim generici senza dettagli concreti",
      description: `Rilevate ${vagueMatches} espressioni promozionali generiche (es. "soluzioni innovative", "massima qualita'") senza informazioni specifiche associate.`,
      whyItMatters:
        "Frasi generiche e intercambiabili tra siti diversi non aggiungono informazione utile: un sistema che cerca di rispondere a una domanda concreta le ignora o non riesce a usarle.",
      recommendation: 'Sostituisci le affermazioni generiche con dettagli specifici e verificabili (es. non "qualita\' eccellente" ma cosa, concretamente, viene offerto).',
      example: 'Invece di "Offriamo soluzioni innovative" scrivi "Realizziamo siti web per strutture ricettive e attivita\' locali".',
      severity: "low",
    });
  }

  if (paragraphs === 0) {
    score -= 10;
    notes.push("Pochissimo testo in paragrafi strutturati rilevato.");
  }

  return { score: Math.max(0, Math.min(100, score)), notes: notes.length > 0 ? notes.join(" ") : undefined };
}
