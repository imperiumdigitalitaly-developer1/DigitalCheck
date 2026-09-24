import * as cheerio from "cheerio";
import type { CrawlResult, SeoFacts } from "@/types";
import type { AnalysisResult } from "../types";
import { buildAnalysisResult, finding, recommendation, stripHtmlToText, sub } from "../helpers";

// Sottopunteggi Content (brief audit sezione 9): Content Clarity, Content
// Completeness, Structure, Information Density, Trust/Authority Signals.
// "Search Intent Coverage" e "Content Quality Signals" del brief sono
// distribuiti tra Completeness (copertura delle domande base) e Clarity
// (assenza di frasi vaghe/riempitive). Motore interamente deterministico
// (brief sezione 9: "il contenuto deve essere prima analizzato tecnicamente
// e successivamente interpretato dall'AI") — l'interpretazione AI esistente
// (src/lib/ai/content-analyzer.ts) resta il layer downstream, agganciato
// nella pipeline, non duplicata qui.
const WEIGHTS = { clarity: 0.25, completeness: 0.25, structure: 0.2, density: 0.15, trustAuthority: 0.15 };

const VAGUE_PHRASES = [
  /miglior[ei]?\s+qualit/i,
  /esperienza\s+unica/i,
  /soluzion[ei]\s+su\s+misura/i,
  /da\s+sempre/i,
  /leader\s+nel\s+settore/i,
];

const FAQ_PATTERN = /domande\s+frequenti|faq\b/i;
const PRICE_PATTERN = /€|eur\b|prezzo|tariffe|costo/i;
const CONTACT_PATTERN = /\+?\d[\d\s\-().]{7,}\d|@[\w.-]+\.\w+/;
const UPDATED_DATE_PATTERN = /aggiornat[oa]\s+(il|al)|ultimo\s+aggiornamento/i;
const AUTHOR_PATTERN = /autore|scritto\s+da|a\s+cura\s+di/i;

