import type { CrawlResult, SeoFacts } from "@/types";
import type { AnalysisResult } from "../types";
import { buildAnalysisResult, finding, recommendation, sub } from "../helpers";

// Sottopunteggi Technical (brief audit sezione 11): HTTP, Security Headers,
// Resources, Architecture, Reliability Signals — separata dalla SEO
// (che resta responsabile di robots/sitemap/canonical, brief sezione 5).
const WEIGHTS = {
  http: 0.3,
  securityHeaders: 0.3,
  architecture: 0.2,
  reliability: 0.2,
};

// Header di sicurezza pubblicamente osservabili, mai un vulnerability
// scanner (brief sezione 35: solo ispezione pubblica e sicura).
const SECURITY_HEADER_CHECKS: { key: string; label: string; weight: number }[] = [
  { key: "content-security-policy", label: "Content-Security-Policy", weight: 25 },
  { key: "x-content-type-options", label: "X-Content-Type-Options", weight: 15 },
  { key: "referrer-policy", label: "Referrer-Policy", weight: 15 },
  { key: "permissions-policy", label: "Permissions-Policy", weight: 10 },
  { key: "strict-transport-security", label: "Strict-Transport-Security (HSTS)", weight: 20 },
  { key: "x-frame-options", label: "X-Frame-Options", weight: 15 },
];

