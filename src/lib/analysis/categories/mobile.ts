import * as cheerio from "cheerio";
import type { CrawlResult, SeoFacts } from "@/types";
import type { PageSpeedFullResult } from "../pagespeed";
import type { AnalysisResult } from "../types";
import { buildAnalysisResult, finding, recommendation, sub } from "../helpers";

// Sottopunteggi Mobile (brief audit sezione 7). Il brief elenca 8 aree
// (Responsive Structure, Mobile Usability, Typography, Navigation,
// Interactive Elements, Forms, Visual Layout, Mobile Performance): qui
// sono raggruppate in cio' che e' REALMENTE verificabile senza un vero
// rendering browser nella pipeline attuale (che scarica solo HTML, non
// esegue JS/CSS — vedi src/lib/crawler/crawler.ts). Typography/Navigation/
// Interactive Elements confluiscono in "mobile_usability", dichiarata
// esplicitamente "partial": mai affermare "non responsive" sulla base di
// un singolo indicatore (brief sezione 7).
const WEIGHTS = {
  responsiveStructure: 0.25,
  mobileUsability: 0.15,
  visualLayout: 0.15,
  forms: 0.15,
  mobilePerformance: 0.3,
};

const SMALL_FONT_PATTERN = /font-size\s*:\s*(\d+(?:\.\d+)?)px/gi;
const FIXED_WIDTH_PATTERN = /width\s*:\s*(\d{3,5})px/gi;

