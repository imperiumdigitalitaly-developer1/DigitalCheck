import type { GeoIssue, GeoReport } from "@/lib/geo/geo-types";
import { GEO_CATEGORY_LABELS } from "@/lib/geo/geo-labels";
import { geoScoreLabel } from "@/lib/geo/geo-weights";
import { PdfCanvas, CONTENT_WIDTH, MARGIN, PAGE_WIDTH } from "./canvas";
import { COLOR, GEO_SEVERITY_COLOR, GEO_SEVERITY_SOFT_COLOR, GEO_SEVERITY_LABEL, scoreColor } from "./theme";

const GEO_SEVERITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3 } as const;

function sortedGeoIssues(issues: GeoIssue[]): GeoIssue[] {
  return [...issues].sort((a, b) => GEO_SEVERITY_ORDER[a.severity] - GEO_SEVERITY_ORDER[b.severity]);
}

// ---------------------------------------------------------------------
// PDF Free: blocco compatto (brief GEO sezione 21 — score, 2-3 indicatori,
// max 2-3 problemi sintetici, nessun dettaglio avanzato). Dimensionato per
// stare nello spazio fisso di una singola pagina insieme al resto del
// report SEO Free — vedi generateFreeReportPdf in report-pdf.ts, che
// libera spazio riducendo le priorita' SEO da 3 a 2 voci.
// ---------------------------------------------------------------------
export function drawGeoFreeBlock(canvas: PdfCanvas, geo: GeoReport) {
  const cardHeight = 68;
  const top = canvas.y;
  canvas.roundedRect(MARGIN, top - cardHeight, CONTENT_WIDTH, cardHeight, {
    radius: 10,
    fill: COLOR.white,
    border: COLOR.line,
    borderWidth: 0.75,
  });

  const gaugeR = 20;
  const gaugeCx = MARGIN + 14 + gaugeR;
  const gaugeCy = top - cardHeight / 2;
  canvas.scoreGauge({ cx: gaugeCx, cy: gaugeCy, radius: gaugeR, thickness: 5, score: geo.overallScore, scoreSize: 13 });

  const textX = MARGIN + 14 + gaugeR * 2 + 16;
  const textWidth = CONTENT_WIDTH - (textX - MARGIN) - 14;
  canvas.y = top - 13;
  canvas.text("GEO — GENERATIVE ENGINE OPTIMIZATION", { size: 7, font: "bold", color: COLOR.accent, x: textX, maxWidth: textWidth, gap: 2 });
  canvas.text(`${geoScoreLabel(geo.overallScore)} — predisposizione ad essere compreso dagli AI answer engine`, {
    size: 8.5,
    font: "bold",
    color: scoreColor(geo.overallScore),
    x: textX,
    maxWidth: textWidth,
    gap: 3,
    maxLines: 1,
  });

  const topIssue = sortedGeoIssues(geo.issues)[0];
  if (!topIssue) {
    canvas.text("Nessun problema GEO rilevante individuato.", { size: 8, color: COLOR.inkSoft, x: textX, maxWidth: textWidth, gap: 0, maxLines: 1 });
  } else {
    canvas.hangingLine("•", topIssue.title, { size: 8, color: COLOR.inkSoft, x: textX, maxWidth: textWidth, indent: 10, gap: 0, maxLines: 1 });
  }

  canvas.y = top - cardHeight - 8;
}

