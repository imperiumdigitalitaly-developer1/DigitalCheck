import type { CrawlResult } from "@/types";
import type { PageSpeedFullResult } from "../pagespeed";
import type { AnalysisResult, DataAvailability, Finding, Recommendation } from "../types";
import { buildAnalysisResult, finding, recommendation, sub } from "../helpers";

// Sottopunteggi Performance (brief audit sezione 6): Core Web Vitals,
// Loading, Assets, Caching & Compression. "Rendering"/"Third-party" del
// brief sono trattati come parte di Loading/Assets: i dati Lighthouse
// disponibili via PSI non separano ulteriormente senza chiamate aggiuntive
// (brief sezione 32: mai duplicare la stessa scansione).
const WEIGHTS = {
  coreWebVitals: 0.4,
  loading: 0.25,
  assets: 0.2,
  cachingCompression: 0.15,
};

function auditPenalty(available: boolean, score: number | null): number {
  if (!available || score == null) return 0; // "non disponibile" non e' mai un errore da penalizzare
  return Math.round((1 - score) * 100); // score Lighthouse 0-1, 1 = nessun problema
}

// psi va recuperato UNA sola volta a livello di pipeline (fetchPageSpeedFull)
// e riusato sia qui sia in analyzeMobile (brief sezione 32: mai due
// scansioni indipendenti dello stesso sito quando il dato e' condivisibile).
export function analyzePerformance(psi: PageSpeedFullResult | null, crawl: CrawlResult): AnalysisResult {
  const findings: Finding[] = [];
  const recommendations: Recommendation[] = [];
  const strengths: string[] = [];

  if (!psi) {
    return analyzeFallback(crawl, findings, recommendations, strengths);
  }

  // ---- Core Web Vitals --------------------------------------------------
  let coreWebVitalsScore = psi.score;
  if (psi.lcpMs != null && psi.lcpMs > 4000) {
    findings.push(finding("performance", "LCP oltre la soglia raccomandata", "high", `Largest Contentful Paint di ${(psi.lcpMs / 1000).toFixed(1)}s (soglia raccomandata: 2.5s).`, "Percezione di velocita' al primo caricamento", `LCP: ${(psi.lcpMs / 1000).toFixed(1)}s`));
    recommendations.push(recommendation("performance", "Riduci il tempo di LCP", "high", "Un LCP alto fa percepire il sito come lento nel momento piu' critico, il primo caricamento.", "Percezione di velocita'", "Ottimizza l'immagine/elemento principale above-the-fold: compressione, dimensioni corrette, precaricamento."));
  } else if (psi.lcpMs != null) {
    strengths.push(`LCP entro la soglia raccomandata (${(psi.lcpMs / 1000).toFixed(1)}s).`);
  }
  if (psi.clsScore != null && psi.clsScore > 0.25) {
    findings.push(finding("performance", "Cumulative Layout Shift elevato", "medium", `CLS di ${psi.clsScore.toFixed(2)} (soglia raccomandata: 0.1): la pagina si sposta visivamente durante il caricamento.`, "Stabilita' visiva ed esperienza utente", `CLS: ${psi.clsScore.toFixed(2)}`));
  }
  if (psi.inpMs != null && psi.inpMs > 500) {
    findings.push(finding("performance", "Tempo di risposta alle interazioni elevato", "medium", `INP di ${Math.round(psi.inpMs)}ms (soglia raccomandata: 200ms).`, "Reattivita' percepita durante l'uso"));
  }
  if (psi.score < 50) {
    findings.push(finding("performance", "Punteggio performance reale sotto la soglia", "high", `Google PageSpeed Insights assegna ${psi.score}/100 (mobile).`, "Velocita' complessiva percepita dai visitatori mobile"));
  }

  // ---- Loading (FCP, TTFB, Speed Index) ----------------------------------
  let loadingScore = 100;
  const loadingParts: number[] = [];
  if (psi.ttfbMs != null) {
    loadingParts.push(psi.ttfbMs > 1800 ? 40 : psi.ttfbMs > 800 ? 75 : 100);
    if (psi.ttfbMs > 1800) findings.push(finding("performance", "Tempo di risposta del server (TTFB) elevato", "medium", `TTFB di ${Math.round(psi.ttfbMs)}ms.`, "Tempo prima che qualunque contenuto inizi a caricare"));
  }
  if (psi.fcpMs != null) {
    loadingParts.push(psi.fcpMs > 3000 ? 40 : psi.fcpMs > 1800 ? 75 : 100);
  }
  if (psi.speedIndexMs != null) {
    loadingParts.push(psi.speedIndexMs > 5800 ? 40 : psi.speedIndexMs > 3400 ? 75 : 100);
  }
  if (psi.totalBlockingTimeMs != null) {
    loadingParts.push(psi.totalBlockingTimeMs > 600 ? 40 : psi.totalBlockingTimeMs > 200 ? 75 : 100);
    if (psi.totalBlockingTimeMs > 600) findings.push(finding("performance", "Total Blocking Time elevato", "medium", `${Math.round(psi.totalBlockingTimeMs)}ms in cui il thread principale era bloccato.`, "Reattivita' durante il caricamento"));
  }
  loadingScore = loadingParts.length > 0 ? Math.round(loadingParts.reduce((a, b) => a + b, 0) / loadingParts.length) : coreWebVitalsScore;
  const loadingAvailability: DataAvailability = loadingParts.length > 0 ? "verified" : "unavailable";

  // ---- Assets (immagini, JS/CSS inutilizzato, render-blocking) ----------
  let assetsScore = 100;
  const assetChecks: { audit: typeof psi.audits.renderBlockingResources; label: string; sev: "medium" | "low" }[] = [
    { audit: psi.audits.renderBlockingResources, label: "Risorse che bloccano il rendering", sev: "medium" },
    { audit: psi.audits.unusedCssRules, label: "CSS inutilizzato", sev: "low" },
    { audit: psi.audits.unusedJavascript, label: "JavaScript inutilizzato", sev: "medium" },
    { audit: psi.audits.optimizedImages, label: "Immagini non ottimizzate", sev: "medium" },
  ];
  let anyAssetAuditAvailable = false;
  for (const check of assetChecks) {
    if (!check.audit.available) continue;
    anyAssetAuditAvailable = true;
    const penalty = auditPenalty(check.audit.available, check.audit.score);
    if (penalty > 20) {
      assetsScore -= Math.min(25, penalty / 3);
      findings.push(finding("performance", check.label, check.sev, `Lighthouse segnala questo aspetto come migliorabile${check.audit.displayValue ? ` (${check.audit.displayValue})` : ""}.`, "Peso delle risorse caricate e tempo di rendering"));
    }
  }
  if (assetChecks.some((c) => c.audit.available && (c.audit.score ?? 1) > 0.9)) {
    strengths.push("Le risorse principali (immagini, CSS, JS) risultano ben ottimizzate secondo Lighthouse.");
  }

  // ---- Caching & Compression ----------------------------------------------
  let cachingScore = 100;
  let cachingAvailable = false;
  if (psi.audits.textCompression.available) {
    cachingAvailable = true;
    const penalty = auditPenalty(true, psi.audits.textCompression.score);
    if (penalty > 20) {
      cachingScore -= 30;
      findings.push(finding("performance", "Compressione testo non attiva o parziale", "medium", "Le risposte testuali (HTML/CSS/JS) non risultano compresse in modo ottimale (gzip/brotli).", "Peso di trasferimento e velocita' di caricamento"));
      recommendations.push(recommendation("performance", "Attiva la compressione delle risposte testuali", "medium", "Senza compressione, ogni visitatore scarica piu' byte del necessario a ogni richiesta.", "Velocita' di caricamento", "Abilita gzip o brotli sul server/CDN per risposte HTML, CSS e JavaScript."));
    }
  }
  if (psi.audits.longCacheTtl.available) {
    cachingAvailable = true;
    const penalty = auditPenalty(true, psi.audits.longCacheTtl.score);
    if (penalty > 20) {
      cachingScore -= 25;
      findings.push(finding("performance", "Cache delle risorse statiche non ottimale", "low", "Alcune risorse statiche non hanno una durata di cache lunga.", "Velocita' delle visite ripetute"));
    }
  }

  const subScores = [
    sub("core_web_vitals", "Core Web Vitals", coreWebVitalsScore, WEIGHTS.coreWebVitals, "verified"),
    sub("loading", "Loading", loadingScore, WEIGHTS.loading, loadingAvailability),
    sub("assets", "Assets", assetsScore, WEIGHTS.assets, anyAssetAuditAvailable ? "verified" : "unavailable"),
    sub("caching_compression", "Caching & Compression", cachingScore, WEIGHTS.cachingCompression, cachingAvailable ? "verified" : "unavailable"),
  ];

  return buildAnalysisResult({
    category: "performance",
    subScores,
    strengths,
    findings,
    recommendations,
    metrics: {
      lighthouse_score: psi.score,
      lcp_ms: psi.lcpMs,
      cls: psi.clsScore,
      inp_ms: psi.inpMs,
      fcp_ms: psi.fcpMs,
      ttfb_ms: psi.ttfbMs,
      speed_index_ms: psi.speedIndexMs,
      total_blocking_time_ms: psi.totalBlockingTimeMs,
    },
    notes: "Dati reali da Google PageSpeed Insights (Lighthouse, strategia mobile).",
    shortSummary:
      psi.score >= 75
        ? "Le prestazioni di caricamento reali (Core Web Vitals) sono nella media o sopra la media."
        : "Le prestazioni di caricamento reali mostrano margini di miglioramento su uno o piu' Core Web Vitals.",
  });
}

