import { PDFDocument, StandardFonts, rgb, PDFPage, PDFFont } from "pdf-lib";
import type { CategoryKey, DigitalCheckReport, IssueSeverity } from "@/types";
import { scoreLabel } from "@/lib/scoring/weights";
import { CATEGORY_LABELS } from "@/lib/category-labels";
import type { PlanType } from "@prisma/client";
import { getPlanFeatures } from "@/lib/billing/plan-config";

const MARGIN = 50;
const PAGE_WIDTH = 595.28; // A4
const PAGE_HEIGHT = 841.89;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

const INK = rgb(0x14 / 255, 0x17 / 255, 0x1c / 255);
const INK_SOFT = rgb(0x3a / 255, 0x3f / 255, 0x47 / 255);
const ACCENT = rgb(0x1f / 255, 0x6f / 255, 0x64 / 255);
const ACCENT_SOFT = rgb(0xe4 / 255, 0xef / 255, 0xec / 255);
const LINE = rgb(0xe3 / 255, 0xe0 / 255, 0xd8 / 255);

const SEVERITY_COLOR: Record<IssueSeverity, ReturnType<typeof rgb>> = {
  high: rgb(0xb4 / 255, 0x48 / 255, 0x3f / 255),
  medium: rgb(0xc9 / 255, 0x7a / 255, 0x3d / 255),
  low: rgb(0x3f / 255, 0x7d / 255, 0x8f / 255),
};

const SEVERITY_LABEL: Record<IssueSeverity, string> = {
  high: "Critico",
  medium: "Alto",
  low: "Medio",
};

function scoreColor(score: number): ReturnType<typeof rgb> {
  if (score < 40) return rgb(0xb4 / 255, 0x48 / 255, 0x3f / 255);
  if (score < 60) return rgb(0xc9 / 255, 0x7a / 255, 0x3d / 255);
  if (score < 75) return rgb(0x3f / 255, 0x7d / 255, 0x8f / 255);
  if (score < 90) return rgb(0x1f / 255, 0x6f / 255, 0x64 / 255);
  return rgb(0x2f / 255, 0x7a / 255, 0x4f / 255);
}

class PdfCursor {
  doc: PDFDocument;
  page: PDFPage;
  y: number;
  fontRegular: PDFFont;
  fontBold: PDFFont;
  pageCount = 1;

  constructor(doc: PDFDocument, page: PDFPage, fontRegular: PDFFont, fontBold: PDFFont) {
    this.doc = doc;
    this.page = page;
    this.y = PAGE_HEIGHT - MARGIN;
    this.fontRegular = fontRegular;
    this.fontBold = fontBold;
  }

  newPage() {
    this.page = this.doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    this.y = PAGE_HEIGHT - MARGIN;
    this.pageCount += 1;
  }

  ensureSpace(height: number) {
    if (this.y - height < MARGIN) this.newPage();
  }

