import type { AnalysisResult, Finding } from "@/lib/analysis/types";
import { SEVERITY_LABEL, SEVERITY_ORDER, STATUS_LABEL } from "@/lib/analysis/constants";
import { CATEGORY_LABELS } from "@/lib/category-labels";
import { PdfCanvas, CONTENT_WIDTH, MARGIN } from "./canvas";
import { COLOR, SEVERITY5_COLOR, SEVERITY5_SOFT_COLOR, scoreColor } from "./theme";

/**
 * Pagina di dettaglio completo di UNA categoria per il PDF Pro (brief
 * audit sezioni 18-24): metodologia/score, sottopunteggi, punti di forza,
 * findings con gravita'/evidenza/spiegazione/impatto, raccomandazioni con
 * azione concreta. Generica su tutte le 7 categorie SEO-side — cosi' non
 * serve un file di disegno separato per ciascuna (brief sezione 46: niente
 * componenti duplicati per categoria). Il GEO ha una propria pagina
 * dedicata, non generata qui (src/lib/pdf/geo-section.ts, non toccata).
 */
export function drawCategoryReportPage(canvas: PdfCanvas, result: AnalysisResult) {
  canvas.sectionTitle(`${CATEGORY_LABELS[result.category]} Report`, {
    subtitle: result.shortSummary,
  });

  // ---- Score + stato ----------------------------------------------------
  const scoreTop = canvas.y;
  const gaugeRadius = 32;
  const gaugeCx = MARGIN + gaugeRadius + 4;
  const gaugeCy = scoreTop - gaugeRadius - 4;
  canvas.scoreGauge({ cx: gaugeCx, cy: gaugeCy, radius: gaugeRadius, thickness: 7, score: result.score, scoreSize: 20 });
  const statusLabel = STATUS_LABEL[result.status];
  const statusWidth = canvas.fontBold.widthOfTextAtSize(statusLabel, 10);
  canvas.page.drawText(statusLabel, {
    x: gaugeCx - statusWidth / 2,
    y: gaugeCy - gaugeRadius - 14,
    size: 10,
    font: canvas.fontBold,
    color: scoreColor(result.score),
  });

  // ---- Sottopunteggi (griglia compatta) ----------------------------------
  const subX = gaugeCx + gaugeRadius + 24;
  const subWidth = CONTENT_WIDTH - (subX - MARGIN);
  canvas.y = scoreTop;
  if (result.subScores.length > 0) {
    const rowH = 16;
    for (const s of result.subScores) {
      // Guardia esplicita: senza, un numero elevato di sottopunteggi (una
      // categoria futura con piu' di ~6 sottopunteggi) potrebbe disegnare
      // testo con y negativo, invisibile fuori pagina invece di andare a
      // capo (stessa classe di bug gia' trovata sul PDF Free del GEO).
      canvas.ensureSpace(rowH);
      canvas.page.drawText(s.label, { x: subX, y: canvas.y - 11, size: 9, font: canvas.fontRegular, color: COLOR.inkSoft });
      const valueLabel = s.dataAvailability === "unavailable" ? "N/D" : s.dataAvailability === "not_applicable" ? "N/A" : String(s.score);
      const valueWidth = canvas.fontBold.widthOfTextAtSize(valueLabel, 9.5);
      canvas.page.drawText(valueLabel, {
        x: MARGIN + CONTENT_WIDTH - valueWidth,
        y: canvas.y - 11,
        size: 9.5,
        font: canvas.fontBold,
        color: s.dataAvailability === "unavailable" ? COLOR.inkSoft : scoreColor(s.score),
      });
      canvas.y -= rowH;
    }
  }
  if (result.notes) {
    canvas.text(result.notes, { size: 8, color: COLOR.inkSoft, x: subX, maxWidth: subWidth, maxLines: 2, gap: 0, lineHeightMult: 1.3 });
  }

  canvas.y = Math.min(canvas.y, gaugeCy - gaugeRadius - 14 - 16);
  canvas.y -= 14;

  if (result.strengths.length > 0) {
    canvas.divider();
    const headingH = canvas.measure("Punti di forza", { size: 11, font: "bold", gap: 5 });
    canvas.ensureSpace(headingH + 16);
    canvas.text("Punti di forza", { size: 11, font: "bold", color: COLOR.ink, gap: 5 });
    for (const s of result.strengths) canvas.hangingLine("+", s, { size: 9, glyphColor: COLOR.accent, gap: 3, maxLines: 2 });
    canvas.y -= 4;
  }

  canvas.divider();

  // ---- Findings -----------------------------------------------------------
  const sortedFindings = [...result.findings].sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
  if (sortedFindings.length === 0) {
    canvas.text("Nessun problema rilevante individuato in questa categoria.", { size: 10, color: COLOR.inkSoft, gap: 12 });
  } else {
    canvas.kicker("Problemi rilevati");
    for (const f of sortedFindings) drawFindingCard(canvas, f);
    canvas.y -= 2;
  }

  if (result.recommendations.length > 0) {
    canvas.divider();
    const headingH = canvas.measure("Raccomandazioni", { size: 11.5, font: "bold", gap: 6 });
    canvas.ensureSpace(headingH + 20);
    canvas.text("Raccomandazioni", { size: 11.5, font: "bold", color: COLOR.ink, gap: 6 });
    for (const r of result.recommendations) {
      canvas.hangingLine(">", `${r.title}: ${r.action}`, { size: 9, color: COLOR.ink, glyphColor: SEVERITY5_COLOR[r.severity], gap: 4, maxLines: 2 });
    }
  }
}

