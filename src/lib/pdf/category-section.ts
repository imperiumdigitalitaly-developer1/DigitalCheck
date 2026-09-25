import type { AnalysisResult, Finding, Recommendation } from "@/lib/analysis/types";
import { SEVERITY_LABEL, SEVERITY_ORDER, STATUS_LABEL, scoreToStatus } from "@/lib/analysis/constants";
import { CATEGORY_LABELS } from "@/lib/category-labels";
import { PdfCanvas, CONTENT_WIDTH, MARGIN } from "./canvas";
import { COLOR, CATEGORY_MONOGRAM, SEVERITY5_COLOR, SEVERITY5_SOFT_COLOR, scoreColor } from "./theme";

/**
 * Pagina di dettaglio completo di UNA categoria per il PDF Pro (redesign
 * PDF, sezioni 6-14): header con monogramma, score/livello/interpretazione,
 * sottopunteggi, punti di forza, metodologia in un box compatto, findings
 * con gerarchia GRAVITA'/PROBLEMA/EVIDENZA/IMPATTO, azioni raccomandate
 * separate. Generica su tutte le 7 categorie SEO-side, con blocchi
 * aggiuntivi solo per Performance (gap vs target), Tecnica (tabella
 * Security Headers) e Conversione (pagina piena anche a zero problemi) —
 * mai un file di disegno duplicato per categoria (brief sezione 27/46).
 * Il GEO ha una propria pagina dedicata, non toccata (geo-section.ts).
 */
export function drawCategoryReportPage(canvas: PdfCanvas, result: AnalysisResult) {
  drawCategoryHeader(canvas, result);

  if (result.subScores.length > 0) drawSubScores(canvas, result);

  if (result.notes) {
    canvas.calloutBox("Metodologia", result.notes, { maxLines: 2 });
  }

  if (result.strengths.length > 0) {
    const headingH = canvas.measure("Punti di forza", { size: 11, font: "bold", gap: 5 });
    canvas.ensureSpace(headingH + 16);
    canvas.kicker("Punti di forza");
    for (const s of result.strengths) canvas.hangingLine("+", s, { size: 9, glyphColor: COLOR.accent, gap: 3, maxLines: 2 });
    canvas.y -= 6;
  }

  // ---- Blocchi specifici per categoria (redesign PDF sezioni 9/14/12) ----
  if (result.category === "performance") drawPerformanceMetrics(canvas, result);
  if (result.category === "technical") drawSecurityHeadersTable(canvas, result);

  canvas.divider();

  const sortedFindings = [...result.findings].sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);

  if (result.category === "conversion" && sortedFindings.length === 0) {
    drawConversionAllClear(canvas, result);
    return;
  }

  if (sortedFindings.length === 0) {
    canvas.calloutBox(
      "Nessun problema rilevante",
      "Non sono state rilevate criticita' significative in questa categoria, nei controlli automatici disponibili.",
      { maxLines: 2 }
    );
  } else {
    // Riserva l'altezza reale della prima card (non una stima fissa come
    // per "Punti di forza"/"Azioni raccomandate": una finding card puo'
    // essere molto piu' alta di una singola riga), cosi' il titolo
    // "Problemi rilevati" non resta mai orfano in fondo pagina con la
    // prima card spinta sulla pagina successiva.
    canvas.ensureSpace(18 + findingCardHeight(canvas, sortedFindings[0]!) + 8);
    canvas.kicker("Problemi rilevati");
    for (const f of sortedFindings) drawFindingCard(canvas, f);
    canvas.y -= 2;
  }

  if (result.recommendations.length > 0) {
    canvas.divider();
    const headingH = canvas.measure("Azioni raccomandate", { size: 11.5, font: "bold", gap: 6 });
    canvas.ensureSpace(headingH + recommendationCardHeight(canvas, result.recommendations[0]!) + 14);
    canvas.kicker("Azioni raccomandate");
    for (const r of result.recommendations) drawRecommendationCard(canvas, r);
  }
}