export function analyzeContent(facts: SeoFacts, crawl: CrawlResult): AnalysisResult {
  const findings = [];
  const recommendations = [];
  const strengths: string[] = [];
  const home = crawl.pages[0];
  const homeText = home ? stripHtmlToText(home.html) : "";
  const wordCount = homeText ? homeText.split(/\s+/).filter(Boolean).length : 0;
  const sentences = homeText.split(/[.!?]+/).map((s) => s.trim()).filter(Boolean);
  const avgSentenceLength = sentences.length > 0 ? wordCount / sentences.length : 0;

  // ---- Clarity ----------------------------------------------------------
  let clarityScore = 100;
  const vagueMatches = VAGUE_PHRASES.filter((p) => p.test(homeText));
  if (vagueMatches.length > 0) {
    clarityScore -= Math.min(30, vagueMatches.length * 10);
    findings.push(
      finding("content", "Frasi generiche/riempitive rilevate", "low", `Rilevate ${vagueMatches.length} espressioni generiche ricorrenti (es. "esperienza unica", "leader nel settore") che non comunicano informazioni specifiche.`, "Chiarezza e specificita' percepita del messaggio")
    );
    recommendations.push(recommendation("content", "Sostituisci le frasi generiche con dettagli concreti", "low", "Frasi generiche non differenziano il sito da qualunque concorrente e non aiutano il lettore a capire cosa lo rende specifico.", "Chiarezza e specificita' del messaggio", "Sostituisci affermazioni generiche con dettagli concreti e verificabili (numeri, caratteristiche specifiche, esempi)."));
  }
  if (avgSentenceLength > 35) {
    clarityScore -= 15;
    findings.push(finding("content", "Frasi molto lunghe in homepage", "low", `Lunghezza media delle frasi rilevata: circa ${Math.round(avgSentenceLength)} parole.`, "Facilita' di lettura"));
  }

  // ---- Completeness -------------------------------------------------------
  let completenessScore = 100;
  const completenessChecks = [
    { present: !!facts.title && !!facts.metaDescription, label: "Chi sei / cosa offri (title + meta description)", weight: 20 },
    { present: PRICE_PATTERN.test(homeText), label: "Informazioni su prezzi/costi", weight: 15 },
    { present: CONTACT_PATTERN.test(homeText), label: "Modalita' di contatto", weight: 25 },
    { present: FAQ_PATTERN.test(homeText), label: "Sezione FAQ / domande frequenti", weight: 15 },
    { present: facts.h2Count > 0, label: "Suddivisione in sezioni tematiche (H2)", weight: 25 },
  ];
  for (const check of completenessChecks) {
    if (!check.present) {
      completenessScore -= check.weight;
      findings.push(finding("content", `Informazione probabilmente mancante: ${check.label}`, check.weight >= 20 ? "medium" : "low", `Non e' stato rilevato un segnale testuale per "${check.label}" nella homepage.`, "Completezza informativa percepita da un nuovo visitatore"));
    }
  }
  if (completenessScore >= 80) strengths.push("Le informazioni di base attese da un visitatore sono presenti in homepage.");

  // ---- Structure -----------------------------------------------------------
  let structureScore = 100;
  if (facts.h2Count === 0 && facts.h3Count === 0 && wordCount > 200) {
    structureScore -= 30;
    findings.push(finding("content", "Contenuto non suddiviso in sezioni", "medium", "La homepage ha un volume di testo significativo ma nessun sottotitolo (H2/H3) che lo suddivida in sezioni leggibili.", "Scansionabilita' del contenuto per il lettore"));
    recommendations.push(recommendation("content", "Suddividi il contenuto in sezioni con sottotitoli", "medium", "Un blocco di testo unico e lungo e' piu' difficile da scansionare visivamente per un lettore che cerca un'informazione specifica.", "Leggibilita' e scansionabilita'", "Introduci sottotitoli H2/H3 che separino il contenuto in sezioni tematiche."));
  } else if (facts.h2Count > 0) {
    strengths.push("Il contenuto e' suddiviso in sezioni con sottotitoli.");
  }

  // ---- Information Density --------------------------------------------------
  let densityScore = 100;
  if (wordCount < 100) {
    densityScore = 30;
    findings.push(finding("content", "Contenuto testuale molto ridotto", "medium", `Circa ${wordCount} parole di testo visibile rilevate in homepage: puo' non essere sufficiente a comunicare l'offerta in modo completo.`, "Capacita' di comunicare l'offerta a un nuovo visitatore"));
  } else if (wordCount < 250) {
    densityScore = 65;
  } else {
    strengths.push(`Volume di contenuto testuale adeguato in homepage (circa ${wordCount} parole).`);
  }
  // Segnale di contenuto duplicato tra pagine analizzate (titoli identici
  // gia' coperto in SEO — qui si guarda al testo visibile, non al title).
  if (crawl.pages.length > 1) {
    const texts = crawl.pages.map((p) => stripHtmlToText(p.html).slice(0, 500));
    const uniqueTexts = new Set(texts);
    if (uniqueTexts.size < texts.length) {
      densityScore -= 15;
      findings.push(finding("content", "Possibile contenuto duplicato tra pagine", "low", "Alcune delle pagine analizzate condividono un contenuto testuale iniziale molto simile.", "Distinzione del valore informativo tra le pagine del sito"));
    }
  }

  // ---- Trust/Authority Signals --------------------------------------------
  let trustAuthorityScore = 60; // punto di partenza neutro: non tutti i siti hanno bisogno di questi segnali
  let trustSignalsFound = 0;
  if (UPDATED_DATE_PATTERN.test(homeText)) trustSignalsFound++;
  if (AUTHOR_PATTERN.test(homeText)) trustSignalsFound++;
  if (facts.externalLinks > 0) trustSignalsFound++;
  trustAuthorityScore = Math.min(100, 60 + trustSignalsFound * 15);
  if (trustSignalsFound === 0) {
    findings.push(finding("content", "Nessun segnale di autorevolezza/aggiornamento rilevato", "low", "Non sono stati rilevati segnali come data di aggiornamento, autore o riferimenti/fonti esterne.", "Percezione di affidabilita' e attualita' del contenuto"));
  } else {
    strengths.push("Il contenuto include segnali di autorevolezza o aggiornamento (data, autore o fonti esterne).");
  }

  const subScores = [
    sub("clarity", "Content Clarity", clarityScore, WEIGHTS.clarity),
    sub("completeness", "Content Completeness", completenessScore, WEIGHTS.completeness),
    sub("structure", "Structure", structureScore, WEIGHTS.structure),
    sub("density", "Information Density", densityScore, WEIGHTS.density),
    sub("trust_authority", "Trust/Authority Signals", trustAuthorityScore, WEIGHTS.trustAuthority, "partial"),
  ];

  return buildAnalysisResult({
    category: "content",
    subScores,
    strengths,
    findings,
    recommendations,
    metrics: {
      word_count_home: wordCount || null,
      avg_sentence_length: avgSentenceLength ? Math.round(avgSentenceLength) : null,
      h2_count: facts.h2Count,
      h3_count: facts.h3Count,
      faq_detected: FAQ_PATTERN.test(homeText),
    },
    notes: "Analisi tecnica e strutturale, non valutazione dell'interpretazione AI (vedi la sezione AI del report Pro per la lettura qualitativa).",
    shortSummary:
      completenessScore >= 70 && clarityScore >= 70
        ? "I contenuti coprono le informazioni di base attese, con una struttura leggibile."
        : "I contenuti presentano lacune informative o di struttura che possono limitare la comprensione da parte di un nuovo visitatore.",
  });
}
