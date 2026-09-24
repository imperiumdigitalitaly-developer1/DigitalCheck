import type { CategoryKey, DigitalCheckReport, IssueCategory, ScanIssue } from "@/types";
import type { PlanType } from "@prisma/client";
import { scoreLabel } from "@/lib/scoring/weights";
import { CATEGORY_LABELS } from "@/lib/category-labels";
import { getPlanFeatures } from "@/lib/billing/plan-config";
import { PdfCanvas, CONTENT_WIDTH, MARGIN, PAGE_WIDTH } from "./canvas";
import {
  COLOR,
  SEVERITY_COLOR,
  SEVERITY_SOFT_COLOR,
  SEVERITY_LABEL,
  ISSUE_GROUP_ORDER,
  ISSUE_GROUP_LABEL,
  ISSUE_IMPACT_LABEL,
  ISSUE_GOAL_LABEL,
  scoreColor,
} from "./theme";
import { drawGeoFreeBlock, drawGeoOverviewPage, drawGeoIssuesPage } from "./geo-section";

const SEVERITY_ORDER = { high: 0, medium: 1, low: 2 } as const;

function sortedBySeverity<T extends { severity: keyof typeof SEVERITY_ORDER }>(items: T[]): T[] {
  return [...items].sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("it-IT", { day: "2-digit", month: "long", year: "numeric" });
}

/** Descrizione statica del metodo di misura, usata solo quando la categoria non ha una nota specifica (mai dati inventati: e' testo di metodologia, non un'osservazione sul sito analizzato). */
const CATEGORY_METHOD_NOTE: Record<CategoryKey, string> = {
  seo: "Basato su titolo, meta description, struttura dei titoli, sitemap e dati strutturati rilevati.",
  performance: "Stima basata sui dati reali disponibili sul caricamento delle pagine.",
  mobile: "Verificato tramite i tag HTML disponibili (viewport), non tramite un rendering reale su dispositivo.",
  content: "Interpretazione dei contenuti effettivamente pubblicati sul sito.",
  conversion: "Basato sulla presenza degli elementi che favoriscono contatti o prenotazioni per questo tipo di attivita'.",
  accessibility: "Basato su testo alternativo delle immagini e attributi di lingua della pagina.",
  technical: "Basato su HTTPS, codice di stato e altri controlli tecnici di base.",
};

