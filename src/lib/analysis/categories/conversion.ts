import type { BusinessType, CrawlResult } from "@/types";
import type { AnalysisResult } from "../types";
import { buildAnalysisResult, finding, recommendation, sub } from "../helpers";

// Sottopunteggi Conversion (brief audit sezione 8): CTA, Trust Signals,
// User Journey/Friction, Value Proposition, Contact/Action Accessibility.
// Contact/Action Accessibility e' assorbita in CTA (la presenza di un
// canale di contatto raggiungibile E' l'accessibilita' dell'azione).
type Bucket = "cta" | "trust" | "journey" | "valueProposition";

interface ConversionSignal {
  pattern: RegExp;
  label: string;
  weight: number; // punti su 100 per il bucket a cui appartiene
  bucket: Bucket;
}

// Checklist per tipo di attivita' (erede della logica gia' in produzione
// in scoring-engine.ts, riorganizzata per bucket invece che come lista
// piatta — brief sezione 8: CTA / Trust / Value Proposition separati).
const CONVERSION_SIGNALS: Record<BusinessType, ConversionSignal[]> = {
  bnb: [
    { pattern: /\+?\d[\d\s\-().]{7,}\d/, label: "numero di telefono", weight: 20, bucket: "cta" },
    { pattern: /wa\.me\/|api\.whatsapp\.com/i, label: "contatto WhatsApp", weight: 15, bucket: "cta" },
    { pattern: /prenota|booking|disponibilit/i, label: "prenotazione/disponibilita'", weight: 40, bucket: "cta" },
    { pattern: /@[\w.-]+\.\w+/, label: "email di contatto", weight: 25, bucket: "cta" },
    { pattern: /check.?in/i, label: "informazioni check-in", weight: 40, bucket: "journey" },
    { pattern: /€|eur\b|prezzo|tariffe/i, label: "prezzi/tariffe", weight: 60, bucket: "journey" },
    { pattern: /recension|review/i, label: "recensioni", weight: 60, bucket: "trust" },
    { pattern: /via |piazza |corso |indirizzo/i, label: "indirizzo", weight: 40, bucket: "trust" },
    { pattern: /(camer[ae]|stanz[ae]|appartament[oi])[^.]{0,80}(dorm|vista|bagno|letto)/i, label: "descrizione dell'offerta", weight: 100, bucket: "valueProposition" },
  ],
  hotel: [
    { pattern: /\+?\d[\d\s\-().]{7,}\d/, label: "numero di telefono", weight: 20, bucket: "cta" },
    { pattern: /prenota|booking|disponibilit/i, label: "prenotazione/disponibilita'", weight: 50, bucket: "cta" },
    { pattern: /@[\w.-]+\.\w+/, label: "email di contatto", weight: 30, bucket: "cta" },
    { pattern: /camere|rooms/i, label: "informazioni sulle camere", weight: 50, bucket: "journey" },
    { pattern: /€|eur\b|prezzo|tariffe/i, label: "prezzi/tariffe", weight: 50, bucket: "journey" },
    { pattern: /recension|review/i, label: "recensioni", weight: 60, bucket: "trust" },
    { pattern: /servizi|amenit|piscina|spa|colazione/i, label: "servizi offerti", weight: 40, bucket: "trust" },
    { pattern: /(camer[ae]|hotel|struttura)[^.]{0,80}(vista|comfort|centro|posizione)/i, label: "descrizione dell'offerta", weight: 100, bucket: "valueProposition" },
  ],
  restaurant: [
    { pattern: /menu/i, label: "menu", weight: 40, bucket: "cta" },
    { pattern: /prenota|booking/i, label: "prenotazione tavolo", weight: 35, bucket: "cta" },
    { pattern: /\+?\d[\d\s\-().]{7,}\d/, label: "numero di telefono", weight: 25, bucket: "cta" },
    { pattern: /orari|apertura/i, label: "orari di apertura", weight: 50, bucket: "journey" },
    { pattern: /delivery|asporto|takeaway/i, label: "delivery/asporto", weight: 25, bucket: "journey" },
    { pattern: /via |piazza |corso |indirizzo/i, label: "indirizzo", weight: 25, bucket: "journey" },
    { pattern: /recension|review/i, label: "recensioni", weight: 60, bucket: "trust" },
    { pattern: /(cucina|piatti|ingredienti|specialit)[^.]{0,80}/i, label: "descrizione della proposta gastronomica", weight: 40, bucket: "trust" },
    { pattern: /(cucina|ristorante|chef)[^.]{0,80}(tradizion|tipic|fresc|local)/i, label: "identita' della proposta", weight: 100, bucket: "valueProposition" },
  ],
  shop: [
    { pattern: /carrello|cart|acquista|buy now/i, label: "carrello/acquisto", weight: 45, bucket: "cta" },
    { pattern: /\+?\d[\d\s\-().]{7,}\d/, label: "numero di telefono", weight: 20, bucket: "cta" },
    { pattern: /@[\w.-]+\.\w+/, label: "email di contatto", weight: 20, bucket: "cta" },
    { pattern: /€|eur\b|prezzo/i, label: "prezzi", weight: 15, bucket: "cta" },
    { pattern: /spedizion|shipping/i, label: "informazioni spedizione", weight: 55, bucket: "journey" },
    { pattern: /reso|rimborso|return policy/i, label: "politica resi", weight: 45, bucket: "journey" },
    { pattern: /recension|review/i, label: "recensioni prodotto", weight: 60, bucket: "trust" },
    { pattern: /garanzia|certificaz/i, label: "garanzie", weight: 40, bucket: "trust" },
    { pattern: /(prodott[oi]|collezione|catalogo)[^.]{0,80}(qualit|artigian|material|esclusiv)/i, label: "descrizione dell'offerta prodotto", weight: 100, bucket: "valueProposition" },
  ],
  professional: [
    { pattern: /preventivo|richiedi informazioni|contattaci/i, label: "richiesta preventivo/contatto", weight: 40, bucket: "cta" },
    { pattern: /\+?\d[\d\s\-().]{7,}\d/, label: "numero di telefono", weight: 30, bucket: "cta" },
    { pattern: /@[\w.-]+\.\w+/, label: "email di contatto", weight: 30, bucket: "cta" },
    { pattern: /servizi|services/i, label: "elenco servizi", weight: 60, bucket: "journey" },
    { pattern: /albo|iscrizion|certificaz/i, label: "credenziali professionali", weight: 40, bucket: "journey" },
    { pattern: /recension|testimonianz/i, label: "recensioni/testimonianze", weight: 60, bucket: "trust" },
    { pattern: /chi siamo|about|esperienza/i, label: "presentazione dell'attivita'", weight: 40, bucket: "trust" },
    { pattern: /(servizi|consulenza|studio)[^.]{0,80}(specializzat|esperienza|professional)/i, label: "descrizione dell'offerta professionale", weight: 100, bucket: "valueProposition" },
  ],
  other: [
    { pattern: /\+?\d[\d\s\-().]{7,}\d/, label: "numero di telefono", weight: 35, bucket: "cta" },
    { pattern: /@[\w.-]+\.\w+/, label: "email di contatto", weight: 35, bucket: "cta" },
    { pattern: /contattaci|contact/i, label: "sezione contatti", weight: 30, bucket: "cta" },
    { pattern: /servizi|prodotti/i, label: "servizi/prodotti", weight: 60, bucket: "journey" },
    { pattern: /chi siamo|about/i, label: "presentazione dell'attivita'", weight: 40, bucket: "journey" },
    { pattern: /recension|review|testimonianz/i, label: "recensioni/testimonianze", weight: 100, bucket: "trust" },
    { pattern: /[^.]{0,80}(offr|propon|specializz)[^.]{0,80}/i, label: "descrizione dell'offerta", weight: 100, bucket: "valueProposition" },
  ],
};

