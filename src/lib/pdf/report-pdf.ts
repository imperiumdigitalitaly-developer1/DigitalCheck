import type { CategoryKey, DigitalCheckReport } from "@/types";
import type { PlanType } from "@prisma/client";
import { STATUS_LABEL, scoreToStatus } from "@/lib/analysis/constants";
import { CATEGORY_LABELS } from "@/lib/category-labels";
import { getPlanFeatures } from "@/lib/billing/plan-config";
import { PdfCanvas, CONTENT_WIDTH, MARGIN, PAGE_WIDTH } from "./canvas";
import { COLOR, scoreColor } from "./theme";
import { drawGeoFreeBlock, drawGeoOverviewPage, drawGeoIssuesPage } from "./geo-section";
import { drawCategoryReportPage } from "./category-section";
import { drawCrossAnalysisPage } from "./cross-analysis-section";
import { drawActionPlanPage } from "./action-plan-section";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("it-IT", { day: "2-digit", month: "long", year: "numeric" });
}

// Descrizione statica del metodo di misura, usata solo come fallback
// quando una categoria non ha una nota specifica (mai dati inventati: e'
// testo di metodologia, non un'osservazione sul sito analizzato).
const CATEGORY_METHOD_NOTE: Record<CategoryKey, string> = {
  seo: "Basato su titolo, meta description, struttura dei titoli, indicizzabilita', dati strutturati e link interni.",
  performance: "Basato su dati reali di Google PageSpeed Insights (Core Web Vitals) quando disponibili, altrimenti su una stima.",
  mobile: "Basato su viewport, pattern CSS rilevabili e performance mobile reale, con limiti dichiarati dove non verificabile.",
  content: "Analisi tecnica e strutturale del contenuto realmente pubblicato.",
  conversion: "Basato sulla presenza di elementi di conversione pertinenti al tipo di attivita' dichiarato.",
  accessibility: "Basato su controlli automaticamente verificabili (struttura semantica, immagini, moduli, navigazione).",
  technical: "Basato su HTTPS, header di sicurezza, architettura e affidabilita' delle risorse.",
};