// ---------------------------------------------------------------------
// PDF Free — una sola pagina, "executive snapshot" (brief, sezioni 2 e
// 19). Nessuna interruzione di pagina automatica: canvas.paginationLocked
// forza a troncare i contenuti invece di traboccare su una seconda
// pagina.
// ---------------------------------------------------------------------
export async function generateFreeReportPdf(report: DigitalCheckReport): Promise<Uint8Array> {
  const canvas = await PdfCanvas.create();
  canvas.paginationLocked = true;

  // ---- Header ------------------------------------------------------
  const headerTop = canvas.y;
  canvas.text("DigitalCheck", { size: 19, font: "display", color: COLOR.accent, gap: 1 });
  canvas.text("powered by Imperium Digital", { size: 7.5, color: COLOR.inkSoft, gap: 10 });

  // Pillola "Piano Free" allineata al bordo destro, sulla stessa fascia dell'header.
  const pillLabel = "PIANO FREE";
  const pillSize = 8;
  const pillWidth = canvas.fontBold.widthOfTextAtSize(pillLabel, pillSize) + 16;
  canvas.roundedRect(PAGE_WIDTH - MARGIN - pillWidth, headerTop - 15, pillWidth, 15, {
    radius: 7.5,
    fill: COLOR.accentSoft,
  });
  canvas.page.drawText(pillLabel, {
    x: PAGE_WIDTH - MARGIN - pillWidth + 8,
    y: headerTop - 15 + 4,
    size: pillSize,
    font: canvas.fontBold,
    color: COLOR.accent,
  });

  canvas.text("Website Analysis Report", { size: 14, font: "display", color: COLOR.ink, gap: 3 });
  canvas.text(
    `${report.requestedUrl}  ·  ${formatDate(report.generatedAt)}  ·  ${report.pagesAnalyzed} pagine analizzate`,
    { size: 9, color: COLOR.inkSoft, gap: 10 }
  );
  canvas.divider();

  // ---- Hero score + sintesi ------------------------------------------
  const heroTop = canvas.y;
  const gaugeRadius = 44;
  const gaugeCx = MARGIN + gaugeRadius + 4;
  const gaugeCy = heroTop - gaugeRadius - 6;
  canvas.scoreGauge({
    cx: gaugeCx,
    cy: gaugeCy,
    radius: gaugeRadius,
    thickness: 9,
    score: report.overallScore,
    scoreSize: 28,
  });
  const gaugeLabelY = gaugeCy - gaugeRadius - 16;
  const label = scoreLabel(report.overallScore);
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
  canvas.text("SINTESI", { size: 8.5, font: "bold", color: COLOR.accent, gap: 6, x: summaryX, maxWidth: summaryWidth });
  canvas.text(report.businessImpactSummary, {
    size: 10,
    color: COLOR.inkSoft,
    gap: 4,
    x: summaryX,
    maxWidth: summaryWidth,
    maxLines: 5,
    lineHeightMult: 1.4,
  });

  canvas.y = Math.min(canvas.y, gaugeCy - gaugeRadius - 16 - 14);
  canvas.y -= 18;
  canvas.divider();

  // ---- Quick overview -------------------------------------------------
  // Solo 3 categorie (non 6): spazio ridotto per lasciare posto al blocco
  // GEO sotto (brief GEO sezione 21) senza traboccare la singola pagina
  // Free (canvas.paginationLocked non crea mai una seconda pagina).
  canvas.kicker("Panoramica");
  const overviewCategories: CategoryKey[] = ["seo", "performance", "conversion"];
  const cols = 3;
  const gutter = 12;
  const cardWidth = (CONTENT_WIDTH - gutter * (cols - 1)) / cols;
  const cardHeight = 56;
  const rowGap = 10;
  const gridTop = canvas.y;

  overviewCategories.forEach((key, i) => {
    const c = report.categoryScores.find((cs) => cs.category === key);
    if (!c) return;
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = MARGIN + col * (cardWidth + gutter);
    const yTop = gridTop - row * (cardHeight + rowGap);
    canvas.roundedRect(x, yTop - cardHeight, cardWidth, cardHeight, { radius: 9, fill: COLOR.white, border: COLOR.line, borderWidth: 0.75 });
    canvas.page.drawText(CATEGORY_LABELS[key], {
      x: x + 12,
      y: yTop - 17,
      size: 9,
      font: canvas.fontRegular,
      color: COLOR.inkSoft,
    });
    canvas.page.drawText(String(c.score), {
      x: x + 12,
      y: yTop - 40,
      size: 20,
      font: canvas.fontDisplay,
      color: scoreColor(c.score),
    });
    const scoreW = canvas.fontDisplay.widthOfTextAtSize(String(c.score), 20);
    canvas.page.drawText("/100", {
      x: x + 12 + scoreW + 4,
      y: yTop - 35,
      size: 8,
      font: canvas.fontRegular,
      color: COLOR.inkSoft,
    });
    canvas.page.drawText(scoreLabel(c.score), {
      x: x + 12,
      y: yTop - cardHeight + 11,
      size: 7.5,
      font: canvas.fontBold,
      color: scoreColor(c.score),
    });
  });

  const rows = Math.ceil(overviewCategories.length / cols);
  canvas.y = gridTop - rows * (cardHeight + rowGap) + rowGap - 8;
  canvas.divider();

  // ---- Top priorita' SEO (2, non 3: spazio ridotto per lasciare posto al
  // blocco GEO sotto — brief GEO sezione 21) ------------------------------
  canvas.kicker("Priorita' principali");
  const topIssues = sortedBySeverity(report.issues).slice(0, 2);
  if (topIssues.length === 0) {
    canvas.text("Nessuna criticita' rilevante individuata in questa analisi.", { size: 9.5, color: COLOR.inkSoft, gap: 4 });
  }
  const priorityCardHeight = 58;
  const priorityGap = 10;
  for (const issue of topIssues) {
    const top = canvas.y;
    canvas.roundedRect(MARGIN, top - priorityCardHeight, CONTENT_WIDTH, priorityCardHeight, {
      radius: 9,
      fill: COLOR.white,
      border: COLOR.line,
      borderWidth: 0.75,
    });
    const rowTop = top - 14;
    const pillW = canvas.pill(MARGIN + 14, rowTop, SEVERITY_LABEL[issue.severity], SEVERITY_COLOR[issue.severity], SEVERITY_SOFT_COLOR[issue.severity]);
    const titleWidth = CONTENT_WIDTH - 28 - pillW - 8;
    canvas.page.drawText(canvas.fitOneLine(issue.title, canvas.fontBold, 10.5, titleWidth), {
      x: MARGIN + 14 + pillW + 8,
      y: rowTop - 11,
      size: 10.5,
      font: canvas.fontBold,
      color: COLOR.ink,
    });
    canvas.y = rowTop - 20;
    canvas.text(issue.description, { size: 8.5, color: COLOR.inkSoft, gap: 5, x: MARGIN + 14, maxWidth: CONTENT_WIDTH - 28, maxLines: 1 });
    canvas.hangingLine(">", issue.recommendation, {
      size: 8.5,
      color: COLOR.ink,
      glyphColor: COLOR.accent,
      gap: 0,
      indent: 12,
      x: MARGIN + 14,
      maxWidth: CONTENT_WIDTH - 28,
      maxLines: 1,
    });
    canvas.y = top - priorityCardHeight - priorityGap;
  }

  if ((report.hiddenIssueCount ?? 0) > 0) {
    canvas.text(`+ altri ${report.hiddenIssueCount} problemi rilevati in questa analisi, non mostrati qui.`, {
      size: 8.5,
      color: COLOR.inkSoft,
      gap: 4,
    });
  }

  // ---- GEO (blocco sintetico) -----------------------------------------
  if (report.geo) {
    canvas.y -= 4;
    drawGeoFreeBlock(canvas, report.geo);
  }

  // ---- CTA Pro ------------------------------------------------------
  // Segue il contenuto con uno spazio fisso (non ancorata al fondo
  // pagina): evita un vuoto visivo tra i contenuti e la CTA quando
  // l'analisi ha poche criticita' (brief, sezione 6 — "pagine
  // apparentemente vuote").
  const ctaHeight = 78;
  const ctaTop = Math.min(canvas.y - 18, MARGIN + ctaHeight + 90);
  canvas.roundedRect(MARGIN, ctaTop - ctaHeight, CONTENT_WIDTH, ctaHeight, { radius: 12, fill: COLOR.accentDeep });
  const savedY = canvas.y;
  canvas.y = ctaTop - 20;
  canvas.text("Vuoi capire esattamente come migliorare il tuo sito?", {
    size: 12.5,
    font: "display",
    color: COLOR.white,
    gap: 6,
    x: MARGIN + 20,
    maxWidth: CONTENT_WIDTH - 40,
  });
  canvas.text(
    "Con DigitalCheck Pro ottieni un'analisi approfondita con problemi dettagliati, spiegazioni AI, priorita' operative e un piano d'azione completo.",
    { size: 9, color: rgbaWhiteSoft(), gap: 0, x: MARGIN + 20, maxWidth: CONTENT_WIDTH - 40, maxLines: 2 }
  );
  canvas.y = savedY;

  return canvas.save();
}

