import * as cheerio from "cheerio";
import type { CrawlResult } from "@/types";
import type { EntityData, GeoIssue } from "./geo-types";

const ABOUT_PATTERN = /chi\s+siamo|chi\s+sono|about(\s+us)?|la\s+nostra\s+storia/i;
const PRIVACY_PATTERN = /privacy|cookie\s*policy|termini\s+(e\s+condizioni|di\s+servizio)/i;
const REVIEW_PATTERN = /recension[ei]|testimonianz[ae]|review[s]?\b/i;
const AUTHOR_PATTERN = /scritto\s+da|di\s+redazione|autore:|a\s+cura\s+di/i;
const UPDATED_PATTERN = /aggiornat[oa]\s+(al|il)|ultimo\s+aggiornamento|©\s?\d{4}|\d{4}\s*©/i;
const QUALIFICATION_PATTERN = /albo|iscrizion[ei]|certificaz|qualific|laurea|abilitazion/i;

/**
 * Categoria "E-E-A-T / Trust Signals" (brief GEO sezione 8). Valuta solo
 * segnali rilevabili nel markup/testo: non dichiara mai che l'assenza di
 * un singolo elemento renda il sito "inaffidabile" (brief: "NON dichiarare
 * che l'assenza di un singolo elemento rende il sito inaffidabile").
 */
export function scoreTrustSignals(
  crawl: CrawlResult,
  entities: EntityData,
  issues: GeoIssue[]
): { score: number; strengths: string[]; notes?: string } {
  let score = 100;
  const strengths: string[] = [];
  let hasAbout = false;
  let hasPrivacy = false;
  let hasReviewMentions = entities.reviewSchemaPresent;
  let hasAuthorSignal = false;
  let hasUpdatedSignal = false;
  let hasQualification = false;

  for (const page of crawl.pages) {
    const $ = cheerio.load(page.html);
    const bodyText = $("body").text();
    const linkTexts = $("a")
      .map((_, el) => $(el).text())
      .get()
      .join(" ");

    if (ABOUT_PATTERN.test(linkTexts) || ABOUT_PATTERN.test(page.finalUrl)) hasAbout = true;
    if (PRIVACY_PATTERN.test(linkTexts)) hasPrivacy = true;
    if (REVIEW_PATTERN.test(bodyText)) hasReviewMentions = true;
    if (AUTHOR_PATTERN.test(bodyText)) hasAuthorSignal = true;
    if (UPDATED_PATTERN.test(bodyText)) hasUpdatedSignal = true;
    if (QUALIFICATION_PATTERN.test(bodyText)) hasQualification = true;
  }

  if (!hasAbout) {
    score -= 15;
    issues.push({
      category: "trust_signals",
      title: "Nessuna pagina 'Chi siamo' rilevata",
      description: "Non e' stato trovato un link a una pagina di presentazione dell'attivita' (es. 'Chi siamo', 'About').",
      whyItMatters: "Una pagina di presentazione e' uno dei segnali piu' diretti di trasparenza su chi gestisce il sito e con quale esperienza.",
      recommendation: "Aggiungi una pagina 'Chi siamo' con una presentazione dell'attivita' e, se pertinente, di chi la gestisce.",
      severity: "medium",
    });
  } else {
    strengths.push("Presente una pagina di presentazione dell'attivita' ('Chi siamo').");
  }

  if (!hasPrivacy) {
    score -= 8;
    issues.push({
      category: "trust_signals",
      title: "Nessuna pagina privacy/termini rilevata",
      description: "Non e' stato trovato un link a informazioni su privacy, cookie o termini di servizio.",
      whyItMatters: "Sono informazioni editoriali che segnalano un sito gestito in modo strutturato e trasparente.",
      recommendation: "Aggiungi (se non presenti) una pagina privacy e, se pertinente, termini di servizio.",
      severity: "low",
    });
  }

  if (hasReviewMentions) {
    strengths.push("Rilevati riferimenti a recensioni o testimonianze.");
  }

  if (hasQualification) {
    strengths.push("Rilevati riferimenti a qualifiche, certificazioni o esperienza dichiarata.");
  }

  if (!hasUpdatedSignal) {
    score -= 5;
  } else {
    strengths.push("Rilevato un segnale di aggiornamento/data (es. copyright con anno).");
  }

  if (hasAuthorSignal) {
    strengths.push("Rilevata attribuzione di autore/redazione sui contenuti.");
  }

  return {
    score: Math.max(0, Math.min(100, score)),
    strengths,
  };
}
