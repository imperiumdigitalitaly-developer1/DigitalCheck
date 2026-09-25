import type { CategoryKey, DigitalCheckReport } from "@/types";
import type { PlanType } from "@prisma/client";
import type { AnalysisStatus } from "@/lib/analysis/types";
import { STATUS_LABEL, scoreToStatus } from "@/lib/analysis/constants";
import { CATEGORY_LABELS } from "@/lib/category-labels";
import { getPlanFeatures } from "@/lib/billing/plan-config";
import { PdfCanvas, CONTENT_WIDTH, MARGIN, PAGE_WIDTH, type Color } from "./canvas";
import { COLOR, CATEGORY_MONOGRAM, scoreColor } from "./theme";
import { drawGeoFreeBlock, drawGeoOverviewPage, drawGeoIssuesPage } from "./geo-section";
import { drawCategoryReportPage } from "./category-section";
import { drawCrossAnalysisPage } from "./cross-analysis-section";
import { drawActionPlanPage } from "./action-plan-section";
import { drawAiReportPage } from "./ai-report-section";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("it-IT", { day: "2-digit", month: "long", year: "numeric" });
}

// Frase di interpretazione del punteggio (redesign PDF, sezione 3: "sotto
// lo score inserisci una frase che spieghi cosa significa realmente il
// punteggio"). Testo fisso per fascia di stato, mai generato dall'AI ne'
// specifico al sito: e' una spiegazione della scala, non un'osservazione.
const SCORE_MEANING: Record<AnalysisStatus, string> = {
  excellent: "Il sito soddisfa la quasi totalita' dei controlli tecnici e strategici rilevati durante l'audit.",
  good: "Il sito soddisfa la maggior parte dei controlli rilevati, con alcuni margini di miglioramento circoscritti.",
  needs_improvement: "Il sito presenta una base funzionante, ma piu' aree richiedono interventi per raggiungere lo standard atteso.",
  poor: "Il sito presenta lacune significative in piu' aree analizzate, con impatto concreto su visibilita' ed esperienza utente.",
  critical: "Il sito presenta criticita' diffuse che richiedono un intervento prioritario su piu' fronti.",
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
  canvas.drawLogo(MARGIN, headerTop, 22);
  canvas.y = headerTop - 22 - 4;
  canvas.text("powered by Imperium Digital", { size: 7.5, color: COLOR.inkSoft, x: MARGIN, gap: 10 });

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

  canvas.text("Audit Professionale del Sito Web", { size: 14, font: "display", color: COLOR.ink, gap: 3 });
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
  const status = scoreToStatus(report.overallScore);
  const label = STATUS_LABEL[status];
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

  const cards: { key: CategoryKey | "geo"; label: string; score: number }[] = report.analyses.map((a) => ({
    key: a.category,
    label: CATEGORY_LABELS[a.category],
    score: a.score,
  }));
  if (report.geo) cards.push({ key: "geo", label: "GEO", score: report.geo.overallScore });

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
    "Con DigitalCheck Pro ottieni l'audit professionale completo: metodologia, sottopunteggi, problemi rilevati con gravita' e impatto, raccomandazioni, analisi incrociata tra le categorie e un piano d'azione prioritizzato.",
    { size: 9, color: COLOR.line, gap: 0, x: MARGIN + 20, maxWidth: CONTENT_WIDTH - 40, maxLines: 3 }
  );

  return canvas.save();
}