  private wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
    const words = text.split(/\s+/);
    const lines: string[] = [];
    let current = "";
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) > maxWidth && current) {
        lines.push(current);
        current = word;
      } else {
        current = candidate;
      }
    }
    if (current) lines.push(current);
    return lines;
  }

  text(
    value: string,
    opts: { size?: number; bold?: boolean; color?: ReturnType<typeof rgb>; gap?: number; maxWidth?: number } = {}
  ) {
    const size = opts.size ?? 11;
    const font = opts.bold ? this.fontBold : this.fontRegular;
    const color = opts.color ?? INK;
    const maxWidth = opts.maxWidth ?? CONTENT_WIDTH;
    const lineHeight = size * 1.35;

    const lines = this.wrapText(value, font, size, maxWidth);
    for (const line of lines) {
      this.ensureSpace(lineHeight);
      this.page.drawText(line, { x: MARGIN, y: this.y - size, size, font, color });
      this.y -= lineHeight;
    }
    this.y -= opts.gap ?? 4;
  }

  divider() {
    this.ensureSpace(20);
    this.page.drawLine({
      start: { x: MARGIN, y: this.y },
      end: { x: PAGE_WIDTH - MARGIN, y: this.y },
      thickness: 0.75,
      color: LINE,
    });
    this.y -= 16;
  }

  sectionTitle(title: string) {
    this.ensureSpace(30);
    this.text(title, { size: 15, bold: true, color: ACCENT, gap: 8 });
  }

  /** Barra orizzontale colorata proporzionale al punteggio, con etichetta e valore. */
  scoreBar(label: string, score: number, note?: string) {
    const barHeight = 8;
    const barWidth = CONTENT_WIDTH - 90;
    this.ensureSpace(28);
    const rowTop = this.y;
    this.page.drawText(label, { x: MARGIN, y: rowTop - 10, size: 10, font: this.fontRegular, color: INK });
    this.page.drawText(String(score), {
      x: PAGE_WIDTH - MARGIN - 24,
      y: rowTop - 10,
      size: 10,
      font: this.fontBold,
      color: scoreColor(score),
    });
    const barY = rowTop - 22;
    this.page.drawRectangle({ x: MARGIN + 110, y: barY, width: barWidth - 110, height: barHeight, color: LINE });
    this.page.drawRectangle({
      x: MARGIN + 110,
      y: barY,
      width: Math.max(2, ((barWidth - 110) * score) / 100),
      height: barHeight,
      color: scoreColor(score),
    });
    this.y = barY - 6;
    if (note) this.text(note, { size: 8, color: INK_SOFT, gap: 6 });
    else this.y -= 4;
  }

  footer(brandNote: string) {
    this.page.drawText(brandNote, { x: MARGIN, y: MARGIN - 28, size: 8, font: this.fontRegular, color: INK_SOFT });
    this.page.drawText(`${this.pageCount}`, {
      x: PAGE_WIDTH - MARGIN - 10,
      y: MARGIN - 28,
      size: 8,
      font: this.fontRegular,
      color: INK_SOFT,
    });
  }
}

function header(cursor: PdfCursor, report: DigitalCheckReport, subtitle: string) {
  cursor.text("DigitalCheck", { size: 22, bold: true, color: ACCENT, gap: 0 });
  cursor.text("powered by Imperium Digital", { size: 8, color: INK_SOFT, gap: 10 });
  cursor.text(subtitle, { size: 12, color: INK_SOFT, gap: 2 });
  cursor.text(report.requestedUrl, { size: 11, bold: true, gap: 2 });
  cursor.text(`Data analisi: ${new Date(report.generatedAt).toLocaleDateString("it-IT")}`, {
    size: 9,
    color: INK_SOFT,
    gap: 14,
  });
}

function issueBlock(cursor: PdfCursor, issue: DigitalCheckReport["issues"][number]) {
  cursor.ensureSpace(64);
  cursor.text(issue.title, { size: 11.5, bold: true, gap: 2 });
  cursor.text(`Priorita': ${SEVERITY_LABEL[issue.severity]}`, { size: 8.5, color: SEVERITY_COLOR[issue.severity], gap: 3 });
  cursor.text(issue.description, { size: 9.5, color: INK_SOFT, gap: 3 });
  cursor.text(`Azione consigliata: ${issue.recommendation}`, { size: 9.5, gap: 12 });
}

// ---------------------------------------------------------------------
// PDF Free: una sola pagina, sintetica (brief sezione 4). Niente analisi
// completa, niente AI, niente storico — solo l'essenziale + un rimando
// elegante al piano Pro.
// ---------------------------------------------------------------------
export async function generateFreeReportPdf(report: DigitalCheckReport): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const fontRegular = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const cursor = new PdfCursor(doc, page, fontRegular, fontBold);

  header(cursor, report, "Report sintetico — Piano Free");

  cursor.text(`Digital Score: ${report.overallScore}/100 — ${scoreLabel(report.overallScore)}`, {
    size: 15,
    bold: true,
    color: scoreColor(report.overallScore),
    gap: 10,
  });
  cursor.divider();

  cursor.text("Sintesi", { size: 12, bold: true, gap: 4 });
  cursor.text(report.businessImpactSummary, { size: 10, color: INK_SOFT, gap: 12 });

  cursor.text("Punteggi principali", { size: 12, bold: true, gap: 6 });
  for (const c of report.categoryScores) {
    cursor.scoreBar(CATEGORY_LABELS[c.category], c.score);
  }
  cursor.y -= 4;

  if (report.issues.length > 0) {
    cursor.text("Problemi principali", { size: 12, bold: true, gap: 6 });
    for (const issue of report.issues) {
      cursor.text(`•  ${issue.title} (${SEVERITY_LABEL[issue.severity]})`, { size: 9.5, color: INK_SOFT, gap: 4 });
    }
    if ((report.hiddenIssueCount ?? 0) > 0) {
      cursor.text(`+ altri ${report.hiddenIssueCount} problemi rilevati, non mostrati in questo report.`, {
        size: 9,
        color: INK_SOFT,
        gap: 4,
      });
    }
    cursor.y -= 6;
  }

  cursor.divider();
  cursor.text("Report completo disponibile con DigitalCheck Pro.", {
    size: 10.5,
    bold: true,
    color: ACCENT,
    gap: 2,
  });
  cursor.text(
    "Analisi complete, PDF di almeno 5 pagine, Assistente AI, storico e Gestionale — a 6,99 €/mese.",
    { size: 9, color: INK_SOFT }
  );

  cursor.footer("DigitalCheck — powered by Imperium Digital — Report sintetico (piano Free)");
  return doc.save();
}