function findingCardHeight(canvas: PdfCanvas, f: Finding): number {
  const padding = 12;
  const innerWidth = CONTENT_WIDTH - padding * 2;
  const titleH = 15;
  const explH = canvas.measure(f.explanation, { size: 9, maxWidth: innerWidth, lineHeightMult: 1.3, gap: 6 });
  const impactH = 12;
  return padding * 2 + titleH + explH + impactH;
}

function drawFindingCard(canvas: PdfCanvas, f: Finding) {
  const padding = 12;
  const titleH = 15;
  const innerWidth = CONTENT_WIDTH - padding * 2;
  const cardHeight = findingCardHeight(canvas, f);

  canvas.ensureSpace(cardHeight + 8);
  const top = canvas.y;
  canvas.roundedRect(MARGIN, top - cardHeight, CONTENT_WIDTH, cardHeight, { radius: 9, fill: COLOR.white, border: COLOR.line, borderWidth: 0.75 });
  canvas.roundedRect(MARGIN, top - cardHeight, 4, cardHeight, { radius: 2, fill: SEVERITY5_COLOR[f.severity] });

  canvas.y = top - padding;
  const pillW = canvas.pill(MARGIN + padding, canvas.y, SEVERITY_LABEL[f.severity], SEVERITY5_COLOR[f.severity], SEVERITY5_SOFT_COLOR[f.severity]);
  const titleWidth = innerWidth - pillW - 8;
  canvas.page.drawText(canvas.fitOneLine(f.title, canvas.fontBold, 10.5, titleWidth), {
    x: MARGIN + padding + pillW + 8,
    y: canvas.y - 11,
    size: 10.5,
    font: canvas.fontBold,
    color: COLOR.ink,
  });
  canvas.y = top - padding - titleH - 6;

  canvas.text(f.explanation, { size: 9, color: COLOR.inkSoft, x: MARGIN + padding, maxWidth: innerWidth, gap: 6, lineHeightMult: 1.3 });

  const evidenceOrImpact = f.evidence ? `Evidenza: ${f.evidence}` : `Impatto: ${f.impact}`;
  canvas.page.drawText(canvas.fitOneLine(evidenceOrImpact, canvas.fontRegular, 8, innerWidth), {
    x: MARGIN + padding,
    y: top - cardHeight + padding - 4,
    size: 8,
    font: canvas.fontRegular,
    color: COLOR.inkSoft,
  });

  canvas.y = top - cardHeight - 8;
}
