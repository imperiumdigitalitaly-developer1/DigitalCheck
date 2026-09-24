import type { CrawlResult } from "@/types";
import type { AnswerabilityQuery, EntityData, GeoIssue } from "./geo-types";
import { stripHtmlToText } from "./text-utils";

interface QueryTemplate {
  build: (brand: string) => string;
  test: RegExp;
  evidenceLabel: string;
}

// Template generati dal contenuto reale (brand rilevato + segnali gia'
// estratti), mai da caratteristiche/prezzi/recensioni inventate (brief GEO
// sezione 5: "NON inventare caratteristiche, prezzi, recensioni o
// servizi"). L'evidenza riportata e' solo "pattern rilevato: si/no", mai
// un estratto testuale sintetizzato dall'AI.
const QUERY_TEMPLATES: QueryTemplate[] = [
  { build: (b) => `Che servizi offre ${b}?`, test: /serviz[io]|prodott[oi]|offriamo|ci occupiamo/i, evidenceLabel: "descrizione di servizi/prodotti" },
  { build: (b) => `Dove si trova ${b}?`, test: /\b(via|viale|piazza|corso|largo)\s+[a-zA-Z]|online|a domicilio/i, evidenceLabel: "indirizzo o area operativa" },
  { build: (b) => `Come si contatta ${b}?`, test: /\+?\d[\d\s\-().]{7,}\d|@[\w.-]+\.\w+|modulo di contatto|contattaci/i, evidenceLabel: "recapito di contatto" },
  { build: (b) => `Quanto costa il servizio di ${b}?`, test: /€|eur\b|prezzo|tariffe|costo|preventivo/i, evidenceLabel: "informazione di prezzo/preventivo" },
  { build: (b) => `Quali sono gli orari di ${b}?`, test: /orari|orario|apertura|aperto|chiuso/i, evidenceLabel: "orari di apertura" },
  { build: (b) => `Perche' scegliere ${b}?`, test: /vantagg[io]|perch[eé] sceglier|perch[eé] noi|punti di forza/i, evidenceLabel: "vantaggi dichiarati" },
];

export function evaluateAnswerability(
  crawl: CrawlResult,
  entities: EntityData,
  issues: GeoIssue[]
): { score: number; queries: AnswerabilityQuery[] } {
  const brand = entities.businessNameCandidates[0] ?? "questa attivita'";
  const text = crawl.pages.map((p) => stripHtmlToText(p.html)).join(" ");

  const queries: AnswerabilityQuery[] = QUERY_TEMPLATES.map((t) => {
    const answered = t.test.test(text);
    return {
      query: t.build(brand),
      answered,
      evidence: answered ? `Rilevato: ${t.evidenceLabel}.` : undefined,
    };
  });

  const answeredCount = queries.filter((q) => q.answered).length;
  const ratio = answeredCount / queries.length;
  const score = Math.round(ratio * 100);

  if (ratio < 0.34) {
    issues.push({
      category: "answerability",
      title: "Il sito risponde a poche domande dirette e concrete",
      description: `Su ${queries.length} domande realistiche generate a partire dal contenuto del sito, solo ${answeredCount} trovano una risposta rilevabile nel testo.`,
      whyItMatters:
        "Un sistema di risposta generativa costruisce le proprie risposte a partire da contenuti che rispondono direttamente a domande dell'utente: piu' domande restano senza risposta, meno il sito puo' essere usato come fonte.",
      recommendation:
        "Aggiungi contenuti che rispondano esplicitamente alle domande piu' comuni su chi sei, cosa offri, dove operi e come contattarti.",
      severity: "critical",
    });
  } else if (ratio < 0.67) {
    issues.push({
      category: "answerability",
      title: "Diverse domande dirette restano senza risposta chiara",
      description: `Su ${queries.length} domande realistiche generate a partire dal contenuto del sito, ${
        queries.length - answeredCount
      } non trovano una risposta rilevabile nel testo.`,
      whyItMatters: "Colmare queste lacune aumenta la probabilita' che il contenuto venga usato per rispondere a domande reali degli utenti.",
      recommendation: "Rivedi le domande senza risposta qui sotto e aggiungi contenuti espliciti che le indirizzino.",
      severity: "medium",
    });
  }

  return { score, queries };
}
