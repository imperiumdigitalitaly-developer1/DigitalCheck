import type { ActionPlanItem } from "@/lib/analysis/action-plan";
import { SEVERITY_LABEL } from "@/lib/analysis/constants";
import { CATEGORY_LABELS } from "@/lib/category-labels";
import type { CategoryKey } from "@/types";
import { PdfCanvas, CONTENT_WIDTH, MARGIN } from "./canvas";
import { COLOR, SEVERITY5_COLOR } from "./theme";

function categoryLabel(category: CategoryKey | "geo"): string {
  if (category === "geo") return "GEO";
  return CATEGORY_LABELS[category];
}

// DigitalCheck Priority Action Plan (brief audit sezione 18/27): ordinato
// per gravita' gia' assegnata dai motori di categoria (src/lib/analysis/
// action-plan.ts) — mai un ordine deciso qui. Struttura per card:
// Priorita'/Categoria/Gravita'/Problema/Perche'/Azione/Impatto atteso.
// Niente campo "Effort": non e' deducibile in modo affidabile dai dati
// disponibili, quindi non va inventato (brief, sezione 18).
export function drawActionPlanPage(canvas: PdfCanvas, items: ActionPlanItem[]) {
  canvas.sectionTitle("DigitalCheck — Piano d'Azione Prioritario", {
    subtitle: "Gli interventi consigliati su tutte le categorie, in ordine di priorita'.",
  });

  if (items.length === 0) {
    canvas.calloutBox(
      "Nessuna azione prioritaria",
      "Non sono state rilevate azioni prioritarie in questa analisi: i punteggi delle categorie non evidenziano criticita' che richiedano un intervento immediato.",
      { maxLines: 2 }
    );
    return;
  }

  for (const item of items) {
    const padding = 12;
    const badgeW = 24;
    const innerX = MARGIN + padding + badgeW;
    const innerWidth = CONTENT_WIDTH - padding * 2 - badgeW;
    const titleH = 14;
    const metaH = 26;
    const whyH = canvas.measure(`Perche' intervenire: ${item.why}`, { size: 8.5, maxWidth: innerWidth - 8, lineHeightMult: 1.3, gap: 4 });
    const actionH = canvas.measure(`Azione consigliata: ${item.action}`, { size: 8.5, maxWidth: innerWidth - 8, lineHeightMult: 1.3, gap: item.impact ? 4 : 0 });
    const impactH = item.impact
      ? canvas.measure(`Impatto atteso: ${item.impact}`, { size: 8.5, maxWidth: innerWidth - 8, lineHeightMult: 1.3, gap: 0 })
      : 0;
    const cardHeight = padding * 2 + titleH + 4 + metaH + 6 + whyH + actionH + impactH;

    canvas.ensureSpace(cardHeight + 8);
    const top = canvas.y;
    canvas.roundedRect(MARGIN, top - cardHeight, CONTENT_WIDTH, cardHeight, { radius: 8, fill: COLOR.white, border: COLOR.line, borderWidth: 0.75 });

    canvas.roundedRect(MARGIN + padding, top - padding - 16, badgeW, 16, { radius: 4, fill: SEVERITY5_COLOR[item.severity] });
    const numLabel = String(item.priority).padStart(2, "0");
    const numWidth = canvas.fontBold.widthOfTextAtSize(numLabel, 9);
    canvas.page.drawText(numLabel, { x: MARGIN + padding + (badgeW - numWidth) / 2, y: top - padding - 12, size: 9, font: canvas.fontBold, color: COLOR.white });

    canvas.page.drawText(canvas.fitOneLine(item.title, canvas.fontBold, 10.5, innerWidth - 8), {
      x: innerX + 8,
      y: top - padding - 11,
      size: 10.5,
      font: canvas.fontBold,
      color: COLOR.ink,
    });

    canvas.y = top - padding - titleH - 2;
    const sevBadgeW = canvas.severityBadge(innerX + 8, canvas.y, SEVERITY_LABEL[item.severity], SEVERITY5_COLOR[item.severity]);
    canvas.page.drawText(`Categoria: ${categoryLabel(item.category)}`, {
      x: innerX + 8 + sevBadgeW + 8,
      y: canvas.y - 12,
      size: 8.5,
      font: canvas.fontRegular,
      color: COLOR.inkSoft,
    });
    canvas.y -= metaH;

    canvas.text(`Perche' intervenire: ${item.why}`, { size: 8.5, color: COLOR.inkSoft, x: innerX + 8, maxWidth: innerWidth - 8, gap: 4, lineHeightMult: 1.3 });
    canvas.text(`Azione consigliata: ${item.action}`, {
      size: 8.5,
      color: COLOR.ink,
      x: innerX + 8,
      maxWidth: innerWidth - 8,
      gap: item.impact ? 4 : 0,
      lineHeightMult: 1.3,
    });
    if (item.impact) {
      canvas.text(`Impatto atteso: ${item.impact}`, { size: 8.5, color: COLOR.accent, x: innerX + 8, maxWidth: innerWidth - 8, gap: 0, lineHeightMult: 1.3 });
    }

    canvas.y = top - cardHeight - 8;
  }
}