// ---------------------------------------------------------------------
// PDF Pro: struttura a piu' pagine (brief sezione 15).
// ---------------------------------------------------------------------
export async function generateProReportPdf(report: DigitalCheckReport): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const fontRegular = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const cursor = new PdfCursor(doc, page, fontRegular, fontBold);
  const footerNote = "DigitalCheck — powered by Imperium Digital — Website Analysis Report";

  // PAGINA 1 — Cover
  cursor.y -= 60;
  cursor.text("DigitalCheck", { size: 32, bold: true, color: ACCENT, gap: 0 });
  cursor.text("powered by Imperium Digital", { size: 10, color: INK_SOFT, gap: 40 });
  cursor.text("Website Analysis Report", { size: 20, bold: true, gap: 20 });
  cursor.text(report.requestedUrl, { size: 14, gap: 4 });
  cursor.text(`Data: ${new Date(report.generatedAt).toLocaleDateString("it-IT")} · ${report.pagesAnalyzed} pagine analizzate`, {
    size: 10,
    color: INK_SOFT,
    gap: 40,
  });
  cursor.ensureSpace(80);
  cursor.page.drawRectangle({ x: MARGIN, y: cursor.y - 70, width: 160, height: 70, color: ACCENT_SOFT });
  cursor.page.drawText(String(report.overallScore), {
    x: MARGIN + 16,
    y: cursor.y - 50,
    size: 34,
    font: fontBold,
    color: scoreColor(report.overallScore),
  });
  cursor.page.drawText(`/100 — ${scoreLabel(report.overallScore)}`, {
    x: MARGIN + 16,
    y: cursor.y - 64,
    size: 10,
    font: fontRegular,
    color: INK_SOFT,
  });
  cursor.y -= 90;
  cursor.footer(footerNote);

  // PAGINA 2 — Executive Summary
  cursor.newPage();
  cursor.sectionTitle("Executive Summary");
  cursor.text(report.businessImpactSummary, { size: 11, color: INK_SOFT, gap: 16 });

  if (report.strengths.length > 0) {
    cursor.text("Punti di forza", { size: 12, bold: true, gap: 6 });
    for (const s of report.strengths) cursor.text(`•  ${s}`, { size: 10, color: INK_SOFT, gap: 3 });
    cursor.y -= 8;
  }

  const highIssues = report.issues.filter((i) => i.severity === "high");
  if (highIssues.length > 0) {
    cursor.text("Principali criticita'", { size: 12, bold: true, gap: 6 });
    for (const i of highIssues.slice(0, 5)) cursor.text(`•  ${i.title}`, { size: 10, color: INK_SOFT, gap: 3 });
    cursor.y -= 8;
  }

  if (report.recommendedActions.length > 0) {
    cursor.text("Priorita' operative", { size: 12, bold: true, gap: 6 });
    report.recommendedActions.slice(0, 5).forEach((a, i) => cursor.text(`${i + 1}. ${a}`, { size: 10, color: INK_SOFT, gap: 3 }));
  }
  cursor.footer(footerNote);

  // PAGINA 3 — Performance
  cursor.newPage();
  cursor.sectionTitle("Performance");
  const perf = report.categoryScores.find((c) => c.category === "performance");
  if (perf) {
    cursor.scoreBar("Performance", perf.score, perf.notes);
    cursor.y -= 6;
  }
  const perfIssues = report.issues.filter((i) => i.category === "technical" || i.category === "ux");
  if (perfIssues.length > 0) {
    cursor.text("Problemi tecnici e raccomandazioni", { size: 12, bold: true, gap: 8 });
    for (const issue of perfIssues) issueBlock(cursor, issue);
  } else {
    cursor.text("Nessun problema tecnico rilevante individuato in questa categoria.", { size: 10, color: INK_SOFT });
  }
  cursor.footer(footerNote);

  // PAGINA 4 — SEO & Accessibility
  cursor.newPage();
  cursor.sectionTitle("SEO & Accessibility");
  const seo = report.categoryScores.find((c) => c.category === "seo");
  const accessibility = report.categoryScores.find((c) => c.category === "accessibility");
  if (seo) cursor.scoreBar("SEO", seo.score, seo.notes);
  if (accessibility) cursor.scoreBar("Accessibility", accessibility.score, accessibility.notes);
  cursor.y -= 6;
  const seoIssues = report.issues.filter((i) => i.category === "seo");
  if (seoIssues.length > 0) {
    cursor.text("Problemi SEO", { size: 12, bold: true, gap: 8 });
    for (const issue of seoIssues) issueBlock(cursor, issue);
  }
  if (report.aiAnalysis?.contentAnalysis) {
    cursor.text("Interpretazione AI — contenuti", { size: 11, bold: true, gap: 4 });
    cursor.text(report.aiAnalysis.contentAnalysis, { size: 10, color: INK_SOFT, gap: 10 });
  }
  cursor.footer(footerNote);

  // PAGINA 5 — Best Practices & Action Plan
  cursor.newPage();
  cursor.sectionTitle("Best Practices & Action Plan");
  const remainingCategories: CategoryKey[] = ["mobile", "conversion", "content"];
  for (const key of remainingCategories) {
    const c = report.categoryScores.find((cs) => cs.category === key);
    if (c) cursor.scoreBar(CATEGORY_LABELS[key], c.score, c.notes);
  }
  cursor.y -= 6;
  const otherIssues = report.issues.filter(
    (i) => !["technical", "ux", "seo"].includes(i.category)
  );
  if (otherIssues.length > 0) {
    cursor.text("Altre criticita'", { size: 12, bold: true, gap: 8 });
    for (const issue of otherIssues) issueBlock(cursor, issue);
  }

  if (report.aiAnalysis?.conversionAnalysis) {
    cursor.text("Interpretazione AI — conversione", { size: 11, bold: true, gap: 4 });
    cursor.text(report.aiAnalysis.conversionAnalysis, { size: 10, color: INK_SOFT, gap: 10 });
  }

  if (report.recommendedActions.length > 0) {
    cursor.text("Piano d'azione (in ordine di priorita')", { size: 12, bold: true, gap: 6 });
    report.recommendedActions.forEach((a, i) => cursor.text(`${i + 1}. ${a}`, { size: 10, color: INK_SOFT, gap: 4 }));
    cursor.y -= 6;
  }

  if (report.unverifiable.length > 0) {
    cursor.divider();
    cursor.text("Cosa non e' stato possibile verificare automaticamente", { size: 11, bold: true, gap: 4 });
    for (const u of report.unverifiable) cursor.text(`•  ${u}`, { size: 8.5, color: INK_SOFT, gap: 3 });
  }

  cursor.text("Conclusione", { size: 12, bold: true, gap: 4 });
  cursor.text(
    `Sulla base dei dati raccolti, ${report.requestedUrl} ottiene un punteggio complessivo di ${report.overallScore}/100 (${scoreLabel(
      report.overallScore
    )}). Il piano d'azione sopra indicato riporta gli interventi in ordine di priorita'.`,
    { size: 10, color: INK_SOFT }
  );
  cursor.footer(footerNote);

  return doc.save();
}

export async function generateReportPdf(report: DigitalCheckReport, plan: PlanType = "PRO"): Promise<Uint8Array> {
  return getPlanFeatures(plan).fullReports ? generateProReportPdf(report) : generateFreeReportPdf(report);
}