export function analyzeMobile(facts: SeoFacts, crawl: CrawlResult, psi: PageSpeedFullResult | null): AnalysisResult {
  const findings = [];
  const recommendations = [];
  const strengths: string[] = [];
  const home = crawl.pages[0];
  const $ = home ? cheerio.load(home.html) : null;

  // ---- Responsive Structure ----------------------------------------------
  let responsiveStructureScore = 100;
  if (!facts.viewportPresent) {
    responsiveStructureScore -= 60;
    findings.push(
      finding("mobile", "Meta viewport assente", "critical", 'Manca il tag <meta name="viewport">: senza, i browser mobile spesso mostrano una versione desktop rimpicciolita, difficile da leggere e usare.', "Usabilita' di base su dispositivi mobili")
    );
    recommendations.push(
      recommendation("mobile", "Aggiungi il meta viewport", "critical", "Senza questo tag il layout non si adatta affatto agli schermi piccoli.", "Usabilita' mobile di base", 'Aggiungi <meta name="viewport" content="width=device-width, initial-scale=1">.')
    );
  } else {
    strengths.push("Il tag meta viewport e' presente.");
    const viewportContent = $?.('meta[name="viewport"]').attr("content") ?? "";
    if (/user-scalable\s*=\s*no|maximum-scale\s*=\s*1(\.0)?\b/i.test(viewportContent)) {
      responsiveStructureScore -= 20;
      findings.push(finding("mobile", "Zoom disabilitato dal viewport", "medium", "Il meta viewport impedisce lo zoom (user-scalable=no o maximum-scale=1): limita l'accessibilita' per chi ha difficolta' visive.", "Accessibilita' per utenti con ipovisione", viewportContent));
    }
    if (!/width\s*=\s*device-width/i.test(viewportContent)) {
      responsiveStructureScore -= 15;
    }
  }

  // ---- Mobile Usability (euristica, dato parziale) -----------------------
  // Non esegue un rendering reale: rileva solo pattern testuali nel
  // CSS/HTML scaricato (font molto piccoli, elementi a larghezza fissa
  // ampia). Dichiarato "partial", mai spacciato per una misura definitiva.
  let mobileUsabilityScore = 100;
  const html = home?.html ?? "";
  const smallFonts = Array.from(html.matchAll(SMALL_FONT_PATTERN))
    .map((m) => Number(m[1]))
    .filter((size) => size > 0 && size < 12);
  if (smallFonts.length > 0) {
    mobileUsabilityScore -= 20;
    findings.push(finding("mobile", "Testo con dimensione molto piccola rilevata nel CSS", "low", `Rilevate ${smallFonts.length} dichiarazioni di font-size sotto i 12px nel codice della pagina.`, "Leggibilita' su schermi piccoli", `Esempio: font-size: ${smallFonts[0]}px`));
  }

  // ---- Visual Layout (euristica, dato parziale) --------------------------
  let visualLayoutScore = 100;
  const fixedWidths = Array.from(html.matchAll(FIXED_WIDTH_PATTERN))
    .map((m) => Number(m[1]))
    .filter((w) => w > 600);
  if (fixedWidths.length > 0) {
    visualLayoutScore -= 25;
    findings.push(
      finding("mobile", "Elementi a larghezza fissa ampia rilevati", "medium", `Rilevate ${fixedWidths.length} dichiarazioni di larghezza fissa superiore a 600px nel codice della pagina: possono causare scorrimento orizzontale su schermi stretti.`, "Rischio di layout non adattivo su schermi piccoli", `Esempio: width: ${fixedWidths[0]}px`)
    );
    recommendations.push(recommendation("mobile", "Sostituisci le larghezze fisse ampie con unita' relative", "medium", "Elementi a larghezza fissa superiore alla larghezza di uno schermo mobile possono causare scorrimento orizzontale indesiderato.", "Layout adattivo su schermi piccoli", "Usa percentuali, max-width o unita' relative (%, vw, rem) al posto di larghezze fisse in pixel per gli elementi principali."));
  }

  // ---- Forms (reale, via markup) ------------------------------------------
  let formsScore = 100;
  let formsPresent = false;
  if ($) {
    const inputs = $("input:not([type=hidden]):not([type=submit]):not([type=button])");
    formsPresent = inputs.length > 0;
    if (formsPresent) {
      let unlabeled = 0;
      inputs.each((_, el) => {
        const id = $(el).attr("id");
        const ariaLabel = $(el).attr("aria-label");
        const placeholder = $(el).attr("placeholder");
        const hasLabel = id ? $(`label[for="${id}"]`).length > 0 : false;
        if (!hasLabel && !ariaLabel && !placeholder) unlabeled++;
      });
      if (unlabeled > 0) {
        formsScore -= Math.min(40, unlabeled * 15);
        findings.push(finding("mobile", "Campi modulo senza etichetta associata", "medium", `${unlabeled} campo/i input senza label, aria-label o placeholder rilevabile: su mobile, dove lo spazio e' ridotto, l'assenza di etichette rende il modulo piu' difficile da compilare.`, "Facilita' di compilazione dei moduli su mobile"));
      } else {
        strengths.push("I campi dei moduli rilevati hanno un'etichetta associata.");
      }
    }
  }

  // ---- Mobile Performance (riusa la stessa chiamata PSI, strategy=mobile,
  // gia' effettuata per la categoria Performance — brief sezione 32) -------
  const mobilePerformanceScore = psi?.score ?? 60;
  const mobilePerformanceAvailability = psi ? "verified" : "unavailable";
  if (psi && psi.score < 50) {
    findings.push(finding("mobile", "Prestazioni di caricamento mobile sotto la soglia", "high", `Punteggio performance reale (strategia mobile) di ${psi.score}/100.`, "Velocita' percepita su connessioni e dispositivi mobili"));
  }

  const subScores = [
    sub("responsive_structure", "Responsive Structure", responsiveStructureScore, WEIGHTS.responsiveStructure, "verified"),
    sub("mobile_usability", "Mobile Usability", mobileUsabilityScore, WEIGHTS.mobileUsability, "partial"),
    sub("visual_layout", "Visual Layout", visualLayoutScore, WEIGHTS.visualLayout, "partial"),
    sub("forms", "Forms", formsScore, WEIGHTS.forms, formsPresent ? "verified" : "not_applicable"),
    sub("mobile_performance", "Mobile Performance", mobilePerformanceScore, WEIGHTS.mobilePerformance, mobilePerformanceAvailability),
  ];

  return buildAnalysisResult({
    category: "mobile",
    subScores,
    strengths,
    findings,
    recommendations,
    metrics: {
      viewport_present: facts.viewportPresent,
      small_font_declarations: smallFonts.length,
      fixed_width_declarations: fixedWidths.length,
      forms_detected: formsPresent,
      mobile_performance_score: psi?.score ?? null,
    },
    notes:
      "Typography, Navigation e Interactive Elements sono verificati solo tramite pattern nel codice scaricato, non tramite un rendering browser reale: trattali come indicazioni parziali, non come una misura definitiva.",
    shortSummary:
      responsiveStructureScore >= 75
        ? "La struttura responsive di base e' presente; alcuni dettagli di layout su schermi piccoli potrebbero necessitare verifica manuale."
        : "La struttura responsive di base presenta lacune che possono compromettere l'esperienza su dispositivi mobili.",
  });
}
