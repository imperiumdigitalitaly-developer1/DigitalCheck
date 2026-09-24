import type { CrossAnalysisInsight } from "@/lib/analysis/cross-analysis";
import { PdfCanvas, CONTENT_WIDTH, MARGIN } from "./canvas";
import { COLOR } from "./theme";

// Cross-Analysis (brief audit sezione 26): correlazioni tra categorie,
// generate SOLO quando supportate dai dati (src/lib/analysis/cross-
// analysis.ts) — questa pagina si limita a disegnarle, mai a inventarne.
export function drawCrossAnalysisPage(canvas: PdfCanvas, insights: CrossAnalysisInsight[]) {
  canvas.sectionTitle("Cross-Analysis", {
    subtitle: "Correlazioni tra aree diverse del sito, individuate quando i dati le supportano.",
  });

  if (insights.length === 0) {
    canvas.text(
      "Non sono state individuate correlazioni rilevanti tra le categorie in questa analisi: le aree misurate non condividono criticita' sufficientemente marcate da giustificare una correlazione.",
      { size: 10, color: COLOR.inkSoft, maxLines: 3 }
    );
    return;
  }

  for (const insight of insights) {
    const padding = 14;
    const innerWidth = CONTENT_WIDTH - padding * 2;
    const titleH = 16;
    const noteH = canvas.measure(insight.note, { size: 9.5, maxWidth: innerWidth, lineHeightMult: 1.35, gap: 0 });
    const cardHeight = padding * 2 + titleH + noteH;

    canvas.ensureSpace(cardHeight + 10);
    const top = canvas.y;
    canvas.roundedRect(MARGIN, top - cardHeight, CONTENT_WIDTH, cardHeight, { radius: 10, fill: COLOR.white, border: COLOR.line, borderWidth: 0.75 });
    canvas.y = top - padding;
    canvas.page.drawText(insight.pairLabel, { x: MARGIN + padding, y: canvas.y - 11, size: 11, font: canvas.fontBold, color: COLOR.accent });
    canvas.y = top - padding - titleH - 4;
    canvas.text(insight.note, { size: 9.5, color: COLOR.ink, x: MARGIN + padding, maxWidth: innerWidth, gap: 0, lineHeightMult: 1.35 });
    canvas.y = top - cardHeight - 10;
  }
}
