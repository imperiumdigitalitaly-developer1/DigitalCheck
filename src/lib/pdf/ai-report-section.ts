import type { DigitalCheckReport } from "@/types";
import { PdfCanvas } from "./canvas";
import { COLOR } from "./theme";

/**
 * AI Report — pagina dedicata all'interpretazione AI dell'intero audit
 * (redesign PDF, sezione 19): non una ripetizione delle pagine precedenti,
 * ma una sintesi consulenziale. Executive Interpretation / Main Strengths /
 * Main Weaknesses / Strategic Priorities / Quick Wins / Strategic
 * Improvements. Il Final Assessment (settimo punto del brief) vive nella
 * pagina di chiusura del report (drawFinalPage in report-pdf.ts): la
 * "valutazione finale" e' letteralmente l'ultima cosa del documento,
 * cosi' non si ripete lo stesso testo due volte di seguito (brief
 * sezione 22).
 *
 * Se l'interpretazione AI non e' disponibile per questo scan (brief
 * sezione 20), non si mostra MAI il dettaglio tecnico dell'errore: solo
 * un messaggio elegante e generico. I punti di forza/le aree da
 * migliorare restano comunque visibili perche' derivano da dati
 * deterministici (report.strengths/report.actionPlan), non dall'AI.
 */
export function drawAiReportPage(canvas: PdfCanvas, report: DigitalCheckReport) {
  canvas.sectionTitle("AI Report", { subtitle: "Interpretazione dei dati raccolti durante l'audit, basata solo sui risultati calcolati sopra." });

  if (!report.aiInsightsAvailable) {
    // Mai il dettaglio del provider (status, corpo della risposta) qui:
    // solo una frase neutra, indipendentemente dal motivo del fallimento
    // (quota, sovraccarico, timeout...) — vedi src/lib/ai/errors.ts.
    canvas.calloutBox(
      "Analisi AI — Non incluso in questa versione del report",
      "Approfondimento AI non incluso in questa versione del report: le indicazioni si basano sui controlli tecnici automatici. I punteggi e le verifiche nelle pagine precedenti restano validi e disponibili.",
      { fill: COLOR.paper, kickerColor: COLOR.ink, maxLines: 3 }
    );
    canvas.y -= 6;
  }

  const interpretation = report.aiInsights?.executiveInterpretation || report.businessImpactSummary;
  canvas.kicker("Interpretazione Esecutiva");
  canvas.text(interpretation, { size: 9.5, color: COLOR.ink, maxLines: 5, lineHeightMult: 1.4, gap: 14 });
  canvas.divider();

  const strengths = report.aiInsights?.mainStrengths ?? report.strengths;
  if (strengths.length > 0) {
    const headingH = canvas.measure("Punti di Forza Principali", { size: 11.5, font: "bold", gap: 6 });
    canvas.ensureSpace(headingH + 16);
    canvas.kicker("Punti di Forza Principali");
    for (const s of strengths) canvas.hangingLine("+", s, { size: 9.5, glyphColor: COLOR.accent, gap: 5, maxLines: 2, lineHeightMult: 1.3 });
    canvas.y -= 4;
  }

  const weaknesses = report.aiInsights?.mainWeaknesses ?? Array.from(new Set(report.actionPlan.slice(0, 6).map((i) => i.title)));
  if (weaknesses.length > 0) {
    canvas.divider();
    const headingH = canvas.measure("Aree da Migliorare", { size: 11.5, font: "bold", gap: 6 });
    canvas.ensureSpace(headingH + 16);
    canvas.kicker("Aree da Migliorare");
    for (const w of weaknesses) canvas.hangingLine("-", w, { size: 9.5, gap: 5, maxLines: 2, lineHeightMult: 1.3 });
    canvas.y -= 4;
  }

  const priorities = report.aiInsights?.strategicPriorities ?? report.recommendedActions;
  if (priorities.length > 0) {
    canvas.divider();
    const headingH = canvas.measure("Priorita' Strategiche", { size: 11.5, font: "bold", gap: 6 });
    canvas.ensureSpace(headingH + 16);
    canvas.kicker("Priorita' Strategiche");
    priorities.forEach((p, i) => canvas.hangingLine(`${i + 1}.`, p, { size: 9.5, color: COLOR.ink, gap: 5, maxLines: 2, lineHeightMult: 1.3 }));
    canvas.y -= 4;
  }

  // Quick Wins / Strategic Improvements: SOLO se l'AI li ha effettivamente
  // distinti (brief sezione 19 + 20: mai un "effort" inventato quando non
  // c'e' una base dati sufficiente per giudicarlo).
  const quickWins = report.aiInsights?.quickWins ?? [];
  const strategicImprovements = report.aiInsights?.strategicImprovements ?? [];

  if (quickWins.length > 0) {
    canvas.divider();
    const headingH = canvas.measure("Interventi Rapidi", { size: 11.5, font: "bold", gap: 4 });
    canvas.ensureSpace(headingH + 24);
    canvas.kicker("Interventi Rapidi");
    canvas.text("Interventi relativamente semplici che possono migliorare rapidamente alcune aree.", { size: 8.5, color: COLOR.inkSoft, gap: 8 });
    for (const q of quickWins) canvas.hangingLine(">", q, { size: 9.5, glyphColor: COLOR.accent, gap: 5, maxLines: 2, lineHeightMult: 1.3 });
    canvas.y -= 4;
  }

  if (strategicImprovements.length > 0) {
    canvas.divider();
    const headingH = canvas.measure("Interventi Strategici", { size: 11.5, font: "bold", gap: 4 });
    canvas.ensureSpace(headingH + 24);
    canvas.kicker("Interventi Strategici");
    canvas.text("Interventi piu' strutturali, con un impatto piu' ampio ma un respiro piu' lungo.", { size: 8.5, color: COLOR.inkSoft, gap: 8 });
    for (const s of strategicImprovements) canvas.hangingLine(">", s, { size: 9.5, gap: 5, maxLines: 2, lineHeightMult: 1.3 });
  }
}
