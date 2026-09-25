import type { CrossAnalysisInsight } from "@/lib/analysis/cross-analysis";
import { PdfCanvas, CONTENT_WIDTH, MARGIN } from "./canvas";
import { COLOR, CATEGORY_MONOGRAM } from "./theme";

// Due monogrammi per card (redesign PDF, sezione 17): le coppie GEO nel
// motore di cross-analysis (src/lib/analysis/cross-analysis.ts) portano un
// solo CategoryKey in insight.categories perche' "geo" non fa parte di
// quel tipo — il secondo monogramma si aggiunge qui solo quando
// pairLabel lo dichiara esplicitamente, mai una correlazione o
// un'etichetta dedotta.
function monogramsForInsight(insight: CrossAnalysisInsight): string[] {
  const codes = insight.categories.map((c) => CATEGORY_MONOGRAM[c]);
  if (insight.pairLabel.includes("GEO")) codes.push(CATEGORY_MONOGRAM.geo);
  return codes;
}

// Cross-Analysis (brief audit sezione 26): correlazioni tra categorie,
// generate SOLO quando supportate dai dati (src/lib/analysis/cross-
// analysis.ts) — questa pagina si limita a disegnarle, mai a inventarne.
// Se non ce ne sono, uno stato onesto e compatto (calloutBox), mai una
// pagina quasi vuota (brief, sezione 17).
export function drawCrossAnalysisPage(canvas: PdfCanvas, insights: CrossAnalysisInsight[]) {
  canvas.sectionTitle("Cross-Analysis", {
    subtitle: "Correlazioni tra aree diverse del sito, individuate quando i dati le supportano.",
  });

  if (insights.length === 0) {
    canvas.calloutBox(
      "Nessuna correlazione significativa rilevata",
      "Le categorie analizzate in questa scansione non condividono criticita' sufficientemente marcate da giustificare una correlazione tra loro. Questo e' un buon segnale: non indica un'assenza di analisi, ma l'assenza di un pattern trasversale.",
      { maxLines: 3 }
    );
    return;
  }

  for (const insight of insights) {
    const padding = 14;
    const monoSize = 22;
    const monograms = monogramsForInsight(insight);
    const monoBlockWidth = monograms.length * monoSize + (monograms.length - 1) * 6;
    const innerWidth = CONTENT_WIDTH - padding * 2;
    const headerH = monoSize;
    const noteH = canvas.measure(insight.note, { size: 9.5, maxWidth: innerWidth, lineHeightMult: 1.35, gap: 0 });
    const cardHeight = padding * 2 + headerH + 8 + noteH;

    canvas.ensureSpace(cardHeight + 10);
    const top = canvas.y;
    canvas.roundedRect(MARGIN, top - cardHeight, CONTENT_WIDTH, cardHeight, { radius: 10, fill: COLOR.white, border: COLOR.line, borderWidth: 0.75 });

    let badgeX = MARGIN + padding;
    for (const code of monograms) {
      canvas.monogramBadge(badgeX, top - padding, code, { size: monoSize });
      badgeX += monoSize + 6;
    }
    canvas.page.drawText(insight.pairLabel, {
      x: badgeX + 6,
      y: top - padding - monoSize / 2 - 4,
      size: 11,
      font: canvas.fontBold,
      color: COLOR.accent,
    });

    canvas.y = top - padding - headerH - 8;
    canvas.text(insight.note, { size: 9.5, color: COLOR.ink, x: MARGIN + padding, maxWidth: innerWidth, gap: 0, lineHeightMult: 1.35 });
    canvas.y = top - cardHeight - 10;
  }
}
