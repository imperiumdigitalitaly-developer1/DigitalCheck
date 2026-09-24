import type { DigitalCheckReport } from "@/types";
import { callGemini } from "./gemini-client";

export interface AdvisorResult {
  answer: string | null;
  unavailableReason?: string;
}

function buildContext(report: DigitalCheckReport): string {
  const topIssues = report.issues
    .slice(0, 8)
    .map((i) => `- [${i.severity}] ${i.title}: ${i.description}`)
    .join("\n");

  const parts = [
    `Sito: ${report.requestedUrl}`,
    `Tipo di attivita': ${report.businessType}`,
    `Obiettivo dichiarato: ${report.goal}`,
    `Digital Score (SEO/tecnico): ${report.overallScore}/100`,
    `Riepilogo: ${report.businessImpactSummary}`,
    `Problemi rilevati nell'ultima scansione:\n${topIssues}`,
  ];

  // GEO (brief GEO sezione 15): stessa fonte dati del report, mai un
  // contesto separato o inventato.
  if (report.geo) {
    const topGeoIssues = report.geo.issues
      .slice(0, 6)
      .map((i) => `- [${i.severity}] ${i.title} (${i.category}): ${i.description}`)
      .join("\n");
    parts.push(
      `GEO Score (predisposizione ad essere compreso/citato da motori di ricerca generativi e AI answer engine): ${report.geo.overallScore}/100${
        report.geo.localApplicable ? "" : " (categoria Local GEO non applicabile a questo sito)"
      }`,
      `Problemi GEO rilevati:\n${topGeoIssues || "(nessuno)"}`
    );
    if (report.geo.aiComparisonNote) parts.push(`Confronto SEO/GEO: ${report.geo.aiComparisonNote}`);
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