// ---------------------------------------------------------------------
// PDF Free — una sola pagina, sintesi esecutiva (brief audit, sezione 16):
// SOLO punteggio complessivo e, per ciascuna delle 8 categorie, punteggio
// + stato + brevissima descrizione. NESSUN problema, raccomandazione,
// priorita' o sottopunteggio: quelli sono esclusivi del PDF Pro.
// canvas.paginationLocked forza a troncare invece di traboccare su una
// seconda pagina.
// ---------------------------------------------------------------------
export async function generateFreeReportPdf(report: DigitalCheckReport): Promise<Uint8Array> {
  const canvas = await PdfCanvas.create();
  canvas.paginationLocked = true;

  // ---- Header ------------------------------------------------------
  const headerTop = canvas.y;
  canvas.text("DigitalCheck", { size: 19, font: "display", color: COLOR.accent, gap: 1 });
  canvas.text("powered by Imperium Digital", { size: 7.5, color: COLOR.inkSoft, gap: 10 });

  const pillLabel = "PIANO FREE";
  const pillSize = 8;
  const pillWidth = canvas.fontBold.widthOfTextAtSize(pillLabel, pillSize) + 16;
  canvas.roundedRect(PAGE_WIDTH - MARGIN - pillWidth, headerTop - 15, pillWidth, 15, { radius: 7.5, fill: COLOR.accentSoft });
  canvas.page.drawText(pillLabel, {
    x: PAGE_WIDTH - MARGIN - pillWidth + 8,
    y: headerTop - 15 + 4,
    size: pillSize,
    font: canvas.fontBold,
    color: COLOR.accent,
  });

  canvas.text("DigitalCheck Score Report", { size: 14, font: "display", color: COLOR.ink, gap: 3 });
  canvas.text(
    `${report.requestedUrl}  ·  ${formatDate(report.generatedAt)}  ·  ${report.pagesAnalyzed} pagine analizzate`,
    { size: 9, color: COLOR.inkSoft, gap: 10 }
  );
  canvas.divider();

  // ---- Hero score + sintesi ------------------------------------------
  const heroTop = canvas.y;
  const gaugeRadius = 40;
  const gaugeCx = MARGIN + gaugeRadius + 4;
  const gaugeCy = heroTop - gaugeRadius - 6;
  canvas.scoreGauge({ cx: gaugeCx, cy: gaugeCy, radius: gaugeRadius, thickness: 8, score: report.overallScore, scoreSize: 26 });
  const gaugeLabelY = gaugeCy - gaugeRadius - 15;
  const label = STATUS_LABEL[scoreToStatus(report.overallScore)];
  const labelWidth = canvas.fontBold.widthOfTextAtSize(label, 11);
  canvas.page.drawText(label, {
    x: gaugeCx - labelWidth / 2,
    y: gaugeLabelY,
    size: 11,
    font: canvas.fontBold,
    color: scoreColor(report.overallScore),
  });

  const summaryX = gaugeCx + gaugeRadius + 24;
  const summaryWidth = PAGE_WIDTH - MARGIN - summaryX;
  canvas.y = heroTop;
  canvas.text("DIGITALCHECK SCORE", { size: 8.5, font: "bold", color: COLOR.accent, gap: 6, x: summaryX, maxWidth: summaryWidth });
  canvas.text(report.businessImpactSummary, {
    size: 9.5,
    color: COLOR.inkSoft,
    gap: 4,
    x: summaryX,
    maxWidth: summaryWidth,
    maxLines: 4,
    lineHeightMult: 1.4,
  });

  canvas.y = Math.min(canvas.y, gaugeCy - gaugeRadius - 15 - 14);
  canvas.y -= 14;
  canvas.divider();

  // ---- Griglia 8 categorie: solo score + stato + brevissima sintesi ------
  canvas.kicker("Punteggi per categoria");
  const cols = 4;
  const gutter = 10;
  const cardWidth = (CONTENT_WIDTH - gutter * (cols - 1)) / cols;
  const cardHeight = 60;
  const rowGap = 8;
  const gridTop = canvas.y;

  const cards: { label: string; score: number }[] = report.analyses.map((a) => ({ label: CATEGORY_LABELS[a.category], score: a.score }));
  if (report.geo) cards.push({ label: "GEO", score: report.geo.overallScore });

  cards.forEach((c, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = MARGIN + col * (cardWidth + gutter);
    const yTop = gridTop - row * (cardHeight + rowGap);
    canvas.roundedRect(x, yTop - cardHeight, cardWidth, cardHeight, { radius: 8, fill: COLOR.white, border: COLOR.line, borderWidth: 0.75 });
    canvas.page.drawText(canvas.fitOneLine(c.label, canvas.fontRegular, 8, cardWidth - 16), { x: x + 10, y: yTop - 16, size: 8, font: canvas.fontRegular, color: COLOR.inkSoft });
    canvas.page.drawText(String(c.score), { x: x + 10, y: yTop - 38, size: 18, font: canvas.fontDisplay, color: scoreColor(c.score) });
    const statusLbl = STATUS_LABEL[scoreToStatus(c.score)];
    canvas.page.drawText(canvas.fitOneLine(statusLbl, canvas.fontBold, 7, cardWidth - 16), { x: x + 10, y: yTop - cardHeight + 11, size: 7, font: canvas.fontBold, color: scoreColor(c.score) });
  });

  const rows = Math.ceil(cards.length / cols);
  canvas.y = gridTop - rows * (cardHeight + rowGap) + rowGap - 6;
  canvas.divider();

  // ---- CTA Pro ------------------------------------------------------
  const ctaHeight = 90;
  const ctaTop = Math.min(canvas.y - 10, MARGIN + ctaHeight + 60);
  canvas.roundedRect(MARGIN, ctaTop - ctaHeight, CONTENT_WIDTH, ctaHeight, { radius: 12, fill: COLOR.accentDeep });
  canvas.y = ctaTop - 20;
  canvas.text("Vuoi capire esattamente perche' hai questo punteggio?", {
    size: 12.5,
    font: "display",
    color: COLOR.white,
    gap: 6,
    x: MARGIN + 20,
    maxWidth: CONTENT_WIDTH - 40,
  });
  canvas.text(
    "Con DigitalCheck Pro ottieni l'audit professionale completo: metodologia, sottopunteggi, problemi rilevati con gravita' e impatto, raccomandazioni, cross-analysis tra le categorie e un piano d'azione prioritizzato.",
    { size: 9, color: COLOR.line, gap: 0, x: MARGIN + 20, maxWidth: CONTENT_WIDTH - 40, maxLines: 3 }
  );

  return canvas.save();
}