// ---------------------------------------------------------------------
// PDF Pro — pagina 1: Executive Summary + Scorecard GEO
// ---------------------------------------------------------------------
export function drawGeoOverviewPage(canvas: PdfCanvas, geo: GeoReport) {
  canvas.sectionTitle("GEO — Generative Engine Optimization", {
    subtitle: "Predisposizione del sito a essere compreso, sintetizzato e citato da motori di ricerca generativi e AI answer engine.",
  });

  // Score hero
  const heroTop = canvas.y;
  const gaugeRadius = 46;
  const gaugeCx = MARGIN + gaugeRadius + 4;
  const gaugeCy = heroTop - gaugeRadius - 4;
  canvas.scoreGauge({ cx: gaugeCx, cy: gaugeCy, radius: gaugeRadius, thickness: 9, score: geo.overallScore, scoreSize: 26 });
  const label = geoScoreLabel(geo.overallScore);
  const labelWidth = canvas.fontBold.widthOfTextAtSize(label, 11);
  canvas.page.drawText(label, {
    x: gaugeCx - labelWidth / 2,
    y: gaugeCy - gaugeRadius - 16,
    size: 11,
    font: canvas.fontBold,
    color: scoreColor(geo.overallScore),
  });

  const asideX = gaugeCx + gaugeRadius + 24;
  const asideWidth = PAGE_WIDTH - MARGIN - asideX;
  canvas.y = heroTop - 4;
  const summaryText =
    geo.aiSummary ??
    "Punteggio calcolato su accessibilita' per crawler/sistemi AI, chiarezza semantica e dell'entita', completezza delle informazioni, answerability, struttura del contenuto, segnali di fiducia e dati strutturati.";
  canvas.text(summaryText, { size: 9.5, color: COLOR.inkSoft, x: asideX, maxWidth: asideWidth, maxLines: 6, gap: 0 });

  canvas.y = Math.min(canvas.y, gaugeCy - gaugeRadius - 16 - 14);
  canvas.y -= 18;

  if (geo.aiComparisonNote) {
    canvas.roundedRect(MARGIN, canvas.y - 40, CONTENT_WIDTH, 40, { radius: 8, fill: COLOR.accentSoft });
    canvas.y -= 10;
    canvas.text("SEO vs GEO", { size: 8, font: "bold", color: COLOR.accent, x: MARGIN + 14, gap: 2 });
    canvas.text(geo.aiComparisonNote, { size: 9, color: COLOR.ink, x: MARGIN + 14, maxWidth: CONTENT_WIDTH - 28, maxLines: 2, gap: 0 });
    canvas.y -= 16;
  }

  canvas.divider();

  // Category scorecard — griglia compatta (9 categorie: una riga a piena
  // larghezza occuperebbe troppo spazio, a differenza delle 7 categorie
  // SEO su drawScorecardPage).
  canvas.kicker("Punteggi per categoria");
  const cols = 3;
  const gutter = 12;
  const cardWidth = (CONTENT_WIDTH - gutter * (cols - 1)) / cols;
  const cardHeight = 60;
  const rowGap = 10;
  const gridTop = canvas.y;

  geo.categoryScores.forEach((c, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = MARGIN + col * (cardWidth + gutter);
    const yTop = gridTop - row * (cardHeight + rowGap);
    canvas.ensureSpace(cardHeight + rowGap);
    canvas.roundedRect(x, yTop - cardHeight, cardWidth, cardHeight, { radius: 9, fill: COLOR.white, border: COLOR.line, borderWidth: 0.75 });
    canvas.page.drawText(canvas.fitOneLine(GEO_CATEGORY_LABELS[c.category], canvas.fontRegular, 8.5, cardWidth - 20), {
      x: x + 10,
      y: yTop - 16,
      size: 8.5,
      font: canvas.fontRegular,
      color: COLOR.inkSoft,
    });
    if (c.applicable) {
      canvas.page.drawText(String(c.score), { x: x + 10, y: yTop - 38, size: 18, font: canvas.fontDisplay, color: scoreColor(c.score) });
    } else {
      canvas.page.drawText("N/A", { x: x + 10, y: yTop - 36, size: 12, font: canvas.fontBold, color: COLOR.inkSoft });
    }
  });

  const rows = Math.ceil(geo.categoryScores.length / cols);
  canvas.y = gridTop - rows * (cardHeight + rowGap) + rowGap - 4;
  canvas.divider();

  if (geo.strengths.length > 0) {
    const headingH = canvas.measure("Segnali positivi", { size: 12, font: "bold", gap: 6 });
    canvas.ensureSpace(headingH + 20);
    canvas.text("Segnali positivi", { size: 12, font: "bold", color: COLOR.ink, gap: 6 });
    for (const s of geo.strengths) canvas.hangingLine("+", s, { size: 9.5, glyphColor: COLOR.accent, gap: 4, maxLines: 2 });
  }
}

// ---------------------------------------------------------------------
// PDF Pro — pagina 2: Problemi GEO, Answerability, Action Plan
// ---------------------------------------------------------------------
function geoIssueCardHeight(canvas: PdfCanvas, issue: GeoIssue): number {
  const padding = 14;
  const innerWidth = CONTENT_WIDTH - padding * 2;
  const titleH = 16;
  const descH = canvas.measure(issue.description, { size: 9.5, maxWidth: innerWidth, lineHeightMult: 1.35, gap: 6 });
  const doH = canvas.measure(issue.recommendation, { size: 9.5, maxWidth: innerWidth, lineHeightMult: 1.35, gap: 4 });
  return padding * 2 + titleH + descH + doH;
}