// pdf-lib non ha un rgba nativo: per un bianco leggermente attenuato sullo
// sfondo scuro della CTA si usa un grigio molto chiaro invece dell'opacita'.
function rgbaWhiteSoft() {
  return COLOR.line;
}

// ---------------------------------------------------------------------
// PDF Pro — report a piu' pagine, minimo 5 ma senza limite artificiale
// (brief, sezioni 3 e 20): cresce in base ai dati realmente disponibili.
// ---------------------------------------------------------------------
export async function generateProReportPdf(report: DigitalCheckReport): Promise<Uint8Array> {
  const canvas = await PdfCanvas.create();

  drawCoverAndOverview(canvas, report);
  canvas.newPage(true);
  drawScorecardPage(canvas, report);
  canvas.newPage(true);
  drawDiagnosisPages(canvas, report);
  canvas.newPage(true);
  drawInsightsPage(canvas, report);
  canvas.newPage(true);
  drawActionPlanPage(canvas, report);

  // GEO — pagine dedicate (brief GEO sezione 22): solo se lo scan ha
  // effettivamente prodotto un'analisi GEO (scan storici precedenti
  // all'introduzione del modulo non ne hanno una).
  if (report.geo) {
    canvas.newPage(true);
    drawGeoOverviewPage(canvas, report.geo);
    canvas.newPage(true);
    drawGeoIssuesPage(canvas, report.geo);
  }

  canvas.stampChrome(
    "DigitalCheck - powered by Imperium Digital",
    "DigitalCheck - Website Analysis Report"
  );

  return canvas.save();
}