// ---- Header: monogramma + score + livello + interpretazione -------------
function drawCategoryHeader(canvas: PdfCanvas, result: AnalysisResult) {
  // Riserva header + divider + riga punteggio, cosi' una categoria non
  // parte mai orfana a ridosso del fondo pagina. Le categorie non aprono
  // piu' sempre una pagina nuova (report-pdf.ts): quando c'e' spazio
  // residuo dalla categoria precedente lo si riusa, con un divider a
  // marcare l'inizio della nuova sezione (redesign PDF, sezione 25).
  canvas.ensureSpace(150);
  if (!canvas.isAtPageTop()) {
    canvas.divider();
    canvas.y -= 6;
  }
  const monoSize = 32;
  canvas.monogramBadge(MARGIN, canvas.y, CATEGORY_MONOGRAM[result.category], { size: monoSize });
  const textX = MARGIN + monoSize + 14;
  const savedY = canvas.y;
  canvas.y -= 3;
  canvas.text(`${CATEGORY_LABELS[result.category]} Report`, { size: 15.5, font: "display", color: COLOR.ink, x: textX, maxWidth: CONTENT_WIDTH - monoSize - 14, gap: 2 });
  canvas.text(result.shortSummary, { size: 9, color: COLOR.inkSoft, x: textX, maxWidth: CONTENT_WIDTH - monoSize - 14, maxLines: 2, gap: 0, lineHeightMult: 1.3 });
  canvas.y = Math.min(canvas.y, savedY - monoSize);
  canvas.y -= 14;
  canvas.divider();

  // Score + livello, riga compatta. Il gauge (diametro 2*gaugeR) disegna
  // direttamente sulla pagina senza passare da ensureSpace() come text():
  // la riserva deve coprire l'intero diametro, non un valore arbitrario
  // piu' piccolo, altrimenti il cerchio del punteggio puo' finire sotto la
  // fascia footer (stessa causa del bug sulla pagina di valutazione finale).
  const gaugeR = 22;
  canvas.ensureSpace(gaugeR * 2 + 8);
  const rowTop = canvas.y;
  canvas.scoreGauge({ cx: MARGIN + gaugeR, cy: rowTop - gaugeR, radius: gaugeR, thickness: 6, score: result.score, scoreSize: 15 });
  const statusLabel = STATUS_LABEL[result.status];
  const statusX = MARGIN + gaugeR * 2 + 16;
  canvas.page.drawText(statusLabel, { x: statusX, y: rowTop - gaugeR - 4, size: 12, font: canvas.fontBold, color: scoreColor(result.score) });
  canvas.y = rowTop - gaugeR * 2 - 14;
}

// ---- Sottopunteggi: griglia con tag di verificabilita' --------------------
function drawSubScores(canvas: PdfCanvas, result: AnalysisResult) {
  const rowH = 18;
  canvas.kicker("Metriche principali");
  for (const s of result.subScores) {
    canvas.ensureSpace(rowH);
    const rowTop = canvas.y;
    canvas.page.drawText(s.label, { x: MARGIN, y: rowTop - 12, size: 9, font: canvas.fontRegular, color: COLOR.inkSoft });

    const valueLabel = s.dataAvailability === "unavailable" ? "N/D" : s.dataAvailability === "not_applicable" ? "N/A" : String(s.score);
    const valueColor = s.dataAvailability === "unavailable" ? COLOR.inkSoft : scoreColor(s.score);
    const valueWidth = canvas.fontBold.widthOfTextAtSize(valueLabel, 9.5);
    canvas.page.drawText(valueLabel, { x: MARGIN + CONTENT_WIDTH - valueWidth, y: rowTop - 12, size: 9.5, font: canvas.fontBold, color: valueColor });

    if (s.dataAvailability === "partial" || s.dataAvailability === "unavailable") {
      const tag = s.dataAvailability === "partial" ? "Stimato" : "Non disponibile";
      const tagWidth = canvas.fontRegular.widthOfTextAtSize(tag, 7);
      canvas.page.drawText(tag, { x: MARGIN + CONTENT_WIDTH - valueWidth - tagWidth - 10, y: rowTop - 11.5, size: 7, font: canvas.fontRegular, color: COLOR.inkSoft });
    }
    canvas.y = rowTop - rowH;
  }
  canvas.y -= 6;
}

// ---- Performance: gap reale vs target (redesign PDF, sezione 9) ---------
// Soglie standard di settore (Core Web Vitals / Lighthouse), non inventate
// ne' specifiche al sito: sono il riferimento con cui confrontare il dato
// misurato, esattamente come richiesto ("METRICA/VALORE/TARGET/DIFFERENZA").
const PERFORMANCE_TARGETS: {
  key: string;
  label: string;
  targetMs?: number;
  targetLabel: string;
  format: (v: number) => string;
}[] = [
  { key: "lcp_ms", label: "LCP — Largest Contentful Paint", targetMs: 2500, targetLabel: "max 2.5s", format: (v) => `${(v / 1000).toFixed(1)}s` },
  { key: "inp_ms", label: "INP — Interaction to Next Paint", targetMs: 200, targetLabel: "max 200ms", format: (v) => `${Math.round(v)}ms` },
  { key: "fcp_ms", label: "FCP — First Contentful Paint", targetMs: 1800, targetLabel: "max 1.8s", format: (v) => `${(v / 1000).toFixed(1)}s` },
  { key: "ttfb_ms", label: "TTFB — Time to First Byte", targetMs: 800, targetLabel: "max 0.8s", format: (v) => `${Math.round(v)}ms` },
  { key: "total_blocking_time_ms", label: "Total Blocking Time", targetMs: 200, targetLabel: "max 200ms", format: (v) => `${Math.round(v)}ms` },
  { key: "speed_index_ms", label: "Speed Index", targetMs: 3400, targetLabel: "max 3.4s", format: (v) => `${(v / 1000).toFixed(1)}s` },
];