// ---------------------------------------------------------------------
// PDF Pro — il vero audit professionale (brief redesign PDF): un report
// che comunica autorevolezza, precisione e valore consulenziale, non
// un'esportazione grezza dei dati di scansione. Lunghezza dinamica: cresce
// in base ai dati realmente disponibili.
// ---------------------------------------------------------------------
export async function generateProReportPdf(report: DigitalCheckReport): Promise<Uint8Array> {
  const canvas = await PdfCanvas.create();

  drawCover(canvas, report);
  // Dalla copertina (senza chrome) in poi, ogni capitolo riserva da solo lo
  // spazio che gli serve (sectionTitle/drawCategoryHeader/
  // drawGeoOverviewPage) e continua sulla pagina precedente quando c'e'
  // posto, invece di aprirne sempre una nuova: elimina le pagine quasi
  // vuote che si formavano quando un capitolo superava di poco la pagina
  // precedente (redesign PDF, sezione 25). Un solo newPage esplicito serve
  // per passare dalla copertina (chrome=false) al corpo del report.
  canvas.newPage(true);
  drawExecutiveSummary(canvas, report);
  drawScorecardPage(canvas, report);

  for (const analysis of report.analyses) {
    drawCategoryReportPage(canvas, analysis);
  }

  // GEO — pagine dedicate gia' esistenti (brief GEO sezione 22), solo se lo
  // scan ha effettivamente prodotto un'analisi GEO.
  if (report.geo) {
    drawGeoOverviewPage(canvas, report.geo);
    drawGeoIssuesPage(canvas, report.geo);
  }

  drawCrossAnalysisPage(canvas, report.crossAnalysis);
  drawActionPlanPage(canvas, report.actionPlan);
  drawAiReportPage(canvas, report);
  drawFinalPage(canvas, report);

  canvas.stampChrome("DigitalCheck · powered by Imperium Digital", "DigitalCheck — Audit Professionale del Sito Web");

  return canvas.save();
}

// ---- PAGINA 1: Copertina (redesign PDF, sezione 3) -----------------------
// Nessun chrome (header/footer/numero pagina): la copertina resta a filo
// margine, come la prima pagina di un vero report di consulenza.
function drawCover(canvas: PdfCanvas, report: DigitalCheckReport) {
  canvas.y -= 30;
  const logoHeight = canvas.drawLogoCentered(canvas.y, 74);
  canvas.y -= logoHeight + 14;
  canvas.text("powered by Imperium Digital", { size: 9.5, color: COLOR.inkSoft, align: "center", gap: 40 });

  canvas.text("AUDIT PROFESSIONALE DEL SITO WEB", { size: 11, font: "bold", color: COLOR.ink, align: "center", gap: 26 });

  canvas.text(report.requestedUrl, { size: 15, font: "bold", color: COLOR.ink, align: "center", gap: 6 });
  canvas.text(`${formatDate(report.generatedAt)}  ·  ${report.pagesAnalyzed} pagine analizzate`, {
    size: 9.5,
    color: COLOR.inkSoft,
    align: "center",
    gap: 60,
  });

  // Score hero, grande e centrato.
  const gaugeRadius = 92;
  const gaugeCx = PAGE_WIDTH / 2;
  const gaugeCy = canvas.y - gaugeRadius;
  canvas.scoreGauge({ cx: gaugeCx, cy: gaugeCy, radius: gaugeRadius, thickness: 14, score: report.overallScore, scoreSize: 56 });

  const status = scoreToStatus(report.overallScore);
  const label = STATUS_LABEL[status];
  const labelSize = 15;
  const labelWidth = canvas.fontBold.widthOfTextAtSize(label, labelSize);
  canvas.page.drawText(label, {
    x: gaugeCx - labelWidth / 2,
    y: gaugeCy - gaugeRadius - 26,
    size: labelSize,
    font: canvas.fontBold,
    color: scoreColor(report.overallScore),
  });

  canvas.y = gaugeCy - gaugeRadius - 50;
  canvas.text(SCORE_MEANING[status], { size: 10.5, color: COLOR.inkSoft, align: "center", maxWidth: 360, x: (PAGE_WIDTH - 360) / 2, maxLines: 2, lineHeightMult: 1.45, gap: 0 });

  // Chiusura minimale della copertina: nessun testo aggiuntivo (brief
  // sezione 3: "non utilizzare troppo testo").
  canvas.y = MARGIN + 26;
  const closing = canvas.fitOneLine(
    "Audit tecnico e consulenziale — SEO · Performance · Mobile · Contenuti · Conversione · Accessibilita' · Tecnica · GEO",
    canvas.fontRegular,
    7.5,
    CONTENT_WIDTH
  );
  const closingWidth = canvas.fontRegular.widthOfTextAtSize(closing, 7.5);
  canvas.page.drawText(closing, {
    x: (PAGE_WIDTH - closingWidth) / 2,
    y: canvas.y,
    size: 7.5,
    font: canvas.fontRegular,
    color: COLOR.inkSoft,
  });
}

