import type { CrawlResult, SeoFacts } from "@/types";
import type { EntityData, GeoIssue, InformationCompletenessItem } from "./geo-types";
import { stripHtmlToText } from "./text-utils";

interface QuestionCheck {
  question: string;
  severity: "critical" | "high" | "medium" | "low";
  test: (ctx: { text: string; facts: SeoFacts; entities: EntityData }) => boolean;
  issueTitle: string;
  whyItMatters: string;
  recommendation: string;
}

// 10 domande fondamentali (brief GEO sezione 4, ridotte da 12 accorpando le
// piu' simili per evitare sovrapposizioni con Answerability, che valuta
// invece query specifiche generate dal contenuto). Ogni test e' un
// riconoscimento testuale euristico, non una comprensione semantica reale:
// puo' generare falsi negativi su testi che rispondono in modo non
// standard — dichiarato come limite nel report, mai come certezza assoluta.
const QUESTIONS: QuestionCheck[] = [
  {
    question: "Chi sei?",
    severity: "critical",
    test: ({ entities }) => entities.businessNameCandidates.length > 0,
    issueTitle: "Non e' chiaro chi gestisce il sito",
    whyItMatters: "E' la domanda piu' basilare: senza un nome identificabile, nessuna delle altre informazioni puo' essere attribuita con certezza.",
    recommendation: "Dichiara chiaramente il nome dell'attivita' nella homepage.",
  },
  {
    question: "Cosa offri?",
    severity: "critical",
    test: ({ text }) => /serviz[io]|prodott[oi]|offriamo|ci occupiamo|specializzat[oi]/i.test(text.slice(0, 3000)),
    issueTitle: "Non e' chiaro cosa offre l'attivita'",
    whyItMatters: "Senza una descrizione esplicita dei servizi/prodotti, un sistema non puo' associare l'attivita' alle domande pertinenti.",
    recommendation: "Descrivi esplicitamente, in un linguaggio semplice, cosa offri (servizi o prodotti principali).",
  },
  {
    question: "Dove operi?",
    severity: "medium",
    test: ({ text, entities }) => entities.contact.addressPresent || /online|a domicilio|in tutta italia|copriamo/i.test(text),
    issueTitle: "Non e' chiara l'area operativa",
    whyItMatters: "Un utente (o un sistema che lo assiste) deve poter capire se l'attivita' e' raggiungibile fisicamente, opera online, o entrambe le cose.",
    recommendation: "Indica l'indirizzo fisico (se presente) o l'area/modalita' di operativita' (es. 'operiamo in tutta la regione' oppure 'servizio interamente online').",
  },
  {
    question: "Come funziona il servizio?",
    severity: "medium",
    test: ({ text }) => /come funziona|il processo|come procedere|passo dopo passo|come prenotare|come richied/i.test(text),
    issueTitle: "Non e' spiegato come funziona il servizio",
    whyItMatters: "Spiegare il processo (come si richiede, come si prenota, cosa aspettarsi) riduce l'ambiguita' per chi deve decidere se procedere.",
    recommendation: "Aggiungi una breve spiegazione dei passaggi principali per usufruire del servizio.",
  },
  {
    question: "Come contattarti?",
    severity: "critical",
    test: ({ entities }) => entities.contact.phonePresent || entities.contact.emailPresent,
    issueTitle: "Non ci sono modi di contatto chiari",
    whyItMatters: "Senza un contatto, l'informazione trovata non puo' tradursi in un'azione concreta per l'utente.",
    recommendation: "Rendi visibile almeno un recapito (telefono, email o modulo di contatto).",
  },
  {
    question: "Quanto costa (se pertinente)?",
    severity: "low",
    test: ({ text }) => /€|eur\b|prezzo|tariffe|costo|a partire da/i.test(text),
    issueTitle: "Nessuna indicazione di prezzo rilevata",
    whyItMatters: "Quando il prezzo e' un'informazione pertinente per la decisione dell'utente, la sua assenza lascia una domanda comune senza risposta (per molti servizi su preventivo questo e' normale e non è un problema).",
    recommendation: "Se il modello di business lo consente, indica almeno una fascia di prezzo o le modalita' con cui si ottiene un preventivo.",
  },
  {
    question: "Quali sono i vantaggi?",
    severity: "low",
    test: ({ text }) => /vantagg[io]|perch[eé] sceglier|perch[eé] noi|i nostri punti di forza/i.test(text),
    issueTitle: "I vantaggi dell'attivita' non sono espliciti",
    whyItMatters: "Senza vantaggi dichiarati esplicitamente, e' piu' difficile per un sistema sintetizzare perche' scegliere questa attivita' rispetto a un'altra.",
    recommendation: "Aggiungi una sezione che spieghi chiaramente perche' un cliente dovrebbe scegliere questa attivita'.",
  },
  {
    question: "Quali sono le caratteristiche/dettagli?",
    severity: "low",
    test: ({ text }) => /caratteristich|include|cosa comprende|dettagli del servizio/i.test(text) || /<li/i.test(text),
    issueTitle: "Mancano dettagli/caratteristiche specifiche",
    whyItMatters: "Elenchi di caratteristiche concrete rendono il contenuto piu' facile da estrarre e citare rispetto a descrizioni generiche.",
    recommendation: "Aggiungi un elenco puntato delle caratteristiche principali del servizio o prodotto.",
  },
  {
    question: "Ci sono domande frequenti (FAQ)?",
    severity: "medium",
    test: ({ text, entities }) => entities.faqSchemaPresent || /domande frequenti|faq\b/i.test(text),
    issueTitle: "Nessuna sezione FAQ rilevata",
    whyItMatters: "Le FAQ sono uno dei formati piu' facilmente estraibili e citabili dai sistemi di risposta generativa, perche' gia' strutturati come domanda/risposta.",
    recommendation: "Aggiungi una sezione FAQ con le domande piu' comuni poste dai clienti, idealmente marcata anche con schema.org FAQPage.",
  },
  {
    question: "A chi si rivolge il servizio?",
    severity: "low",
    test: ({ text }) => /per te|per la tua|ideale per|pensato per|dedicato a/i.test(text),
    issueTitle: "Il pubblico di riferimento non e' esplicito",
    whyItMatters: "Dichiarare a chi si rivolge il servizio aiuta a rispondere correttamente a domande del tipo 'e' adatto a...?'",
    recommendation: "Specifica per chi e' pensato il servizio (es. tipo di cliente, esigenza specifica).",
  },
];

export function evaluateInformationCompleteness(
  crawl: CrawlResult,
  facts: SeoFacts,
  entities: EntityData,
  issues: GeoIssue[]
): { score: number; items: InformationCompletenessItem[] } {
  const text = crawl.pages.map((p) => stripHtmlToText(p.html)).join(" ");
  const items: InformationCompletenessItem[] = [];

  const SEVERITY_PENALTY = { critical: 16, high: 12, medium: 8, low: 4 } as const;
  let score = 100;

  for (const q of QUESTIONS) {
    const answered = q.test({ text, facts, entities });
    items.push({ question: q.question, status: answered ? "answered" : "missing" });
    if (!answered) {
      score -= SEVERITY_PENALTY[q.severity];
      issues.push({
        category: "information_completeness",
        title: q.issueTitle,
        description: `Nessun contenuto rilevato che risponda a "${q.question}" nelle pagine analizzate.`,
        whyItMatters: q.whyItMatters,
        recommendation: q.recommendation,
        severity: q.severity,
      });
    }
  }

  return { score: Math.max(0, Math.min(100, score)), items };
}