// ---------------------------------------------------------------------
// PDF Pro — il vero audit professionale (brief audit sezioni 3/17/39):
// metodologia, sottopunteggi, findings, gravita', impatto, raccomandazioni,
// cross-analysis e action plan per tutte le 8 categorie. Lunghezza
// dinamica: cresce in base ai dati realmente disponibili (brief sezione 38).
// ---------------------------------------------------------------------
export async function generateProReportPdf(report: DigitalCheckReport): Promise<Uint8Array> {
  const canvas = await PdfCanvas.create();

  drawCoverAndExecutiveSummary(canvas, report);
  canvas.newPage(true);
  drawScorecardPage(canvas, report);

  for (const analysis of report.analyses) {
    canvas.newPage(true);
    drawCategoryReportPage(canvas, analysis);
  }

  // GEO — pagine dedicate gia' esistenti (brief GEO sezione 22), riusate
  // senza modifiche: solo se lo scan ha effettivamente prodotto un'analisi
  // GEO (scan storici precedenti al modulo GEO non ne hanno una).
  if (report.geo) {
    canvas.newPage(true);
    drawGeoOverviewPage(canvas, report.geo);
    canvas.newPage(true);
    drawGeoIssuesPage(canvas, report.geo);
  }

  canvas.newPage(true);
  drawCrossAnalysisPage(canvas, report.crossAnalysis);

  canvas.newPage(true);
  drawActionPlanPage(canvas, report.actionPlan);

  canvas.newPage(true);
  drawAiReportPage(canvas, report);

  canvas.stampChrome("DigitalCheck - powered by Imperium Digital", "DigitalCheck - Professional Website Audit");

  return canvas.save();
}