// ---- PAGINA 1: Cover + Executive Overview ------------------------------
function drawCoverAndOverview(canvas: PdfCanvas, report: DigitalCheckReport) {
  canvas.y -= 8;
  canvas.text("DigitalCheck", { size: 30, font: "display", color: COLOR.accent, gap: 2 });
  canvas.text("powered by Imperium Digital", { size: 9.5, color: COLOR.inkSoft, gap: 26 });
  canvas.text("Website Analysis Report", { size: 18, font: "display", color: COLOR.ink, gap: 10 });
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
  const label = scoreLabel(report.overallScore);
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
    "Il punteggio riassume prestazioni tecniche, SEO, accessibilita' e capacita' di conversione del sito, calcolate sui dati raccolti durante l'analisi.",
    { size: 9.5, color: COLOR.inkSoft, x: asideX, maxWidth: asideWidth, maxLines: 4, gap: 0 }
  );

  canvas.y = Math.min(canvas.y, gaugeCy - gaugeRadius - 20 - 18);
  canvas.y -= 20;
  canvas.divider();

  // Executive overview
  canvas.sectionTitle("Executive Overview");
  canvas.text(report.businessImpactSummary, { size: 10.5, color: COLOR.inkSoft, gap: 16, maxLines: 6 });

  const colWidth = (CONTENT_WIDTH - 28) / 2;
  const colTop = canvas.y;
  const strengths = report.strengths.slice(0, 4);
  const highIssues = sortedBySeverity(report.issues).slice(0, 4);

  canvas.y = colTop;
  canvas.text("Punti di forza", { size: 11, font: "bold", color: COLOR.ink, gap: 6, maxWidth: colWidth });
  if (strengths.length > 0) {
    for (const s of strengths) canvas.hangingLine("+", s, { size: 9.5, maxWidth: colWidth, glyphColor: COLOR.accent, maxLines: 2, gap: 4 });
  } else {
    canvas.text("Nessun punto di forza specifico segnalato dall'analisi.", { size: 9, color: COLOR.inkSoft, maxWidth: colWidth });
  }
  const leftBottom = canvas.y;

  canvas.y = colTop;
  canvas.text("Principali criticita'", { size: 11, font: "bold", color: COLOR.ink, gap: 6, maxWidth: colWidth, x: MARGIN + colWidth + 28 });
  if (highIssues.length > 0) {
    for (const i of highIssues)
      canvas.hangingLine("!", i.title, {
        size: 9.5,
        maxWidth: colWidth,
        x: MARGIN + colWidth + 28,
        glyphColor: SEVERITY_COLOR[i.severity],
        maxLines: 2,
        gap: 4,
      });
  } else {
    canvas.text("Nessuna criticita' rilevante individuata.", { size: 9, color: COLOR.inkSoft, maxWidth: colWidth, x: MARGIN + colWidth + 28 });
  }
  const rightBottom = canvas.y;

  canvas.y = Math.min(leftBottom, rightBottom) - 10;
  canvas.divider();

  const priorities = (report.aiAnalysis?.priorities ?? report.recommendedActions).slice(0, 3);
  if (priorities.length > 0) {
    canvas.text("Priorita' strategiche", { size: 11, font: "bold", color: COLOR.ink, gap: 6 });
    priorities.forEach((p, i) => canvas.hangingLine(`${i + 1}.`, p, { size: 9.5, color: COLOR.inkSoft, gap: 4, maxLines: 2 }));
  }
}

// ---- PAGINA 2: Scorecard ------------------------------------------------
function drawScorecardPage(canvas: PdfCanvas, report: DigitalCheckReport) {
  canvas.sectionTitle("Scorecard", { subtitle: "Il punteggio di ogni area misurata, con una breve spiegazione." });

  const order: CategoryKey[] = ["seo", "performance", "mobile", "conversion", "content", "accessibility", "technical"];
  for (const key of order) {
    const c = report.categoryScores.find((cs) => cs.category === key);
    if (!c) continue;

    const note = c.notes ?? CATEGORY_METHOD_NOTE[key];
    const rowHeight = 64;
    canvas.ensureSpace(rowHeight + 10);
    const top = canvas.y;
    canvas.roundedRect(MARGIN, top - rowHeight, CONTENT_WIDTH, rowHeight, { radius: 10, fill: COLOR.white, border: COLOR.line, borderWidth: 0.75 });

    const gaugeR = 22;
    const gaugeCx = MARGIN + 34;
    const gaugeCy = top - rowHeight / 2;
    canvas.scoreGauge({ cx: gaugeCx, cy: gaugeCy, radius: gaugeR, thickness: 6, score: c.score, scoreSize: 15 });

    const textX = MARGIN + 34 + gaugeR + 22;
    const textWidth = CONTENT_WIDTH - (textX - MARGIN) - 16;
    canvas.y = top - 16;
    canvas.page.drawText(CATEGORY_LABELS[key], { x: textX, y: canvas.y - 11, size: 12, font: canvas.fontBold, color: COLOR.ink });
    const clsLabel = scoreLabel(c.score);
    const clsWidth = canvas.fontBold.widthOfTextAtSize(clsLabel, 9);
    canvas.page.drawText(clsLabel, {
      x: MARGIN + CONTENT_WIDTH - 16 - clsWidth,
      y: canvas.y - 11,
      size: 9,
      font: canvas.fontBold,
      color: scoreColor(c.score),
    });
    canvas.y = top - 32;
    canvas.text(note, { size: 8.5, color: COLOR.inkSoft, x: textX, maxWidth: textWidth, maxLines: 2, gap: 0, lineHeightMult: 1.3 });
    if (!c.verified) {
      canvas.page.drawText("Stima, non una misura diretta", {
        x: textX,
        y: top - rowHeight + 8,
        size: 7.5,
        font: canvas.fontRegular,
        color: COLOR.inkSoft,
      });
    }

    canvas.y = top - rowHeight - 12;
  }
}