function analyzeFallback(crawl: CrawlResult, findings: Finding[], recommendations: Recommendation[], strengths: string[]): AnalysisResult {
  // Nessuna PAGESPEED_API_KEY configurata o richiesta fallita: euristica
  // grezza sulla sola dimensione HTML, dichiarata esplicitamente come
  // stima "unavailable" (brief sezione 6: mai un Core Web Vital finto).
  const homeSize = crawl.pages[0]?.sizeBytes ?? 0;
  let sizeScore = 100;
  if (homeSize > 500_000) {
    sizeScore -= 35;
    findings.push(finding("performance", "Pagina HTML molto pesante", "medium", `La homepage pesa circa ${Math.round(homeSize / 1024)} KB solo di HTML.`, "Velocita' di caricamento su connessioni mobili"));
  } else if (homeSize > 250_000) {
    sizeScore -= 15;
  } else {
    strengths.push("Il peso HTML della homepage e' contenuto.");
  }

  return buildAnalysisResult({
    category: "performance",
    subScores: [
      sub("core_web_vitals", "Core Web Vitals", sizeScore, WEIGHTS.coreWebVitals, "unavailable"),
      sub("loading", "Loading", sizeScore, WEIGHTS.loading, "unavailable"),
      sub("assets", "Assets", 70, WEIGHTS.assets, "unavailable"),
      sub("caching_compression", "Caching & Compression", 70, WEIGHTS.cachingCompression, "unavailable"),
    ],
    strengths,
    findings,
    recommendations,
    metrics: { lighthouse_score: null, lcp_ms: null, cls: null, inp_ms: null },
    notes: "Nessuna misura Core Web Vitals reale disponibile (PAGESPEED_API_KEY non configurata o richiesta non riuscita): punteggio stimato dal solo peso HTML della homepage.",
    shortSummary: "Dati di performance reali non disponibili per questa analisi: punteggio stimato in modo approssimativo.",
  });
}