// ---- PAGINA 2: Sintesi Esecutiva (redesign PDF, sezione 4) ---------------
function drawExecutiveSummary(canvas: PdfCanvas, report: DigitalCheckReport) {
  canvas.sectionTitle("Sintesi Esecutiva", { subtitle: "Il risultato dell'audit, in sintesi." });

  // Ribbon compatto con il punteggio (gia' mostrato in copertina in grande:
  // qui resta solo come riferimento rapido, brief sezione 22 — mai
  // ripetuto identico, qui e' un promemoria minimale prima della sintesi
  // vera e propria).
  const ribbonHeight = 46;
  const ribbonTop = canvas.y;
  canvas.roundedRect(MARGIN, ribbonTop - ribbonHeight, CONTENT_WIDTH, ribbonHeight, { radius: 10, fill: COLOR.accentSoft });
  canvas.y = ribbonTop - 16;
  const scoreLabelText = `DigitalCheck Score: ${report.overallScore}/100 — ${STATUS_LABEL[scoreToStatus(report.overallScore)]}`;
  canvas.page.drawText(scoreLabelText, { x: MARGIN + 16, y: canvas.y - 10, size: 11.5, font: canvas.fontBold, color: COLOR.accentDeep });
  canvas.y = ribbonTop - ribbonHeight + 12;

  canvas.y = ribbonTop - ribbonHeight - 16;
  canvas.text(report.businessImpactSummary, { size: 10, color: COLOR.inkSoft, maxLines: 5, lineHeightMult: 1.4, gap: 16 });
  canvas.divider();

  // ---- KEY STRENGTHS / KEY ISSUES: due blocchi visivamente distinti ------
  const colWidth = (CONTENT_WIDTH - 24) / 2;
  const colTop = canvas.y;
  const strengths = report.strengths.slice(0, 4);
  const issues = Array.from(new Map(report.actionPlan.slice(0, 8).map((i) => [i.title, i])).values()).slice(0, 5);

  const blockHeight = Math.max(keyBlockHeight(strengths.length), keyBlockHeight(issues.length));
  canvas.ensureSpace(blockHeight + 16);

  drawKeyBlock(canvas, "PUNTI DI FORZA", COLOR.accent, COLOR.accentSoft, MARGIN, colTop, colWidth, blockHeight, strengths, "+", COLOR.accent);
  drawKeyBlock(
    canvas,
    "PROBLEMI PRINCIPALI",
    COLOR.ink,
    COLOR.paper,
    MARGIN + colWidth + 24,
    colTop,
    colWidth,
    blockHeight,
    issues.map((i) => i.title),
    "!",
    scoreColor(30)
  );

  canvas.y = colTop - blockHeight - 18;
  canvas.divider();

  // ---- PRIORITY ACTIONS: card numerate a piena larghezza -------------------
  const priorities = report.recommendedActions.slice(0, 5);
  if (priorities.length > 0) {
    canvas.kicker("Azioni Prioritarie");
    priorities.forEach((p, i) => {
      const cardH = canvas.measure(p, { size: 9.5, maxWidth: CONTENT_WIDTH - 44, lineHeightMult: 1.35, gap: 0, maxLines: 2 }) + 16;
      canvas.ensureSpace(cardH + 8);
      const top = canvas.y;
      canvas.roundedRect(MARGIN, top - cardH, CONTENT_WIDTH, cardH, { radius: 8, fill: COLOR.white, border: COLOR.line, borderWidth: 0.75 });
      const badgeSize = 20;
      canvas.roundedRect(MARGIN + 10, top - 8 - badgeSize, badgeSize, badgeSize, { radius: 5, fill: COLOR.accent });
      const numLabel = String(i + 1);
      const numWidth = canvas.fontBold.widthOfTextAtSize(numLabel, 10);
      canvas.page.drawText(numLabel, { x: MARGIN + 10 + (badgeSize - numWidth) / 2, y: top - 8 - badgeSize / 2 - 3.5, size: 10, font: canvas.fontBold, color: COLOR.white });
      canvas.text(p, { size: 9.5, color: COLOR.ink, x: MARGIN + 10 + badgeSize + 12, maxWidth: CONTENT_WIDTH - 44 - badgeSize, maxLines: 2, gap: 0, lineHeightMult: 1.35 });
      canvas.y = top - cardH - 8;
    });
  }
}

