import * as cheerio from "cheerio";
import type { CrawlResult, SeoFacts } from "@/types";
import type { AnalysisResult } from "../types";
import { buildAnalysisResult, finding, recommendation, sub } from "../helpers";

// Sottopunteggi Accessibility (brief audit sezione 10), basati sui
// controlli effettivamente verificabili da un crawler HTML (senza
// rendering reale ne' navigazione da tastiera simulata — dichiarato
// esplicitamente "partial" dove pertinente, mai una dichiarazione di
// conformita' WCAG completa, brief sezione 10).
const WEIGHTS = { semanticStructure: 0.25, images: 0.2, forms: 0.2, navigation: 0.2, aria: 0.15 };

const GENERIC_LINK_TEXT = /^(clicca qui|leggi di più|leggi tutto|read more|click here|scopri di più|qui)$/i;

export function analyzeAccessibility(facts: SeoFacts, crawl: CrawlResult): AnalysisResult {
  const findings = [];
  const recommendations = [];
  const strengths: string[] = [];
  const home = crawl.pages[0];
  const $ = home ? cheerio.load(home.html) : null;

  // ---- Semantic Structure --------------------------------------------------
  let semanticStructureScore = 100;
  if (!facts.langAttribute) {
    semanticStructureScore -= 25;
    findings.push(finding("accessibility", "Lingua della pagina non dichiarata", "medium", 'Il tag <html> non ha l\'attributo lang: gli screen reader non sanno con quale pronuncia leggere la pagina.', "Corretta lettura da parte di tecnologie assistive", 'Aggiungi lang="it" (o la lingua corretta) al tag <html>.'));
  } else {
    strengths.push("La lingua della pagina e' dichiarata correttamente.");
  }
  if (facts.h1.length === 0) {
    semanticStructureScore -= 15;
  }
  // Ordine di gerarchia: un H3 prima di un H2 e' un salto di livello
  // (verificabile solo sull'ordine di apparizione nel DOM, non sul nesting
  // visivo — dato "verified" perche' l'ordine del markup e' un fatto).
  let headingOrderViolation = false;
  if ($) {
    let lastLevel = 0;
    $("h1, h2, h3, h4, h5, h6").each((_, el) => {
      const level = Number(el.tagName.slice(1));
      if (lastLevel > 0 && level > lastLevel + 1) headingOrderViolation = true;
      lastLevel = level;
    });
  }
  if (headingOrderViolation) {
    semanticStructureScore -= 15;
    findings.push(finding("accessibility", "Salto nella gerarchia dei titoli", "low", "Rilevato un livello di titolo (es. H3) che compare senza un livello intermedio precedente (es. H2): puo' confondere la navigazione con tecnologie assistive.", "Navigazione strutturata per chi usa uno screen reader"));
  }
  // Landmark semantici (header/nav/main/footer).
  const landmarks = $ ? ["header", "nav", "main", "footer"].filter((tag) => $(tag).length > 0) : [];
  if (landmarks.length < 2) {
    semanticStructureScore -= 15;
    findings.push(finding("accessibility", "Pochi elementi semantici di struttura (landmark)", "low", `Rilevati solo ${landmarks.length} elementi tra header/nav/main/footer: questi tag aiutano la navigazione rapida con tecnologie assistive.`, "Navigazione rapida tra le aree della pagina"));
  } else {
    strengths.push("La pagina usa elementi semantici di struttura (es. header, nav, main, footer).");
  }

  // ---- Images -----------------------------------------------------------
  let imagesScore = 100;
  const altRatio = facts.images.total > 0 ? facts.images.withAlt / facts.images.total : 1;
  if (facts.images.total > 0 && altRatio < 1) {
    const missing = facts.images.total - facts.images.withAlt;
    imagesScore -= Math.min(60, missing * 8);
    findings.push(
      finding("accessibility", "Immagini senza testo alternativo", missing / facts.images.total > 0.5 ? "high" : "medium", `${missing} immagini su ${facts.images.total} non hanno l'attributo alt.`, "Comprensione delle immagini per chi usa uno screen reader")
    );
    recommendations.push(recommendation("accessibility", "Aggiungi testo alternativo alle immagini", "medium", "Senza alt, uno screen reader non puo' comunicare il contenuto o la funzione dell'immagine.", "Accesso al contenuto visivo per tecnologie assistive", "Aggiungi un testo alt descrittivo a ogni immagine significativa (stringa vuota alt=\"\" per le immagini puramente decorative)."));
  } else if (facts.images.total > 0) {
    strengths.push("Tutte le immagini rilevate hanno un testo alternativo.");
  }
  const iframesWithoutTitle = $ ? $("iframe:not([title])").length : 0;
  if (iframesWithoutTitle > 0) {
    imagesScore -= 15;
    findings.push(finding("accessibility", "iframe senza attributo title", "low", `${iframesWithoutTitle} iframe senza title rilevati: senza, uno screen reader non puo' descriverne il contenuto.`, "Comprensione dei contenuti incorporati"));
  }

  // ---- Forms --------------------------------------------------------------
  let formsScore = 100;
  let formsPresent = false;
  if ($) {
    const inputs = $("input:not([type=hidden])");
    formsPresent = inputs.length > 0;
    if (formsPresent) {
      let unlabeled = 0;
      inputs.each((_, el) => {
        const id = $(el).attr("id");
        const ariaLabel = $(el).attr("aria-label") || $(el).attr("aria-labelledby");
        const hasLabel = id ? $(`label[for="${id}"]`).length > 0 : false;
        if (!hasLabel && !ariaLabel) unlabeled++;
      });
      if (unlabeled > 0) {
        formsScore -= Math.min(60, unlabeled * 20);
        findings.push(finding("accessibility", "Campi modulo senza etichetta accessibile", "high", `${unlabeled} campo/i senza <label> associato o aria-label: uno screen reader non puo' identificarne lo scopo.`, "Compilazione del modulo con tecnologie assistive"));
        recommendations.push(recommendation("accessibility", "Associa un'etichetta a ogni campo modulo", "high", "Senza label associata, uno screen reader annuncia il campo senza indicarne lo scopo.", "Accessibilita' dei moduli", "Collega ogni input a un <label for> con lo stesso id, oppure usa aria-label."));
      } else {
        strengths.push("I campi dei moduli rilevati hanno un'etichetta accessibile.");
      }
    }
  }

  // ---- Navigation (link text quality) --------------------------------------
  let navigationScore = 100;
  let genericLinkCount = 0;
  if ($) {
    $("a[href]").each((_, el) => {
      const text = $(el).text().trim();
      if (GENERIC_LINK_TEXT.test(text)) genericLinkCount++;
    });
  }
  if (genericLinkCount > 0) {
    navigationScore -= Math.min(30, genericLinkCount * 10);
    findings.push(finding("accessibility", "Link con testo generico", "low", `${genericLinkCount} link con testo generico (es. "clicca qui", "leggi di più") rilevati: fuori contesto, non comunicano la destinazione.`, "Comprensione della destinazione dei link, specialmente per chi naviga con screen reader per elenco di link"));
  } else {
    strengths.push("I link rilevati hanno un testo descrittivo.");
  }

  const subScores = [
    sub("semantic_structure", "Semantic Structure", semanticStructureScore, WEIGHTS.semanticStructure),
    sub("images", "Images", imagesScore, WEIGHTS.images, facts.images.total > 0 ? "verified" : "not_applicable"),
    sub("forms", "Forms", formsScore, WEIGHTS.forms, formsPresent ? "verified" : "not_applicable"),
    sub("navigation", "Navigation", navigationScore, WEIGHTS.navigation),
    // Contrasto colore, focus states e navigazione da tastiera reale non
    // sono verificabili senza un rendering browser: dichiarato "unavailable"
    // invece di stimarli (brief sezione 10).
    sub("aria_keyboard_contrast", "ARIA, Keyboard & Contrast", 60, WEIGHTS.aria, "unavailable"),
  ];

  return buildAnalysisResult({
    category: "accessibility",
    subScores,
    strengths,
    findings,
    recommendations,
    metrics: {
      images_total: facts.images.total,
      images_with_alt: facts.images.withAlt,
      lang_declared: !!facts.langAttribute,
      landmarks_detected: landmarks.length,
      generic_link_texts: genericLinkCount,
    },
    notes: "Contrasto colore, ordine di focus e navigazione da tastiera reale non sono verificabili senza un rendering browser completo: non dichiarare conformita' WCAG sulla base di questi soli controlli automatici.",
    shortSummary:
      imagesScore >= 75 && semanticStructureScore >= 75
        ? "Gli aspetti di accessibilita' verificabili automaticamente (struttura semantica, immagini) sono complessivamente curati."
        : "Alcuni aspetti di accessibilita' verificabili automaticamente (struttura semantica, immagini, moduli) necessitano attenzione.",
  });
}
