import type { DigitalCheckReport } from "@/types";
import { STATUS_LABEL } from "@/lib/analysis/constants";
import { CATEGORY_LABELS } from "@/lib/category-labels";
import { callGemini } from "./gemini-client";

export interface AdvisorResult {
  answer: string | null;
  unavailableReason?: string;
}

// Contesto per l'assistente AI Pro (brief audit sezione 29: deve poter
// rispondere a "perche' ho 64 in Performance?", "quali sono i problemi
// SEO?", ecc.): fonte unica e' il sistema di audit multi-categoria
// (report.analyses), con findings/gravita' PER CATEGORIA, non piu' solo
// un elenco piatto dei primi 8 problemi complessivi.
function buildContext(report: DigitalCheckReport): string {
  const parts = [
    `Sito: ${report.requestedUrl}`,
    `Tipo di attivita': ${report.businessType}`,
    `Obiettivo dichiarato: ${report.goal}`,
    `DigitalCheck Score complessivo: ${report.overallScore}/100`,
    `Riepilogo esecutivo: ${report.businessImpactSummary}`,
  ];

  for (const a of report.analyses) {
    const topFindings = a.findings
      .slice(0, 6)
      .map((f) => `  - [${f.severity}] ${f.title}: ${f.explanation}`)
      .join("\n");
    parts.push(
      `${CATEGORY_LABELS[a.category]}: ${a.score}/100 (${STATUS_LABEL[a.status]}).${
        topFindings ? `\nProblemi rilevati in questa categoria:\n${topFindings}` : " Nessun problema rilevante rilevato."
      }`
    );
  }

  // GEO (brief GEO sezione 15): stessa fonte dati del report, mai un
  // contesto separato o inventato.
  if (report.geo) {
    const topGeoIssues = report.geo.issues
      .slice(0, 6)
      .map((i) => `  - [${i.severity}] ${i.title} (${i.category}): ${i.description}`)
      .join("\n");
    parts.push(
      `GEO (predisposizione ad essere compreso/citato da motori di ricerca generativi e AI answer engine): ${report.geo.overallScore}/100${
        report.geo.localApplicable ? "" : " (categoria Local GEO non applicabile a questo sito)"
      }.\nProblemi GEO rilevati:\n${topGeoIssues || "  (nessuno)"}`
    );
    if (report.geo.aiComparisonNote) parts.push(`Confronto SEO/GEO: ${report.geo.aiComparisonNote}`);
  }

  if (report.crossAnalysis.length > 0) {
    parts.push(
      `Correlazioni individuate tra categorie:\n${report.crossAnalysis.map((c) => `  - ${c.pairLabel}: ${c.note}`).join("\n")}`
    );
  }

  if (report.actionPlan.length > 0) {
    parts.push(
      `Piano d'azione prioritizzato (in ordine):\n${report.actionPlan
        .slice(0, 10)
        .map((i) => `  ${i.priority}. [${i.severity}] ${i.title} — ${i.action}`)
        .join("\n")}`
    );
  }

  return parts.join("\n");
}

export async function askAdvisor(
  question: string,
  report: DigitalCheckReport
): Promise<AdvisorResult> {
  const system = [
    "Sei l'assistente di DigitalCheck: aiuti il proprietario di una piccola attivita' a migliorare il proprio sito.",
    "Rispondi SOLO sulla base dei dati del sito forniti qui sotto: non inventare informazioni che non ti sono state date.",
    "Quando la domanda lo permette, non limitarti a un consiglio generico: scrivi il testo pronto da incollare (es. un title, una meta description, un testo alt), tra virgolette, cosi' l'utente puo' copiarlo direttamente.",
    "Rispondi in italiano, in modo diretto e pratico, in pochi paragrafi.",
  ].join(" ");

  const user = `Dati del sito:\n${buildContext(report)}\n\nDomanda dell'utente: ${question}`;

  const result = await callGemini(system, user, { timeoutMs: 25_000 });
  if (!result.text) {
    return { answer: null, unavailableReason: result.errorReason };
  }
  return { answer: result.text };
}