function keyBlockHeight(itemCount: number): number {
  const headerH = 34;
  const padding = 12;
  const itemH = 26; // stima media per riga di bullet
  const emptyH = itemCount === 0 ? 20 : 0;
  return headerH + padding * 2 + itemCount * itemH + emptyH;
}

function drawKeyBlock(
  canvas: PdfCanvas,
  kicker: string,
  accentColor: Color,
  headerFill: Color,
  x: number,
  top: number,
  width: number,
  height: number,
  items: string[],
  glyph: string,
  glyphColor: Color
) {
  canvas.roundedRect(x, top - height, width, height, { radius: 10, fill: COLOR.white, border: COLOR.line, borderWidth: 0.75 });
  canvas.roundedRect(x, top - 30, width, 30, { radius: 10, fill: headerFill });
  // Angoli inferiori dell'header quadrati (l'header e' solo la fascia
  // superiore): sovrapponi un rettangolo netto sotto per tagliare
  // l'arrotondamento residuo.
  canvas.page.drawRectangle({ x, y: top - 30, width, height: 8, color: headerFill });
  canvas.page.drawText(kicker, { x: x + 14, y: top - 20, size: 9.5, font: canvas.fontBold, color: accentColor });

  const savedY = canvas.y;
  canvas.y = top - 30 - 14;
  if (items.length === 0) {
    canvas.text("Nessun elemento rilevante segnalato dall'analisi.", { size: 8.5, color: COLOR.inkSoft, x: x + 14, maxWidth: width - 28, gap: 0 });
  } else {
    for (const item of items) {
      canvas.hangingLine(glyph, item, { size: 9, x: x + 14, maxWidth: width - 28, glyphColor, gap: 6, maxLines: 2, lineHeightMult: 1.3 });
    }
  }
  canvas.y = savedY;
}

// ---- PAGINA 3: Scorecard, griglia 2x4 (redesign PDF, sezione 5) ---------
function drawScorecardPage(canvas: PdfCanvas, report: DigitalCheckReport) {
  canvas.sectionTitle("Quadro dei Punteggi", { subtitle: "Le 8 categorie a colpo d'occhio, per un confronto immediato." });

  const cards: { key: CategoryKey | "geo"; label: string; score: number; interpretation: string; verified: boolean }[] =
    report.analyses.map((a) => ({
      key: a.category,
      label: CATEGORY_LABELS[a.category],
      score: a.score,
      interpretation: a.shortSummary,
      verified: a.dataAvailability === "verified",
    }));
  if (report.geo) {
    cards.push({
      key: "geo",
      label: "GEO",
      score: report.geo.overallScore,
      interpretation: report.geoShortSummary ?? "Predisposizione del sito a essere compreso da motori di ricerca generativi e AI answer engine.",
      verified: true,
    });
  }

  const cols = 2;
  const gutter = 16;
  const cardWidth = (CONTENT_WIDTH - gutter * (cols - 1)) / cols;
  const cardHeight = 108;
  const rowGap = 14;

  for (let i = 0; i < cards.length; i += cols) {
    const rowCards = cards.slice(i, i + cols);
    canvas.ensureSpace(cardHeight + rowGap);
    const rowTop = canvas.y;
    rowCards.forEach((c, colIdx) => {
      const x = MARGIN + colIdx * (cardWidth + gutter);
      drawScorecardGridCard(canvas, x, rowTop, cardWidth, cardHeight, c);
    });
    canvas.y = rowTop - cardHeight - rowGap;
  }
}

