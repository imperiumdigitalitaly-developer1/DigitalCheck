import type { GeoIssue, GeoReport } from "@/lib/geo/geo-types";
import { GEO_CATEGORY_LABELS } from "@/lib/geo/geo-labels";
import { geoScoreLabel } from "@/lib/geo/geo-weights";
import { PdfCanvas, CONTENT_WIDTH, MARGIN, PAGE_WIDTH } from "./canvas";
import { COLOR, GEO_SEVERITY_COLOR, GEO_SEVERITY_SOFT_COLOR, GEO_SEVERITY_LABEL, CATEGORY_MONOGRAM, scoreColor } from "./theme";

// Sola presentazione: nessun dato/punteggio GEO calcolato qui, tutto viene
// da src/lib/geo/geo-scoring.ts (mai toccato). Questo file disegna solo il
// PDF — coerente con il redesign generale, sezioni 2/15/16.

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
  // Stessa riserva difensiva degli header di categoria (category-section.ts
  // drawCategoryHeader): la sezione GEO non apre piu' sempre una pagina
  // nuova, quindi va garantito lo spazio per header + score hero prima di
  // iniziare a disegnare (redesign PDF, sezione 25).
  canvas.ensureSpace(190);
  if (!canvas.isAtPageTop()) {
    canvas.divider();
    canvas.y -= 6;
  }
  const monoSize = 32;
  canvas.monogramBadge(MARGIN, canvas.y, CATEGORY_MONOGRAM.geo, { size: monoSize });
  const textX = MARGIN + monoSize + 14;
  const savedY = canvas.y;
  canvas.y -= 3;
  canvas.text("GEO — Generative Engine Optimization", { size: 15.5, font: "display", color: COLOR.ink, x: textX, maxWidth: CONTENT_WIDTH - monoSize - 14, gap: 2 });
  canvas.text(
    "Predisposizione del sito a essere compreso, sintetizzato e citato da motori di ricerca generativi e AI answer engine.",
    { size: 9, color: COLOR.inkSoft, x: textX, maxWidth: CONTENT_WIDTH - monoSize - 14, maxLines: 2, gap: 0, lineHeightMult: 1.3 }
  );
  canvas.y = Math.min(canvas.y, savedY - monoSize);
  canvas.y -= 14;
  canvas.divider();

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
    canvas.calloutBox("SEO vs GEO", geo.aiComparisonNote, { fill: COLOR.accentSoft, kickerColor: COLOR.accent, textColor: COLOR.ink, maxLines: 2 });
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

  // Una riga alla volta (non l'intera griglia con un gridTop fisso
  // calcolato una sola volta): se ensureSpace() apre una pagina nuova a
  // meta' griglia, canvas.y va riletto per quella riga, altrimenti le
  // righe successive si disegnerebbero ancora alle coordinate della
  // pagina precedente, finendo sovrapposte al footer (bug scoperto col
  // flusso continuo tra capitoli, redesign PDF sezione 25).
  for (let i = 0; i < geo.categoryScores.length; i += cols) {
    canvas.ensureSpace(cardHeight + rowGap);
    const rowTop = canvas.y;
    const rowCards = geo.categoryScores.slice(i, i + cols);
    rowCards.forEach((c, col) => {
      const x = MARGIN + col * (cardWidth + gutter);
      canvas.roundedRect(x, rowTop - cardHeight, cardWidth, cardHeight, { radius: 9, fill: COLOR.white, border: COLOR.line, borderWidth: 0.75 });
      canvas.page.drawText(canvas.fitOneLine(GEO_CATEGORY_LABELS[c.category], canvas.fontRegular, 8.5, cardWidth - 20), {
        x: x + 10,
        y: rowTop - 16,
        size: 8.5,
        font: canvas.fontRegular,
        color: COLOR.inkSoft,
      });
      if (c.applicable) {
        canvas.page.drawText(String(c.score), { x: x + 10, y: rowTop - 38, size: 18, font: canvas.fontDisplay, color: scoreColor(c.score) });
      } else {
        canvas.page.drawText("N/A", { x: x + 10, y: rowTop - 36, size: 12, font: canvas.fontBold, color: COLOR.inkSoft });
      }
    });
    canvas.y = rowTop - cardHeight - rowGap;
  }
  canvas.y += rowGap - 4;
  canvas.divider();

  if (geo.strengths.length > 0) {
    const headingH = canvas.measure("GEO Strengths", { size: 12, font: "bold", gap: 6 });
    canvas.ensureSpace(headingH + 20);
    canvas.kicker("GEO Strengths");
    for (const s of geo.strengths) canvas.hangingLine("+", s, { size: 9.5, glyphColor: COLOR.accent, gap: 4, maxLines: 2 });
    canvas.y -= 4;
  }

  const opportunities = sortedGeoIssues(geo.issues).slice(0, 4);
  if (opportunities.length > 0) {
    const headingH = canvas.measure("GEO Opportunities", { size: 12, font: "bold", gap: 6 });
    canvas.ensureSpace(headingH + 20);
    canvas.kicker("GEO Opportunities");
    for (const o of opportunities) canvas.hangingLine(">", o.title, { size: 9.5, gap: 4, maxLines: 1 });
  }
}

