// Chiama Google PageSpeed Insights (strategia mobile) ed espone sia i Core
// Web Vitals sia gli audit diagnostici che la risposta di Lighthouse gia'
// contiene (risorse che bloccano il rendering, CSS/JS inutilizzato,
// immagini non ottimizzate, compressione, cache), senza fare piu' di una
// chiamata per scan (brief audit sezione 32). Usato da
// src/lib/analysis/categories/performance.ts e categories/mobile.ts.
export interface PageSpeedAudit {
  // "verified" quando Lighthouse ha effettivamente calcolato l'audit,
  // "unavailable" quando l'audit non era presente nella risposta (brief
  // sezione 34: mai un valore inventato al posto di "non disponibile").
  available: boolean;
  score: number | null; // 0-1 lighthouse score, null se non applicabile
  displayValue: string | null;
}

export interface PageSpeedFullResult {
  score: number; // Punteggio Lighthouse performance, 0-100
  lcpMs: number | null;
  clsScore: number | null;
  inpMs: number | null;
  fcpMs: number | null;
  ttfbMs: number | null;
  speedIndexMs: number | null;
  totalBlockingTimeMs: number | null;
  audits: {
    renderBlockingResources: PageSpeedAudit;
    unusedCssRules: PageSpeedAudit;
    unusedJavascript: PageSpeedAudit;
    optimizedImages: PageSpeedAudit;
    textCompression: PageSpeedAudit;
    longCacheTtl: PageSpeedAudit;
  };
}

const UNAVAILABLE_AUDIT: PageSpeedAudit = { available: false, score: null, displayValue: null };

function readAudit(
  audits: Record<string, { score?: number | null; displayValue?: string }> | undefined,
  id: string
): PageSpeedAudit {
  const audit = audits?.[id];
  if (!audit) return UNAVAILABLE_AUDIT;
  return {
    available: true,
    score: typeof audit.score === "number" ? audit.score : null,
    displayValue: audit.displayValue ?? null,
  };
}

/**
 * Chiama Google PageSpeed Insights (strategia mobile) per la homepage e
 * ritorna sia i Core Web Vitals sia gli audit diagnostici (risorse che
 * bloccano il rendering, CSS/JS inutilizzato, immagini non ottimizzate,
 * compressione testo, cache) gia' presenti nella risposta di Lighthouse.
 * Ritorna null se la chiave non e' configurata o la richiesta fallisce:
 * in quel caso il chiamante deve trattare la categoria come "unavailable",
 * mai inventare un punteggio.
 */
export async function fetchPageSpeedFull(url: string): Promise<PageSpeedFullResult | null> {
  const apiKey = process.env.PAGESPEED_API_KEY;
  if (!apiKey) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25_000);

  try {
    const endpoint =
      `https://www.googleapis.com/pagespeedonline/v5/runPagespeed` +
      `?url=${encodeURIComponent(url)}&key=${apiKey}&strategy=mobile&category=performance`;

    const response = await fetch(endpoint, { signal: controller.signal });
    if (!response.ok) return null;

    const data = (await response.json()) as {
      lighthouseResult?: {
        categories?: { performance?: { score?: number } };
        audits?: Record<string, { numericValue?: number; score?: number | null; displayValue?: string }>;
      };
    };

    const rawScore = data.lighthouseResult?.categories?.performance?.score;
    if (typeof rawScore !== "number") return null;

    const audits = data.lighthouseResult?.audits ?? {};

    return {
      score: Math.round(rawScore * 100),
      lcpMs: audits["largest-contentful-paint"]?.numericValue ?? null,
      clsScore: audits["cumulative-layout-shift"]?.numericValue ?? null,
      inpMs: audits["interaction-to-next-paint"]?.numericValue ?? audits["max-potential-fid"]?.numericValue ?? null,
      fcpMs: audits["first-contentful-paint"]?.numericValue ?? null,
      ttfbMs: audits["server-response-time"]?.numericValue ?? null,
      speedIndexMs: audits["speed-index"]?.numericValue ?? null,
      totalBlockingTimeMs: audits["total-blocking-time"]?.numericValue ?? null,
      audits: {
        renderBlockingResources: readAudit(audits, "render-blocking-resources"),
        unusedCssRules: readAudit(audits, "unused-css-rules"),
        unusedJavascript: readAudit(audits, "unused-javascript"),
        optimizedImages: readAudit(audits, "uses-optimized-images"),
        textCompression: readAudit(audits, "uses-text-compression"),
        longCacheTtl: readAudit(audits, "uses-long-cache-ttl"),
      },
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