function drawScorecardGridCard(
  canvas: PdfCanvas,
  x: number,
  top: number,
  width: number,
  height: number,
  card: { key: CategoryKey | "geo"; label: string; score: number; interpretation: string; verified: boolean }
) {
  canvas.roundedRect(x, top - height, width, height, { radius: 10, fill: COLOR.white, border: COLOR.line, borderWidth: 0.75 });

  const pad = 14;
  canvas.monogramBadge(x + pad, top - pad, CATEGORY_MONOGRAM[card.key], { size: 26 });
  canvas.page.drawText(card.label, { x: x + pad + 34, y: top - pad - 12, size: 11, font: canvas.fontBold, color: COLOR.ink });
  const statusLbl = STATUS_LABEL[scoreToStatus(card.score)];
  canvas.page.drawText(statusLbl, { x: x + pad + 34, y: top - pad - 25, size: 8, font: canvas.fontBold, color: scoreColor(card.score) });

  const scoreText = String(card.score);
  const scoreSize = 22;
  const scoreWidth = canvas.fontDisplay.widthOfTextAtSize(scoreText, scoreSize);
  canvas.page.drawText(scoreText, { x: x + width - pad - scoreWidth - 22, y: top - pad - 18, size: scoreSize, font: canvas.fontDisplay, color: scoreColor(card.score) });
  canvas.page.drawText("/100", { x: x + width - pad - 20, y: top - pad - 13, size: 7.5, font: canvas.fontRegular, color: COLOR.inkSoft });

  const textTop = top - pad - 34 - 12;
  const savedY = canvas.y;
  canvas.y = textTop;
  canvas.text(card.interpretation, { size: 8.5, color: COLOR.inkSoft, x: x + pad, maxWidth: width - pad * 2, maxLines: 3, gap: 0, lineHeightMult: 1.3 });
  if (!card.verified) {
    canvas.page.drawText("Dato parziale o stimato", { x: x + pad, y: top - height + 10, size: 7, font: canvas.fontRegular, color: COLOR.inkSoft });
  }
  canvas.y = savedY;
}

// ---- Ultima pagina: chiusura del report (redesign PDF, sezione 21) -------
function drawFinalPage(canvas: PdfCanvas, report: DigitalCheckReport) {
  canvas.sectionTitle("Valutazione Finale");

  canvas.kicker("DigitalCheck Score Finale");
  const gaugeRadius = 46;
  const gaugeCx = MARGIN + gaugeRadius + 4;
  const gaugeCy = canvas.y - gaugeRadius - 4;
  canvas.scoreGauge({ cx: gaugeCx, cy: gaugeCy, radius: gaugeRadius, thickness: 9, score: report.overallScore, scoreSize: 26 });
  const status = scoreToStatus(report.overallScore);
  const label = STATUS_LABEL[status];
  const labelWidth = canvas.fontBold.widthOfTextAtSize(label, 11);
  canvas.page.drawText(label, { x: gaugeCx - labelWidth / 2, y: gaugeCy - gaugeRadius - 16, size: 11, font: canvas.fontBold, color: scoreColor(report.overallScore) });

  const asideX = gaugeCx + gaugeRadius + 26;
  const asideWidth = PAGE_WIDTH - MARGIN - asideX;
  const savedY = canvas.y;
  canvas.y = savedY - 4;
  const closingText =
    (report.aiInsights?.finalAssessment && report.aiInsights.finalAssessment.length > 0
      ? report.aiInsights.finalAssessment
      : null) ?? SCORE_MEANING[status];
  canvas.text(closingText, { size: 9.5, color: COLOR.inkSoft, x: asideX, maxWidth: asideWidth, maxLines: 6, gap: 0, lineHeightMult: 1.4 });

  canvas.y = Math.min(canvas.y, gaugeCy - gaugeRadius - 16 - 16);
  canvas.y -= 20;
  canvas.divider();

  const nextSteps = report.recommendedActions.slice(0, 5);
  if (nextSteps.length > 0) {
    canvas.kicker("Prossimi Passi");
    nextSteps.forEach((p, i) => canvas.hangingLine(`${i + 1}.`, p, { size: 10, color: COLOR.ink, gap: 6, maxLines: 2, lineHeightMult: 1.35 }));
    canvas.y -= 8;
  }

  canvas.divider();
  canvas.calloutBox(
    "Un ultimo promemoria",
    "Questo report combina controlli tecnici automatici e, dove disponibile, un'interpretazione AI dei risultati: rappresenta lo stato del sito al momento dell'analisi, non una certificazione permanente. Ripetere l'analisi periodicamente permette di misurare i progressi.",
    { maxLines: 3 }
  );
}

export async function generateReportPdf(report: DigitalCheckReport, plan: PlanType = "PRO"): Promise<Uint8Array> {
  return getPlanFeatures(plan).fullReports ? generateProReportPdf(report) : generateFreeReportPdf(report);
}