// ---- PAGINA 3+: Problemi e diagnosi -------------------------------------
function drawDiagnosisPages(canvas: PdfCanvas, report: DigitalCheckReport) {
  canvas.sectionTitle("Problemi e diagnosi", {
    subtitle: "Le criticita' rilevate, raggruppate per area, con perche' contano e cosa fare.",
  });

  const byGroup = new Map<IssueCategory, ScanIssue[]>();
  for (const issue of report.issues) {
    const list = byGroup.get(issue.category) ?? [];
    list.push(issue);
    byGroup.set(issue.category, list);
  }

  let anyRendered = false;
  for (const group of ISSUE_GROUP_ORDER) {
    const issues = sortedBySeverity(byGroup.get(group) ?? []);
    if (issues.length === 0) continue;
    anyRendered = true;

    // Riserva spazio per il titolo del gruppo INSIEME alla prima card:
    // un titolo di sezione non deve mai restare isolato in fondo pagina
    // con il contenuto spinto alla pagina successiva (brief, sezione 12).
    const headingHeight = canvas.measure(ISSUE_GROUP_LABEL[group], { size: 12.5, font: "display", gap: 10 });
    const firstIssue = issues[0];
    const firstCardHeight = firstIssue ? issueCardHeight(canvas, firstIssue) : 0;
    canvas.ensureSpace(headingHeight + firstCardHeight + 10);

    canvas.text(ISSUE_GROUP_LABEL[group], { size: 12.5, font: "display", color: COLOR.accent, gap: 10 });

    for (const issue of issues) drawIssueCard(canvas, issue);
    canvas.y -= 4;
  }

  if (!anyRendered) {
    canvas.text("Non sono state rilevate criticita' significative in questa analisi.", { size: 10.5, color: COLOR.inkSoft });
  }
}

function issueCardHeight(canvas: PdfCanvas, issue: ScanIssue): number {
  const padding = 14;
  const innerWidth = CONTENT_WIDTH - padding * 2;
  const titleH = 16;
  const descH = canvas.measure(issue.description, { size: 9.5, maxWidth: innerWidth, lineHeightMult: 1.35, gap: 8 });
  const whyH = canvas.measure(issue.whyItMatters, { size: 9, maxWidth: innerWidth, lineHeightMult: 1.35, gap: 8 });
  const doH = canvas.measure(issue.recommendation, { size: 9.5, maxWidth: innerWidth, lineHeightMult: 1.35, gap: 4 });
  const impactH = 14;
  return padding * 2 + titleH + descH + 16 + whyH + 16 + doH + impactH;
}