export function analyzeTechnical(facts: SeoFacts, crawl: CrawlResult): AnalysisResult {
  const findings = [];
  const recommendations = [];
  const strengths: string[] = [];
  const home = crawl.pages[0];
  const headers = home?.responseHeaders ?? {};

  // ---- HTTP ------------------------------------------------------------
  let httpScore = 100;
  if (!facts.httpsUsed) {
    httpScore -= 50;
    findings.push(
      finding("technical", "Il sito non usa HTTPS", "critical", "La homepage e' servita su HTTP invece che HTTPS: i browser mostrano avvisi di sicurezza e i dati inviati dai visitatori non sono cifrati.", "Sicurezza dei dati e fiducia dei visitatori")
    );
    recommendations.push(
      recommendation("technical", "Attiva HTTPS", "critical", "Senza HTTPS i browser segnalano il sito come non sicuro e Google penalizza il posizionamento.", "Sicurezza e fiducia", "Attiva un certificato SSL (spesso gratuito, es. Let's Encrypt) e forza il redirect da HTTP a HTTPS.")
    );
  } else {
    strengths.push("Il sito usa HTTPS.");
  }
  if (facts.statusCode >= 400) {
    httpScore -= 40;
    findings.push(finding("technical", "La homepage restituisce un errore HTTP", "critical", `Codice di stato ${facts.statusCode} sulla homepage.`, "Disponibilita' del sito"));
  }
  const redirectHops = home?.redirectCount ?? 0;
  if (redirectHops > 2) {
    httpScore -= 15;
    findings.push(finding("technical", "Catena di redirect lunga", "medium", `${redirectHops} redirect prima di raggiungere la homepage: ogni hop aggiunge latenza.`, "Velocita' di primo caricamento"));
  }

  // Mixed content: risorse http:// referenziate da una pagina https://
  // (controllo leggero via regex sull'HTML, nessuna richiesta aggiuntiva).
  let mixedContentDetected = false;
  if (facts.httpsUsed && home) {
    mixedContentDetected = /(src|href)\s*=\s*["']http:\/\//i.test(home.html);
    if (mixedContentDetected) {
      httpScore -= 15;
      findings.push(finding("technical", "Possibile mixed content", "medium", "La pagina https:// referenzia almeno una risorsa su http://: puo' essere bloccata dal browser o mostrare avvisi di sicurezza.", "Sicurezza e rendering coerente della pagina"));
      recommendations.push(recommendation("technical", "Rimuovi i riferimenti http:// dalla pagina", "medium", "Le risorse caricate in http:// su una pagina https:// possono essere bloccate silenziosamente dal browser.", "Sicurezza e affidabilita' del rendering", "Aggiorna tutti i riferimenti a risorse (immagini, script, css) per usare https://."));
    }
  }

  // ---- Security Headers --------------------------------------------------
  let securityHeadersScore = 0;
  const missingHeaders: string[] = [];
  const presentHeaders: string[] = [];
  const securityHeadersDetail: { label: string; present: boolean }[] = [];
  for (const check of SECURITY_HEADER_CHECKS) {
    const present = !!headers[check.key];
    securityHeadersDetail.push({ label: check.label, present });
    if (present) {
      securityHeadersScore += check.weight;
      presentHeaders.push(check.label);
    } else {
      missingHeaders.push(check.label);
    }
  }
  if (presentHeaders.length > 0) strengths.push(`Header di sicurezza presenti: ${presentHeaders.join(", ")}.`);
  if (missingHeaders.length > 0) {
    findings.push(
      finding(
        "technical",
        "Header di sicurezza HTTP mancanti",
        missingHeaders.length >= 4 ? "high" : "medium",
        `Non rilevati: ${missingHeaders.join(", ")}.`,
        "Protezione da attacchi comuni lato browser (XSS, clickjacking, MIME sniffing)",
        Object.keys(headers).length > 0 ? `Header rilevati: ${Object.keys(headers).join(", ")}` : undefined
      )
    );
    recommendations.push(
      recommendation("technical", "Configura gli header di sicurezza HTTP mancanti", "medium", "Gli header di sicurezza sono una difesa a basso sforzo contro classi comuni di attacco lato browser.", "Robustezza di sicurezza di base", `Aggiungi a livello di server/CDN: ${missingHeaders.join(", ")}.`)
    );
  }

  // ---- Architecture (DOM, dipendenze terze parti osservabili) -----------
  let architectureScore = 100;
  const domNodeEstimate = home ? (home.html.match(/<[a-z][a-z0-9]*/gi) ?? []).length : 0;
  if (domNodeEstimate > 1500) {
    architectureScore -= 20;
    findings.push(finding("technical", "DOM molto grande", "medium", `Circa ${domNodeEstimate} elementi HTML rilevati in homepage: un DOM eccessivo rallenta rendering e interazione.`, "Velocita' di rendering e interazione"));
  }
  const externalScriptCount = home ? (home.html.match(/<script[^>]+src=["']https?:\/\//gi) ?? []).length : 0;
  if (externalScriptCount > 15) {
    architectureScore -= 15;
    findings.push(finding("technical", "Molte dipendenze script di terze parti", "low", `Circa ${externalScriptCount} script esterni caricati in homepage.`, "Velocita' di caricamento e superficie di rischio"));
  }

  // ---- Reliability Signals ------------------------------------------------
  let reliabilityScore = 100;
  const failedFetches = crawl.errors.length;
  if (failedFetches > 0) {
    reliabilityScore -= Math.min(40, failedFetches * 10);
    findings.push(finding("technical", "Alcune pagine collegate non sono raggiungibili", "medium", `${failedFetches} richiesta/e fallite durante la scansione delle pagine collegate dalla homepage.`, "Affidabilita' percepita del sito", crawl.errors.slice(0, 3).map((e) => `${e.url}: ${e.message}`).join("; ")));
  }

  const subScores = [
    sub("http", "HTTP", httpScore, WEIGHTS.http),
    sub("security_headers", "Security Headers", securityHeadersScore, WEIGHTS.securityHeaders),
    sub("architecture", "Architecture", architectureScore, WEIGHTS.architecture),
    sub("reliability", "Reliability Signals", reliabilityScore, WEIGHTS.reliability),
  ];

  return buildAnalysisResult({
    category: "technical",
    subScores,
    strengths,
    findings,
    recommendations,
    metrics: {
      https_used: facts.httpsUsed,
      status_code: facts.statusCode,
      redirect_hops: redirectHops,
      security_headers_present: presentHeaders.length,
      security_headers_total: SECURITY_HEADER_CHECKS.length,
      security_headers_detail: securityHeadersDetail,
      mixed_content_detected: mixedContentDetected,
      dom_elements_estimate: domNodeEstimate || null,
    },
    shortSummary:
      httpScore >= 75 && securityHeadersScore >= 60
        ? "L'infrastruttura tecnica di base (HTTPS, header di sicurezza) e' complessivamente solida."
        : "Alcuni aspetti tecnici di base (sicurezza HTTP, affidabilita') richiedono attenzione.",
  });
}