// ---------------------------------------------------------------------
// PDF Pro — pagina 2: Problemi GEO, Answerability, Action Plan
// ---------------------------------------------------------------------
function geoIssueCardHeight(canvas: PdfCanvas, issue: GeoIssue): number {
  const padding = 12;
  const innerWidth = CONTENT_WIDTH - padding * 2;
  const titleH = 22;
  const labelH = 11;
  const whyH = canvas.measure(issue.whyItMatters, { size: 8.5, maxWidth: innerWidth, lineHeightMult: 1.25, gap: 8 });
  const actionH = canvas.measure(issue.recommendation, { size: 9, maxWidth: innerWidth, lineHeightMult: 1.3, gap: issue.example ? 8 : 0 });
  const exampleH = issue.example ? labelH + canvas.measure(issue.example, { size: 8.5, maxWidth: innerWidth, lineHeightMult: 1.25, gap: 0 }) : 0;
  return padding * 2 + titleH + labelH + whyH + labelH + actionH + exampleH;
}

function drawGeoIssueCard(canvas: PdfCanvas, issue: GeoIssue) {
  const padding = 12;
  const innerWidth = CONTENT_WIDTH - padding * 2;
  const cardHeight = geoIssueCardHeight(canvas, issue);

  canvas.ensureSpace(cardHeight + 10);
  const top = canvas.y;
  canvas.roundedRect(MARGIN, top - cardHeight, CONTENT_WIDTH, cardHeight, { radius: 10, fill: COLOR.white, border: COLOR.line, borderWidth: 0.75 });
  canvas.roundedRect(MARGIN, top - cardHeight, 4, cardHeight, { radius: 2, fill: GEO_SEVERITY_COLOR[issue.severity] });

  canvas.y = top - padding;
  const badgeW = canvas.severityBadge(MARGIN + padding, canvas.y, GEO_SEVERITY_LABEL[issue.severity], GEO_SEVERITY_COLOR[issue.severity]);
  const categoryLabel = GEO_CATEGORY_LABELS[issue.category].toUpperCase();
  const catWidth = canvas.fontRegular.widthOfTextAtSize(categoryLabel, 7.5);
  canvas.page.drawText(categoryLabel, { x: MARGIN + padding + badgeW + 8, y: canvas.y - 13, size: 7.5, font: canvas.fontRegular, color: COLOR.inkSoft });
  const cardTitleWidth = innerWidth - badgeW - 8 - catWidth - 10;
  canvas.page.drawText(canvas.fitOneLine(issue.title, canvas.fontBold, 10.5, cardTitleWidth), {
    x: MARGIN + padding + badgeW + 8 + catWidth + 10,
    y: canvas.y - 13,
    size: 10.5,
    font: canvas.fontBold,
    color: COLOR.ink,
  });
  canvas.y = top - padding - 22 - 4;

  canvas.page.drawText("PERCHE' CONTA", { x: MARGIN + padding, y: canvas.y - 7, size: 7, font: canvas.fontBold, color: COLOR.accent });
  canvas.y -= 11;
  canvas.text(issue.whyItMatters, { size: 8.5, color: COLOR.ink, x: MARGIN + padding, maxWidth: innerWidth, gap: 8, lineHeightMult: 1.25 });

  canvas.page.drawText("AZIONE CONSIGLIATA", { x: MARGIN + padding, y: canvas.y - 7, size: 7, font: canvas.fontBold, color: COLOR.inkSoft });
  canvas.y -= 11;
  canvas.text(issue.recommendation, { size: 9, color: COLOR.inkSoft, x: MARGIN + padding, maxWidth: innerWidth, gap: issue.example ? 8 : 0, lineHeightMult: 1.3 });

  if (issue.example) {
    canvas.page.drawText("ESEMPIO", { x: MARGIN + padding, y: canvas.y - 7, size: 7, font: canvas.fontBold, color: COLOR.inkSoft });
    canvas.y -= 11;
    canvas.text(issue.example, { size: 8.5, color: COLOR.inkSoft, x: MARGIN + padding, maxWidth: innerWidth, gap: 0, lineHeightMult: 1.25 });
  }

  canvas.y = top - cardHeight - 10;
}