const BUCKET_WEIGHT: Record<Bucket, number> = { cta: 0.35, trust: 0.25, journey: 0.2, valueProposition: 0.2 };
const BUCKET_LABEL: Record<Bucket, string> = { cta: "CTA", trust: "Trust Signals", journey: "User Journey", valueProposition: "Value Proposition" };

export function analyzeConversion(crawl: CrawlResult, businessType: BusinessType): AnalysisResult {
  const findings = [];
  const recommendations = [];
  const strengths: string[] = [];
  const html = crawl.pages.map((p) => p.html).join("\n");
  const signals = CONVERSION_SIGNALS[businessType];

  const bucketTotals: Record<Bucket, { earned: number; max: number }> = {
    cta: { earned: 0, max: 0 },
    trust: { earned: 0, max: 0 },
    journey: { earned: 0, max: 0 },
    valueProposition: { earned: 0, max: 0 },
  };

  for (const signal of signals) {
    bucketTotals[signal.bucket].max += signal.weight;
    const matched = signal.pattern.test(html);
    if (matched) {
      bucketTotals[signal.bucket].earned += signal.weight;
    } else {
      const severity = signal.weight >= 60 ? "high" : signal.weight >= 35 ? "medium" : "low";
      findings.push(
        finding(
          "conversion",
          `Elemento di conversione mancante: ${signal.label}`,
          severity,
          `Non e' stato rilevato alcun riferimento a "${signal.label}" nelle pagine analizzate.`,
          `Capacita' del sito di guidare l'utente verso ${BUCKET_LABEL[signal.bucket].toLowerCase()}`
        )
      );
      recommendations.push(
        recommendation(
          "conversion",
          `Aggiungi in modo evidente: ${signal.label}`,
          severity,
          `Per questo tipo di attivita', ${signal.label} e' uno degli elementi che piu' aiuta un visitatore a compiere l'azione desiderata.`,
          BUCKET_LABEL[signal.bucket],
          `Valuta di aggiungere ${signal.label} nella homepage o in una pagina facilmente raggiungibile.`
        )
      );
    }
  }

  const bucketScores: Record<Bucket, number> = {
    cta: bucketTotals.cta.max > 0 ? Math.round((bucketTotals.cta.earned / bucketTotals.cta.max) * 100) : 50,
    trust: bucketTotals.trust.max > 0 ? Math.round((bucketTotals.trust.earned / bucketTotals.trust.max) * 100) : 50,
    journey: bucketTotals.journey.max > 0 ? Math.round((bucketTotals.journey.earned / bucketTotals.journey.max) * 100) : 50,
    valueProposition:
      bucketTotals.valueProposition.max > 0 ? Math.round((bucketTotals.valueProposition.earned / bucketTotals.valueProposition.max) * 100) : 50,
  };

  if (bucketScores.cta >= 75) strengths.push("Gli elementi principali di call to action sono presenti e riconoscibili.");
  if (bucketScores.trust >= 75) strengths.push("Il sito comunica segnali di fiducia riconoscibili (recensioni, garanzie, credenziali).");
  if (bucketScores.valueProposition < 50) {
    findings.push(finding("conversion", "Proposta di valore poco esplicita", "medium", "Il testo del sito non descrive in modo chiaro cosa viene offerto e perche' sceglierlo, secondo i pattern rilevati.", "Chiarezza dell'offerta per un nuovo visitatore"));
  }

  const subScores = [
    sub("cta", BUCKET_LABEL.cta, bucketScores.cta, BUCKET_WEIGHT.cta),
    sub("trust_signals", BUCKET_LABEL.trust, bucketScores.trust, BUCKET_WEIGHT.trust),
    sub("user_journey", BUCKET_LABEL.journey, bucketScores.journey, BUCKET_WEIGHT.journey),
    sub("value_proposition", BUCKET_LABEL.valueProposition, bucketScores.valueProposition, BUCKET_WEIGHT.valueProposition),
  ];

  return buildAnalysisResult({
    category: "conversion",
    subScores,
    strengths,
    findings,
    recommendations,
    metrics: {
      cta_score: bucketScores.cta,
      trust_score: bucketScores.trust,
      journey_score: bucketScores.journey,
      value_proposition_score: bucketScores.valueProposition,
    },
    notes: "Basato sulla presenza di segnali testuali di conversione pertinenti al tipo di attivita' dichiarato; non misura conversioni reali (nessun dato Analytics disponibile in questa fase).",
    shortSummary:
      bucketScores.cta >= 65 && bucketScores.trust >= 65
        ? "Il sito presenta elementi di conversione riconoscibili, con margini di miglioramento su alcuni segnali di fiducia o passaggi del percorso utente."
        : "Il sito ha margini di miglioramento significativi negli elementi che guidano il visitatore verso un'azione.",
  });
}