function drawIssueCard(canvas: PdfCanvas, issue: ScanIssue) {
  const padding = 14;
  const titleH = 16;
  const innerWidth = CONTENT_WIDTH - padding * 2;
  const cardHeight = issueCardHeight(canvas, issue);

  canvas.ensureSpace(cardHeight + 10);
  const top = canvas.y;
  canvas.roundedRect(MARGIN, top - cardHeight, CONTENT_WIDTH, cardHeight, {
    radius: 10,
    fill: COLOR.white,
    border: COLOR.line,
    borderWidth: 0.75,
  });
  // Barra di accento colorata a sinistra, secondo la priorita'.
  canvas.roundedRect(MARGIN, top - cardHeight, 4, cardHeight, { radius: 2, fill: SEVERITY_COLOR[issue.severity] });

  canvas.y = top - padding;
  const pillW = canvas.pill(MARGIN + padding, canvas.y, SEVERITY_LABEL[issue.severity], SEVERITY_COLOR[issue.severity], SEVERITY_SOFT_COLOR[issue.severity]);
  const cardTitleWidth = innerWidth - pillW - 8;
  canvas.page.drawText(canvas.fitOneLine(issue.title, canvas.fontBold, 11.5, cardTitleWidth), {
    x: MARGIN + padding + pillW + 8,
    y: canvas.y - 11,
    size: 11.5,
    font: canvas.fontBold,
    color: COLOR.ink,
  });
  canvas.y = top - padding - titleH - 8;

  canvas.text(issue.description, { size: 9.5, color: COLOR.ink, x: MARGIN + padding, maxWidth: innerWidth, gap: 8, lineHeightMult: 1.35 });

  canvas.page.drawText("PERCHE' CONTA", { x: MARGIN + padding, y: canvas.y - 7, size: 7.5, font: canvas.fontBold, color: COLOR.accent });
  canvas.y -= 12;
  canvas.text(issue.whyItMatters, { size: 9, color: COLOR.inkSoft, x: MARGIN + padding, maxWidth: innerWidth, gap: 8, lineHeightMult: 1.35 });

  canvas.page.drawText("COSA FARE", { x: MARGIN + padding, y: canvas.y - 7, size: 7.5, font: canvas.fontBold, color: COLOR.accent });
  canvas.y -= 12;
  canvas.text(issue.recommendation, { size: 9.5, color: COLOR.ink, x: MARGIN + padding, maxWidth: innerWidth, gap: 4, lineHeightMult: 1.35 });

  canvas.page.drawText(`Impatto potenziale: ${ISSUE_IMPACT_LABEL[issue.category]}`, {
    x: MARGIN + padding,
    y: canvas.y - 8,
    size: 8,
    font: canvas.fontRegular,
    color: COLOR.inkSoft,
  });

  canvas.y = top - cardHeight - 12;
}

// ---- PAGINA 4: AI Insights & Raccomandazioni ----------------------------
function drawInsightsPage(canvas: PdfCanvas, report: DigitalCheckReport) {
  canvas.sectionTitle("AI Website Insights", {
    subtitle: "Lettura in linguaggio semplice dei dati raccolti durante l'analisi.",
  });

  const ai = report.aiAnalysis;

  if (!ai) {
    canvas.roundedRect(MARGIN, canvas.y - 40, CONTENT_WIDTH, 40, { radius: 8, fill: COLOR.accentSoft });
    canvas.y -= 12;
    canvas.text(
      "Analisi AI non disponibile per questa scansione. Le indicazioni sotto si basano sui controlli tecnici automatici.",
      { size: 9.5, color: COLOR.inkSoft, x: MARGIN + 14, maxWidth: CONTENT_WIDTH - 28, gap: 4 }
    );
    canvas.y -= 20;
  }

  if (report.strengths.length > 0) {
    const headingH = canvas.measure("Cosa sta funzionando", { size: 12.5, font: "bold", gap: 8 });
    const firstH = canvas.measure(report.strengths[0] ?? "", { size: 10, maxWidth: CONTENT_WIDTH - 14, gap: 5 });
    canvas.ensureSpace(headingH + firstH);
    canvas.text("Cosa sta funzionando", { size: 12.5, font: "bold", color: COLOR.ink, gap: 8 });
    for (const s of report.strengths) canvas.hangingLine("+", s, { size: 10, glyphColor: COLOR.accent, gap: 5 });
    canvas.y -= 8;
  }

  if (ai?.contentAnalysis || ai?.conversionAnalysis) {
    const firstBlock = ai.conversionAnalysis || ai.contentAnalysis;
    const headingH = canvas.measure("Cosa sta limitando il sito", { size: 12.5, font: "bold", gap: 8 });
    const subH = canvas.measure("Conversione", { size: 9.5, font: "bold", gap: 3 });
    const firstLineH = canvas.measure(firstBlock, { size: 9.5, maxWidth: CONTENT_WIDTH, gap: 10, lineHeightMult: 1.4, maxLines: 1 });
    canvas.ensureSpace(headingH + subH + firstLineH);
    canvas.text("Cosa sta limitando il sito", { size: 12.5, font: "bold", color: COLOR.ink, gap: 8 });
    if (ai.conversionAnalysis) {
      canvas.text("Conversione", { size: 9.5, font: "bold", color: COLOR.accent, gap: 3 });
      canvas.text(ai.conversionAnalysis, { size: 9.5, color: COLOR.inkSoft, gap: 10, lineHeightMult: 1.4 });
    }
    if (ai.contentAnalysis) {
      canvas.text("Contenuti", { size: 9.5, font: "bold", color: COLOR.accent, gap: 3 });
      canvas.text(ai.contentAnalysis, { size: 9.5, color: COLOR.inkSoft, gap: 10, lineHeightMult: 1.4 });
    }
    canvas.y -= 4;
  }

  const quickWins = report.issues.filter((i) => i.severity === "low").slice(0, 3);
  if (quickWins.length > 0) {
    const headingH = canvas.measure("Opportunita'", { size: 12.5, font: "bold", gap: 4 });
    const introH = canvas.measure("Interventi a basso sforzo che possono migliorare rapidamente alcuni aspetti del sito.", {
      size: 8.5,
      gap: 8,
    });
    const firstQuickWin = quickWins[0];
    const firstItemH = firstQuickWin
      ? canvas.measure(firstQuickWin.recommendation, { size: 9.5, maxWidth: CONTENT_WIDTH - 14, gap: 5, maxLines: 2 })
      : 0;
    canvas.ensureSpace(headingH + introH + firstItemH);
    canvas.text("Opportunita'", { size: 12.5, font: "bold", color: COLOR.ink, gap: 4 });
    canvas.text("Interventi a basso sforzo che possono migliorare rapidamente alcuni aspetti del sito.", {
      size: 8.5,
      color: COLOR.inkSoft,
      gap: 8,
    });
    for (const q of quickWins) canvas.hangingLine(">", q.recommendation, { size: 9.5, glyphColor: COLOR.accent, gap: 5, maxLines: 2 });
    canvas.y -= 8;
  }

  const recommendations = ai?.priorities?.length ? ai.priorities : report.recommendedActions;
  if (recommendations.length > 0) {
    const headingH = canvas.measure("Raccomandazioni", { size: 12.5, font: "bold", gap: 8 });
    const firstRec = recommendations[0];
    const firstItemH = firstRec ? canvas.measure(firstRec, { size: 10, maxWidth: CONTENT_WIDTH - 14, gap: 6, maxLines: 2 }) : 0;
    canvas.ensureSpace(headingH + firstItemH);
    canvas.text("Raccomandazioni", { size: 12.5, font: "bold", color: COLOR.ink, gap: 8 });
    recommendations.forEach((r, i) => canvas.hangingLine(`${i + 1}.`, r, { size: 10, color: COLOR.ink, gap: 6, maxLines: 2 }));
  }
}