export function drawGeoIssuesPage(canvas: PdfCanvas, geo: GeoReport) {
  canvas.sectionTitle("GEO — Problemi e Action Plan", {
    subtitle: "Le criticita' rilevate, in ordine di priorita', e cosa fare per ciascuna.",
  });

  const sorted = sortedGeoIssues(geo.issues);
  if (sorted.length === 0) {
    canvas.calloutBox("Nessuna criticita' rilevata", "Non sono state rilevate criticita' GEO rilevanti in questa analisi.", { maxLines: 2 });
  } else {
    for (const issue of sorted) drawGeoIssueCard(canvas, issue);
    canvas.y -= 6;
  }

  const unanswered = geo.answerabilityQueries.filter((q) => !q.answered);
  if (geo.answerabilityQueries.length > 0) {
    canvas.divider();
    const headingH = canvas.measure("Answerability", { size: 12.5, font: "bold", gap: 4 });
    canvas.ensureSpace(headingH + 40);
    canvas.kicker("Answerability");
    canvas.text(
      `${geo.answerabilityQueries.length - unanswered.length}/${geo.answerabilityQueries.length} domande realistiche generate dal contenuto del sito trovano risposta nel testo.`,
      { size: 9, color: COLOR.inkSoft, gap: 10 }
    );
    if (unanswered.length > 0) {
      const answerabilityAction =
        geo.issues.find((i) => i.category === "answerability")?.recommendation ??
        "Aggiungi contenuti che rispondano esplicitamente a questa domanda.";
      for (const q of unanswered) drawAnswerabilityGap(canvas, q.query, answerabilityAction);
    }
    canvas.y -= 4;
  }

  const priorities = geo.issues.length > 0 ? sortedGeoIssues(geo.issues).slice(0, 5).map((i) => i.recommendation) : [];
  if (priorities.length > 0) {
    canvas.divider();
    const headingH = canvas.measure("Priorita' di intervento", { size: 12.5, font: "bold", gap: 6 });
    canvas.ensureSpace(headingH + 20);
    canvas.kicker("Priorita' di intervento");
    priorities.forEach((p, i) => canvas.hangingLine(`${i + 1}.`, p, { size: 10, color: COLOR.ink, gap: 5, maxLines: 2 }));
  }
}

// Coppia Domanda/Azione (redesign PDF, sezione 16 — esempio esplicito nel
// brief): la domanda e' quella realmente generata dal contenuto del sito
// (src/lib/geo/answerability.ts), l'azione e' la recommendation gia'
// calcolata per la categoria answerability — mai un consiglio inventato
// per la singola domanda, che il motore GEO non produce a quel livello.
function drawAnswerabilityGap(canvas: PdfCanvas, question: string, action: string) {
  const padding = 10;
  const innerWidth = CONTENT_WIDTH - padding * 2;
  const qH = canvas.measure(question, { size: 9, maxWidth: innerWidth, lineHeightMult: 1.3, gap: 4 });
  const aH = canvas.measure(action, { size: 8.5, maxWidth: innerWidth, lineHeightMult: 1.25, gap: 0 });
  const cardHeight = padding * 2 + 10 + qH + 10 + aH;

  canvas.ensureSpace(cardHeight + 6);
  const top = canvas.y;
  canvas.roundedRect(MARGIN, top - cardHeight, CONTENT_WIDTH, cardHeight, { radius: 7, fill: COLOR.paper, border: COLOR.line, borderWidth: 0.75 });
  canvas.y = top - padding;
  canvas.page.drawText("DOMANDA", { x: MARGIN + padding, y: canvas.y - 7, size: 7, font: canvas.fontBold, color: COLOR.inkSoft });
  canvas.y -= 10;
  canvas.text(`"${question}"`, { size: 9, font: "bold", color: COLOR.ink, x: MARGIN + padding, maxWidth: innerWidth, gap: 4, lineHeightMult: 1.3 });
  canvas.page.drawText("AZIONE", { x: MARGIN + padding, y: canvas.y - 7, size: 7, font: canvas.fontBold, color: COLOR.accent });
  canvas.y -= 10;
  canvas.text(action, { size: 8.5, color: COLOR.inkSoft, x: MARGIN + padding, maxWidth: innerWidth, gap: 0, lineHeightMult: 1.25 });
  canvas.y = top - cardHeight - 6;
}