function drawPerformanceMetrics(canvas: PdfCanvas, result: AnalysisResult) {
  const rows = PERFORMANCE_TARGETS.map((t) => {
    const raw = result.metrics[t.key];
    if (typeof raw !== "number") return null;
    const withinTarget = t.targetMs == null || raw <= t.targetMs;
    return {
      label: t.label,
      value: t.format(raw),
      target: t.targetLabel,
      withinTarget,
    };
  }).filter((r): r is { label: string; value: string; target: string; withinTarget: boolean } => r != null);

  if (rows.length === 0) return;

  const headingH = canvas.measure("Core Web Vitals", { size: 11.5, font: "bold", gap: 6 });
  canvas.ensureSpace(headingH + 24);
  canvas.kicker("Core Web Vitals — dato misurato vs target");
  canvas.keyValueTable(
    rows.map((r) => ({
      label: `${r.label}   ·   Target ${r.target}`,
      value: r.withinTarget ? `${r.value} OK` : r.value,
      valueColor: r.withinTarget ? COLOR.accentDeep : SEVERITY5_COLOR.high,
      valueSoft: r.withinTarget ? COLOR.accentSoft : SEVERITY5_SOFT_COLOR.high,
    }))
  );
}

// ---- Technical: Security Headers come tabella reale (redesign sezione 14) --
function drawSecurityHeadersTable(canvas: PdfCanvas, result: AnalysisResult) {
  const detail = result.metrics.security_headers_detail;
  if (!Array.isArray(detail) || detail.length === 0) return;

  const headingH = canvas.measure("Header di Sicurezza", { size: 11.5, font: "bold", gap: 6 });
  canvas.ensureSpace(headingH + 24);
  canvas.kicker("Header di Sicurezza");
  canvas.keyValueTable(
    detail.map((h) => ({
      label: h.label,
      value: h.present ? "Presente" : "Assente",
      valueColor: h.present ? COLOR.accentDeep : SEVERITY5_COLOR.medium,
      valueSoft: h.present ? COLOR.accentSoft : SEVERITY5_SOFT_COLOR.medium,
    }))
  );
}

// ---- Conversione: nessuna pagina vuota a punteggio alto (sezione 12) -----
function drawConversionAllClear(canvas: PdfCanvas, result: AnalysisResult) {
  canvas.kicker("Cosa funziona");
  if (result.strengths.length > 0) {
    for (const s of result.strengths) canvas.hangingLine("+", s, { size: 9.5, glyphColor: COLOR.accent, gap: 5, maxLines: 2 });
  }
  for (const sub of result.subScores) {
    if (sub.dataAvailability === "not_applicable") continue;
    canvas.hangingLine(sub.score >= 75 ? "+" : "·", `${sub.label}: ${sub.score}/100`, {
      size: 9.5,
      glyphColor: sub.score >= 75 ? COLOR.accent : COLOR.inkSoft,
      gap: 5,
    });
  }
  canvas.y -= 8;
  canvas.divider();

  canvas.calloutBox(
    "Nessuna criticita' rilevata",
    "Non sono state rilevate criticita' significative nei controlli automatici disponibili per questa categoria.",
    { maxLines: 2 }
  );

  canvas.calloutBox(
    "Limiti dell'analisi",
    "Il punteggio si basa sulla presenza di elementi di conversione pertinenti al tipo di attivita' dichiarato: non rappresenta conversioni reali e non deriva da dati Analytics.",
    { maxLines: 2 }
  );
}

// ---- IssueCard: gerarchia GRAVITA'/PROBLEMA/EVIDENZA/IMPATTO ------------
function findingCardHeight(canvas: PdfCanvas, f: Finding): number {
  const padding = 12;
  const innerWidth = CONTENT_WIDTH - padding * 2;
  const titleH = 22;
  const labelH = 11;
  const explH = canvas.measure(f.explanation, { size: 9, maxWidth: innerWidth, lineHeightMult: 1.3, gap: 8 });
  const impactLabelH = 11;
  const impactH = canvas.measure(f.impact, { size: 8.5, maxWidth: innerWidth, lineHeightMult: 1.25, gap: f.evidence ? 8 : 0 });
  const evidenceH = f.evidence ? labelH + canvas.measure(f.evidence, { size: 8.5, maxWidth: innerWidth, lineHeightMult: 1.25, gap: 0 }) : 0;
  return padding * 2 + titleH + labelH + explH + impactLabelH + impactH + evidenceH;
}