function drawGeoIssueCard(canvas: PdfCanvas, issue: GeoIssue) {
  const padding = 14;
  const titleH = 16;
  const innerWidth = CONTENT_WIDTH - padding * 2;
  const cardHeight = geoIssueCardHeight(canvas, issue);

  canvas.ensureSpace(cardHeight + 10);
  const top = canvas.y;
  canvas.roundedRect(MARGIN, top - cardHeight, CONTENT_WIDTH, cardHeight, { radius: 10, fill: COLOR.white, border: COLOR.line, borderWidth: 0.75 });
  canvas.roundedRect(MARGIN, top - cardHeight, 4, cardHeight, { radius: 2, fill: GEO_SEVERITY_COLOR[issue.severity] });

  canvas.y = top - padding;
  const pillW = canvas.pill(
    MARGIN + padding,
    canvas.y,
    GEO_SEVERITY_LABEL[issue.severity],
    GEO_SEVERITY_COLOR[issue.severity],
    GEO_SEVERITY_SOFT_COLOR[issue.severity]
  );
  const categoryLabel = GEO_CATEGORY_LABELS[issue.category];
  const catWidth = canvas.fontRegular.widthOfTextAtSize(categoryLabel, 7.5);
  canvas.page.drawText(categoryLabel.toUpperCase(), {
    x: MARGIN + padding + pillW + 8,
    y: canvas.y - 11,
    size: 7.5,
    font: canvas.fontRegular,
    color: COLOR.inkSoft,
  });
  const cardTitleWidth = innerWidth - pillW - 8 - catWidth - 10;
  canvas.page.drawText(canvas.fitOneLine(issue.title, canvas.fontBold, 10.5, cardTitleWidth), {
    x: MARGIN + padding + pillW + 8 + catWidth + 10,
    y: canvas.y - 11,
    size: 10.5,
    font: canvas.fontBold,
    color: COLOR.ink,
  });
  canvas.y = top - padding - titleH - 6;

  canvas.text(issue.description, { size: 9.5, color: COLOR.ink, x: MARGIN + padding, maxWidth: innerWidth, gap: 6, lineHeightMult: 1.35 });
  canvas.text(`Cosa fare: ${issue.recommendation}`, { size: 9.5, color: COLOR.inkSoft, x: MARGIN + padding, maxWidth: innerWidth, gap: 4, lineHeightMult: 1.35 });

  canvas.y = top - cardHeight - 10;
}

export function drawGeoIssuesPage(canvas: PdfCanvas, geo: GeoReport) {
  canvas.sectionTitle("GEO — Problemi e Action Plan", {
    subtitle: "Le criticita' rilevate, in ordine di priorita', e cosa fare per ciascuna.",
  });

  const sorted = sortedGeoIssues(geo.issues);
  if (sorted.length === 0) {
    canvas.text("Non sono state rilevate criticita' GEO rilevanti in questa analisi.", { size: 10.5, color: COLOR.inkSoft, gap: 16 });
  } else {
    for (const issue of sorted) drawGeoIssueCard(canvas, issue);
    canvas.y -= 6;
  }

  const unanswered = geo.answerabilityQueries.filter((q) => !q.answered);
  if (geo.answerabilityQueries.length > 0) {
    canvas.divider();
    const headingH = canvas.measure("Answerability", { size: 12.5, font: "bold", gap: 4 });
    canvas.ensureSpace(headingH + 40);
    canvas.text("Answerability", { size: 12.5, font: "bold", color: COLOR.ink, gap: 4 });
    canvas.text(
      `${geo.answerabilityQueries.length - unanswered.length}/${geo.answerabilityQueries.length} domande realistiche generate dal contenuto del sito trovano risposta nel testo.`,
      { size: 9, color: COLOR.inkSoft, gap: 8 }
    );
    if (unanswered.length > 0) {
      canvas.text("Domande senza risposta rilevabile:", { size: 9, font: "bold", color: COLOR.ink, gap: 4 });
      for (const q of unanswered) canvas.hangingLine("•", q.query, { size: 9, color: COLOR.inkSoft, gap: 3, maxLines: 1 });
    }
    canvas.y -= 6;
  }

  const priorities = geo.issues.length > 0 ? sortedGeoIssues(geo.issues).slice(0, 5).map((i) => i.recommendation) : [];
  if (priorities.length > 0) {
    canvas.divider();
    const headingH = canvas.measure("Priorita' di intervento", { size: 12.5, font: "bold", gap: 6 });
    canvas.ensureSpace(headingH + 20);
    canvas.text("Priorita' di intervento", { size: 12.5, font: "bold", color: COLOR.ink, gap: 6 });
    priorities.forEach((p, i) => canvas.hangingLine(`${i + 1}.`, p, { size: 10, color: COLOR.ink, gap: 5, maxLines: 2 }));
  }
}