// ---- PAGINA 1: Cover + Executive Summary --------------------------------
function drawCoverAndExecutiveSummary(canvas: PdfCanvas, report: DigitalCheckReport) {
  canvas.y -= 8;
  canvas.text("DigitalCheck", { size: 30, font: "display", color: COLOR.accent, gap: 2 });
  canvas.text("powered by Imperium Digital", { size: 9.5, color: COLOR.inkSoft, gap: 26 });
  canvas.text("Professional Website Audit", { size: 18, font: "display", color: COLOR.ink, gap: 10 });
  canvas.text(report.requestedUrl, { size: 12.5, font: "bold", color: COLOR.ink, gap: 3 });
  canvas.text(`${formatDate(report.generatedAt)}  ·  ${report.pagesAnalyzed} pagine analizzate`, {
    size: 9.5,
    color: COLOR.inkSoft,
    gap: 32,
  });

  // Score hero
  const heroTop = canvas.y;
  const gaugeRadius = 58;
  const gaugeCx = MARGIN + gaugeRadius + 6;
  const gaugeCy = heroTop - gaugeRadius - 6;
  canvas.scoreGauge({ cx: gaugeCx, cy: gaugeCy, radius: gaugeRadius, thickness: 11, score: report.overallScore, scoreSize: 36 });
  const label = STATUS_LABEL[scoreToStatus(report.overallScore)];
  const labelSize = 13;
  const labelWidth = canvas.fontBold.widthOfTextAtSize(label, labelSize);
  canvas.page.drawText(label, {
    x: gaugeCx - labelWidth / 2,
    y: gaugeCy - gaugeRadius - 20,
    size: labelSize,
    font: canvas.fontBold,
    color: scoreColor(report.overallScore),
  });

  const asideX = gaugeCx + gaugeRadius + 28;
  const asideWidth = PAGE_WIDTH - MARGIN - asideX;
  canvas.y = heroTop - 6;
  canvas.text(
    "Il DigitalCheck Score riassume SEO, Performance, Mobile, Conversione, Contenuti, Accessibilita', Tecnica e GEO calcolati sui dati raccolti durante l'analisi (metodologia dettagliata nelle pagine seguenti).",
    { size: 9.5, color: COLOR.inkSoft, x: asideX, maxWidth: asideWidth, maxLines: 5, gap: 0 }
  );

  canvas.y = Math.min(canvas.y, gaugeCy - gaugeRadius - 20 - 18);
  canvas.y -= 20;
  canvas.divider();

  // Executive summary (interpretazione AI dell'intero audit, sezione
  // riservata al PDF Pro dove e' consentito parlare di problemi/priorita' —
  // brief sezione 17).
  canvas.sectionTitle("Executive Summary");
  canvas.text(report.businessImpactSummary, { size: 10.5, color: COLOR.inkSoft, gap: 16, maxLines: 7 });

  const colWidth = (CONTENT_WIDTH - 28) / 2;
  const colTop = canvas.y;
  const strengths = report.strengths.slice(0, 4);
  const weaknesses = report.actionPlan.slice(0, 4);

  canvas.y = colTop;
  canvas.text("Principali aree di forza", { size: 11, font: "bold", color: COLOR.ink, gap: 6, maxWidth: colWidth });
  if (strengths.length > 0) {
    for (const s of strengths) canvas.hangingLine("+", s, { size: 9.5, maxWidth: colWidth, glyphColor: COLOR.accent, maxLines: 2, gap: 4 });
  } else {
    canvas.text("Nessun punto di forza specifico segnalato dall'analisi.", { size: 9, color: COLOR.inkSoft, maxWidth: colWidth });
  }
  const leftBottom = canvas.y;

  canvas.y = colTop;
  canvas.text("Aree che richiedono attenzione", { size: 11, font: "bold", color: COLOR.ink, gap: 6, maxWidth: colWidth, x: MARGIN + colWidth + 28 });
  if (weaknesses.length > 0) {
    for (const w of weaknesses)
      canvas.hangingLine("!", w.title, { size: 9.5, maxWidth: colWidth, x: MARGIN + colWidth + 28, glyphColor: COLOR.ink, maxLines: 2, gap: 4 });
  } else {
    canvas.text("Nessuna criticita' rilevante individuata.", { size: 9, color: COLOR.inkSoft, maxWidth: colWidth, x: MARGIN + colWidth + 28 });
  }
  const rightBottom = canvas.y;

  canvas.y = Math.min(leftBottom, rightBottom) - 10;
  canvas.divider();

  const priorities = report.recommendedActions.slice(0, 3);
  if (priorities.length > 0) {
    canvas.text("Priorita' strategiche", { size: 11, font: "bold", color: COLOR.ink, gap: 6 });
    priorities.forEach((p, i) => canvas.hangingLine(`${i + 1}.`, p, { size: 9.5, color: COLOR.inkSoft, gap: 4, maxLines: 2 }));
  }
}

// ---- PAGINA 2: Scorecard (8 categorie a colpo d'occhio) -----------------
function drawScorecardPage(canvas: PdfCanvas, report: DigitalCheckReport) {
  canvas.sectionTitle("Scorecard", { subtitle: "Il punteggio di ogni categoria misurata, con una breve spiegazione del metodo." });

  for (const a of report.analyses) {
    const note = a.notes ?? CATEGORY_METHOD_NOTE[a.category];
    drawScorecardRow(canvas, CATEGORY_LABELS[a.category], a.score, note, a.dataAvailability !== "verified");
  }
  if (report.geo) {
    drawScorecardRow(
      canvas,
      "GEO — Generative Engine Optimization",
      report.geo.overallScore,
      "Predisposizione del sito a essere compreso da motori di ricerca generativi e AI answer engine.",
      false
    );
  }
}