// ---- PAGINA 5: Action Plan + conclusione --------------------------------
const ACTION_TIERS: { severity: ScanIssue["severity"]; label: string }[] = [
  { severity: "high", label: "01 - Critico" },
  { severity: "medium", label: "02 - Alto" },
  { severity: "low", label: "03 - Basso / Opportunita'" },
];

function drawActionPlanPage(canvas: PdfCanvas, report: DigitalCheckReport) {
  canvas.sectionTitle("Action Plan", {
    subtitle: "Gli interventi consigliati, in ordine di priorita'.",
  });

  let index = 1;
  for (const tier of ACTION_TIERS) {
    const issues = report.issues.filter((i) => i.severity === tier.severity);
    if (issues.length === 0) continue;

    const headingHeight = canvas.measure(tier.label, { size: 11.5, font: "bold", gap: 8 });
    const firstIssue = issues[0];
    const firstItemHeight = firstIssue ? actionItemHeight(canvas, firstIssue) : 0;
    canvas.ensureSpace(headingHeight + firstItemHeight + 8);
    canvas.text(tier.label, { size: 11.5, font: "bold", color: SEVERITY_COLOR[tier.severity], gap: 8 });

    for (const issue of issues) {
      drawActionItem(canvas, issue, index);
      index += 1;
    }
    canvas.y -= 6;
  }

  canvas.ensureSpace(60);
  canvas.divider();
  if (report.unverifiable.length > 0) {
    canvas.text("Cosa non e' stato possibile verificare automaticamente", { size: 10.5, font: "bold", color: COLOR.ink, gap: 6 });
    for (const u of report.unverifiable) canvas.hangingLine("•", u, { size: 8.5, color: COLOR.inkSoft, gap: 3, maxLines: 2 });
    canvas.y -= 8;
  }

  canvas.text("Conclusione", { size: 11, font: "bold", color: COLOR.ink, gap: 6 });
  canvas.text(
    `Sulla base dei dati raccolti, ${report.requestedUrl} ottiene un punteggio complessivo di ${report.overallScore}/100 (${scoreLabel(
      report.overallScore
    )}). Gli interventi indicati sopra sono ordinati per priorita': affrontarli in quest'ordine massimizza l'effetto rispetto allo sforzo richiesto.`,
    { size: 9.5, color: COLOR.inkSoft, maxLines: 4 }
  );
}

