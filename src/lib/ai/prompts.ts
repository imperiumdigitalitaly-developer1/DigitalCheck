import type { BusinessGoal, BusinessType, CrawlResult, SeoFacts } from "@/types";

// Dati strutturati e minimi da inviare al modello (sezione 24 del
// brief): mai l'HTML grezzo dell'intero sito. Questo riduce costi e
// rende l'output piu' consistente.
export interface AiInputPayload {
  business_type: BusinessType;
  goal: BusinessGoal;
  url: string;
  title: string | null;
  meta_description: string | null;
  h1: string[];
  pages_analyzed: number;
  cta_signals: {
    phone_present: boolean;
    whatsapp_present: boolean;
    booking_present: boolean;
    email_present: boolean;
  };
  visible_text_excerpt: string; // testo visibile, troncato, non l'HTML
}

const MAX_TEXT_EXCERPT_CHARS = 6000;

function stripHtmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function buildAiInput(
  facts: SeoFacts,
  crawl: CrawlResult,
  businessType: BusinessType,
  goal: BusinessGoal
): AiInputPayload {
  const combinedText = crawl.pages
    .map((p) => stripHtmlToText(p.html))
    .join(" ")
    .slice(0, MAX_TEXT_EXCERPT_CHARS);

  return {
    business_type: businessType,
    goal,
    url: facts.url,
    title: facts.title,
    meta_description: facts.metaDescription,
    h1: facts.h1,
    pages_analyzed: crawl.pages.length,
    cta_signals: {
      phone_present: /\+?\d[\d\s\-().]{7,}\d/.test(combinedText),
      whatsapp_present: /wa\.me\/|whatsapp/i.test(combinedText),
      booking_present: /prenota|booking|disponibilit/i.test(combinedText),
      email_present: /@[\w.-]+\.\w+/.test(combinedText),
    },
    visible_text_excerpt: combinedText,
  };
}

export function buildSystemPrompt(): string {
  return [
    "Sei un analista che interpreta dati tecnici di siti web per proprietari di piccole attivita' (B&B, ristoranti, negozi, professionisti) senza competenze tecniche. Il tuo testo finisce in un report PDF che il cliente paga e conserva: deve leggersi come una vera consulenza, non come un riassunto automatico.",
    "Ricevi SOLO dati strutturati estratti automaticamente da un sito: non hai accesso al sito stesso, non puoi navigarlo, e non devi inventare informazioni che non ti vengono fornite (traffico, conversioni, posizionamento Google, dati Analytics/Search Console, fatturato, backlink: se non sono nel payload, non esistono per te).",
    "Se un dato non ti e' stato fornito, non affermarlo: dillo esplicitamente come non disponibile.",
    "Quando nel payload e' presente un dato concreto (lunghezza del titolo, presenza/assenza di meta description, numero di H1, segnali di contatto rilevati o assenti, numero di pagine analizzate), citalo esplicitamente invece di restare generico: 'la homepage non ha una meta description rilevata' e' utile, 'il sito potrebbe migliorare la SEO' non lo e'.",
    "Evita frasi di riempimento intercambiabili tra un sito e l'altro (es. 'il sito potrebbe offrire una migliore esperienza utente'): ogni frase deve dipendere da cosa e' stato effettivamente osservato in QUESTO sito.",
    "Non ripetere lo stesso concetto in summary, priorities, conversion_analysis e content_analysis: ogni campo ha uno scopo diverso (sintesi generale, azioni ordinate, lettura della conversione, lettura dei contenuti) e non deve limitarsi a riformulare gli altri.",
    "Rispondi ESCLUSIVAMENTE con un oggetto JSON valido conforme allo schema richiesto, senza testo introduttivo, senza markdown, senza backtick.",
    "Scrivi in italiano, in un linguaggio chiaro e pratico, orientato all'impatto per l'attivita' (non solo tecnico).",
  ].join(" ");
}

export function buildUserPrompt(payload: AiInputPayload): string {
  const schemaHint = `{
  "summary": string (3-5 frasi al massimo: cosa funziona, il problema principale, quale area migliorare per prima — deve reggere anche da solo come sintesi one-page),
  "strengths": string[] (max 3-5, specifici a questo sito, non generici),
  "issues": [{ "title": string, "category": "technical"|"ux"|"seo"|"content"|"conversion", "severity": "high"|"medium"|"low", "explanation": string, "recommendation": string }] (max 5),
  "priorities": string[] (ordinate per importanza, ciascuna un'azione concreta e specifica, non un tema generico),
  "conversion_analysis": string,
  "content_analysis": string
}`;

  return [
    `Dati strutturati del sito:\n${JSON.stringify(payload, null, 2)}`,
    `\nProduci un JSON conforme a questo schema:\n${schemaHint}`,
    `\nL'obiettivo dichiarato dal proprietario dell'attivita' e' "${payload.goal}": valuta in che misura il sito, sulla base dei soli dati forniti, sembra facilitare questo obiettivo.`,
  ].join("\n");
}