function drawScorecardRow(canvas: PdfCanvas, label: string, score: number, note: string, isEstimate: boolean) {
  // +14pt quando c'e' anche la didascalia "dato parziale/stimato": senza,
  // una nota di 2 righe piene si sovrapponeva alla didascalia sottostante
  // (bug reale trovato via rendering reale del PDF, non solo a occhio sul codice).
  const rowHeight = isEstimate ? 76 : 62;
  canvas.ensureSpace(rowHeight + 10);
  const top = canvas.y;
  canvas.roundedRect(MARGIN, top - rowHeight, CONTENT_WIDTH, rowHeight, { radius: 10, fill: COLOR.white, border: COLOR.line, borderWidth: 0.75 });

  const gaugeR = 22;
  const gaugeCx = MARGIN + 34;
  const gaugeCy = top - rowHeight / 2;
  canvas.scoreGauge({ cx: gaugeCx, cy: gaugeCy, radius: gaugeR, thickness: 6, score, scoreSize: 15 });

  const textX = MARGIN + 34 + gaugeR + 22;
  const textWidth = CONTENT_WIDTH - (textX - MARGIN) - 16;
  canvas.y = top - 16;
  canvas.page.drawText(label, { x: textX, y: canvas.y - 11, size: 12, font: canvas.fontBold, color: COLOR.ink });
  const clsLabel = STATUS_LABEL[scoreToStatus(score)];
  const clsWidth = canvas.fontBold.widthOfTextAtSize(clsLabel, 9);
  canvas.page.drawText(clsLabel, { x: MARGIN + CONTENT_WIDTH - 16 - clsWidth, y: canvas.y - 11, size: 9, font: canvas.fontBold, color: scoreColor(score) });
  canvas.y = top - 32;
  canvas.text(note, { size: 8.5, color: COLOR.inkSoft, x: textX, maxWidth: textWidth, maxLines: 2, gap: 0, lineHeightMult: 1.3 });
  if (isEstimate) {
    canvas.page.drawText("Dato parziale o stimato, non una misura diretta", { x: textX, y: top - rowHeight + 8, size: 7.5, font: canvas.fontRegular, color: COLOR.inkSoft });
  }

  canvas.y = top - rowHeight - 12;
}

// ---- Ultima pagina: AI Report --------------------------------------------
function drawAiReportPage(canvas: PdfCanvas, report: DigitalCheckReport) {
  canvas.sectionTitle("AI Report", { subtitle: "Interpretazione dei dati raccolti durante l'analisi, basata solo sui risultati calcolati sopra." });

  if (report.strengths.length > 0) {
    canvas.text("Punti di forza principali", { size: 12, font: "bold", color: COLOR.ink, gap: 6 });
    for (const s of report.strengths) canvas.hangingLine("+", s, { size: 9.5, glyphColor: COLOR.accent, gap: 4, maxLines: 2 });
    canvas.y -= 6;
  }

  const weaknessTitles = Array.from(new Set(report.actionPlan.slice(0, 6).map((i) => i.title)));
  if (weaknessTitles.length > 0) {
    canvas.divider();
    canvas.text("Aree principali da migliorare", { size: 12, font: "bold", color: COLOR.ink, gap: 6 });
    for (const w of weaknessTitles) canvas.hangingLine("!", w, { size: 9.5, gap: 4, maxLines: 2 });
    canvas.y -= 6;
  }

  if (report.recommendedActions.length > 0) {
    canvas.divider();
    canvas.text("Raccomandazioni strategiche", { size: 12, font: "bold", color: COLOR.ink, gap: 6 });
    report.recommendedActions.forEach((r, i) => canvas.hangingLine(`${i + 1}.`, r, { size: 10, color: COLOR.ink, gap: 5, maxLines: 2 }));
    canvas.y -= 6;
  }

  if (report.unverifiable.length > 0) {
    canvas.divider();
    canvas.text("Cosa non e' stato possibile verificare automaticamente", { size: 10.5, font: "bold", color: COLOR.ink, gap: 6 });
    for (const u of report.unverifiable) canvas.hangingLine("•", u, { size: 8.5, color: COLOR.inkSoft, gap: 3, maxLines: 2 });
    canvas.y -= 8;
  }

  canvas.divider();
  canvas.text("Conclusione", { size: 11, font: "bold", color: COLOR.ink, gap: 6 });
  canvas.text(
    `Sulla base dei dati raccolti, ${report.requestedUrl} ottiene un DigitalCheck Score di ${report.overallScore}/100 (${STATUS_LABEL[scoreToStatus(report.overallScore)]}). Il piano d'azione (pagina precedente) ordina gli interventi consigliati per impatto e gravita': affrontarli in quest'ordine massimizza l'effetto rispetto allo sforzo richiesto.`,
    { size: 9.5, color: COLOR.inkSoft, maxLines: 4 }
  );
}

export async function generateReportPdf(report: DigitalCheckReport, plan: PlanType = "PRO"): Promise<Uint8Array> {
  return getPlanFeatures(plan).fullReports ? generateProReportPdf(report) : generateFreeReportPdf(report);
}