function drawFindingCard(canvas: PdfCanvas, f: Finding) {
  const padding = 12;
  const innerWidth = CONTENT_WIDTH - padding * 2;
  const cardHeight = findingCardHeight(canvas, f);

  canvas.ensureSpace(cardHeight + 8);
  const top = canvas.y;
  canvas.roundedRect(MARGIN, top - cardHeight, CONTENT_WIDTH, cardHeight, { radius: 9, fill: COLOR.white, border: COLOR.line, borderWidth: 0.75 });
  canvas.roundedRect(MARGIN, top - cardHeight, 4, cardHeight, { radius: 2, fill: SEVERITY5_COLOR[f.severity] });

  canvas.y = top - padding;
  const badgeW = canvas.severityBadge(MARGIN + padding, canvas.y, SEVERITY_LABEL[f.severity], SEVERITY5_COLOR[f.severity]);
  const titleWidth = innerWidth - badgeW - 10;
  canvas.page.drawText(canvas.fitOneLine(f.title, canvas.fontBold, 11, titleWidth), {
    x: MARGIN + padding + badgeW + 10,
    y: canvas.y - 13,
    size: 11,
    font: canvas.fontBold,
    color: COLOR.ink,
  });
  canvas.y = top - padding - 22 - 4;

  canvas.page.drawText("COSA ABBIAMO RILEVATO", { x: MARGIN + padding, y: canvas.y - 7, size: 7, font: canvas.fontBold, color: COLOR.accent });
  canvas.y -= 11;
  canvas.text(f.explanation, { size: 9, color: COLOR.ink, x: MARGIN + padding, maxWidth: innerWidth, gap: 8, lineHeightMult: 1.3 });

  canvas.page.drawText("IMPATTO", { x: MARGIN + padding, y: canvas.y - 7, size: 7, font: canvas.fontBold, color: COLOR.inkSoft });
  canvas.y -= 11;
  canvas.text(f.impact, { size: 8.5, color: COLOR.inkSoft, x: MARGIN + padding, maxWidth: innerWidth, gap: f.evidence ? 8 : 0, lineHeightMult: 1.25 });

  if (f.evidence) {
    canvas.page.drawText("EVIDENZA", { x: MARGIN + padding, y: canvas.y - 7, size: 7, font: canvas.fontBold, color: COLOR.inkSoft });
    canvas.y -= 11;
    canvas.text(f.evidence, { size: 8.5, color: COLOR.inkSoft, x: MARGIN + padding, maxWidth: innerWidth, gap: 0, lineHeightMult: 1.25 });
  }

  canvas.y = top - cardHeight - 8;
}

// ---- RecommendationCard: azione concreta, separata dal problema ---------
function recommendationCardHeight(canvas: PdfCanvas, r: Recommendation): number {
  const padding = 10;
  const innerWidth = CONTENT_WIDTH - padding * 2 - 8;
  const titleH = 13;
  const actionH = canvas.measure(r.action, { size: 9, maxWidth: innerWidth, lineHeightMult: 1.3, gap: 0 });
  return padding * 2 + titleH + 3 + actionH;
}

function drawRecommendationCard(canvas: PdfCanvas, r: Recommendation) {
  const padding = 10;
  const innerWidth = CONTENT_WIDTH - padding * 2 - 8;
  const cardHeight = recommendationCardHeight(canvas, r);

  canvas.ensureSpace(cardHeight + 6);
  const top = canvas.y;
  canvas.roundedRect(MARGIN, top - cardHeight, CONTENT_WIDTH, cardHeight, { radius: 7, fill: COLOR.accentSoft });
  canvas.roundedRect(MARGIN, top - cardHeight, 4, cardHeight, { radius: 2, fill: COLOR.accent });

  canvas.y = top - padding;
  canvas.text(r.title, { size: 9.5, font: "bold", color: COLOR.accentDeep, x: MARGIN + padding + 8, maxWidth: innerWidth, gap: 3, maxLines: 1 });
  canvas.text(r.action, { size: 9, color: COLOR.ink, x: MARGIN + padding + 8, maxWidth: innerWidth, gap: 0, lineHeightMult: 1.3 });

  canvas.y = top - cardHeight - 6;
}