function actionItemHeight(canvas: PdfCanvas, issue: ScanIssue): number {
  const padding = 12;
  const badgeW = 22;
  const innerWidth = CONTENT_WIDTH - padding * 2 - badgeW;
  const titleH = 14;
  const metaH = 12;
  const whyH = canvas.measure(issue.whyItMatters, { size: 8.5, maxWidth: innerWidth, lineHeightMult: 1.3, gap: 4 });
  const goalH = canvas.measure(ISSUE_GOAL_LABEL[issue.category], { size: 8.5, maxWidth: innerWidth, lineHeightMult: 1.3, gap: 0 });
  return padding * 2 + titleH + 4 + metaH + 6 + whyH + goalH;
}

function drawActionItem(canvas: PdfCanvas, issue: ScanIssue, index: number) {
  const padding = 12;
  const badgeW = 22;
  const innerX = MARGIN + padding + badgeW;
  const innerWidth = CONTENT_WIDTH - padding * 2 - badgeW;
  const titleH = 14;
  const metaH = 12;
  const cardHeight = actionItemHeight(canvas, issue);

  canvas.ensureSpace(cardHeight + 8);
  const top = canvas.y;
  canvas.roundedRect(MARGIN, top - cardHeight, CONTENT_WIDTH, cardHeight, {
    radius: 8,
    fill: COLOR.white,
    border: COLOR.line,
    borderWidth: 0.75,
  });

  canvas.roundedRect(MARGIN + padding, top - padding - 16, badgeW, 16, { radius: 4, fill: COLOR.accentSoft });
  const numLabel = String(index).padStart(2, "0");
  const numWidth = canvas.fontBold.widthOfTextAtSize(numLabel, 9);
  canvas.page.drawText(numLabel, {
    x: MARGIN + padding + (badgeW - numWidth) / 2,
    y: top - padding - 12,
    size: 9,
    font: canvas.fontBold,
    color: COLOR.accent,
  });

  canvas.page.drawText(canvas.fitOneLine(issue.title, canvas.fontBold, 10.5, innerWidth - 8), {
    x: innerX + 8,
    y: top - padding - 11,
    size: 10.5,
    font: canvas.fontBold,
    color: COLOR.ink,
  });

  canvas.y = top - padding - titleH - 2;
  const metaPrefix = `Area: ${ISSUE_GROUP_LABEL[issue.category]}   ·   Azione: `;
  const metaPrefixWidth = canvas.fontRegular.widthOfTextAtSize(metaPrefix, 8.5);
  const metaLine = metaPrefix + truncateOneLine(canvas, issue.recommendation, innerWidth - 8 - metaPrefixWidth, 8.5);
  canvas.page.drawText(metaLine, { x: innerX + 8, y: canvas.y - 8, size: 8.5, font: canvas.fontRegular, color: COLOR.inkSoft });
  canvas.y -= metaH + 4;

  canvas.text(`Motivazione: ${issue.whyItMatters}`, {
    size: 8.5,
    color: COLOR.inkSoft,
    x: innerX + 8,
    maxWidth: innerWidth - 8,
    gap: 4,
    lineHeightMult: 1.3,
  });
  canvas.text(`Obiettivo: ${ISSUE_GOAL_LABEL[issue.category]}`, {
    size: 8.5,
    color: COLOR.ink,
    x: innerX + 8,
    maxWidth: innerWidth - 8,
    gap: 0,
    lineHeightMult: 1.3,
  });

  canvas.y = top - cardHeight - 8;
}

function truncateOneLine(canvas: PdfCanvas, text: string, maxWidth: number, size: number): string {
  const font = canvas.fontRegular;
  if (font.widthOfTextAtSize(text, size) <= maxWidth) return text;
  let truncated = text;
  while (truncated.length > 0 && font.widthOfTextAtSize(`${truncated}…`, size) > maxWidth) {
    truncated = truncated.slice(0, -1).trimEnd();
  }
  return `${truncated}…`;
}

export async function generateReportPdf(report: DigitalCheckReport, plan: PlanType = "PRO"): Promise<Uint8Array> {
  return getPlanFeatures(plan).fullReports ? generateProReportPdf(report) : generateFreeReportPdf(report);
}
