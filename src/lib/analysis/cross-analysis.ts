import type { CategoryKey } from "@/types";
import type { AnalysisResult } from "./types";

// Cross-Analysis (brief audit sezione 26): correlazioni tra coppie di
// categorie, generate SOLO quando supportate dai risultati effettivi (mai
// una correlazione di riempimento). Le 7 coppie sono quelle elencate
// esplicitamente nel brief. La soglia (< 60, "needs_improvement" o
// peggio) e' la stessa usata da scoreToStatus per la fascia "da
// migliorare" — coerente con il resto del sistema di stato centralizzato.
const THRESHOLD = 60;

export interface CrossAnalysisInsight {
  pairLabel: string;
  categories: CategoryKey[];
  note: string;
}

function scoreOf(analyses: AnalysisResult[], category: CategoryKey): number | null {
  return analyses.find((a) => a.category === category)?.score ?? null;
}

export function computeCrossAnalysis(analyses: AnalysisResult[], geoScore: number | null): CrossAnalysisInsight[] {
  const insights: CrossAnalysisInsight[] = [];
  const seo = scoreOf(analyses, "seo");
  const performance = scoreOf(analyses, "performance");
  const mobile = scoreOf(analyses, "mobile");
  const content = scoreOf(analyses, "content");
  const conversion = scoreOf(analyses, "conversion");
  const accessibility = scoreOf(analyses, "accessibility");
  const technical = scoreOf(analyses, "technical");

  if (seo != null && content != null && seo < THRESHOLD && content < THRESHOLD) {
    insights.push({
      pairLabel: "SEO + Content",
      categories: ["seo", "content"],
      note: "Una struttura dei contenuti poco chiara o incompleta limita sia la SEO (titoli, metadati e segnali tematici deboli) sia la qualita' percepita dal visitatore: intervenire sui contenuti migliora entrambe le aree insieme.",
    });
  }

  if (performance != null && mobile != null && performance < THRESHOLD && mobile < THRESHOLD) {
    insights.push({
      pairLabel: "Performance + Mobile",
      categories: ["performance", "mobile"],
      note: "Le prestazioni di caricamento deboli pesano in modo particolare su mobile, dove connessioni piu' lente e dispositivi meno potenti amplificano l'effetto di ogni ritardo.",
    });
  }

  if (content != null && geoScore != null && content < THRESHOLD && geoScore < THRESHOLD) {
    insights.push({
      pairLabel: "Content + GEO",
      categories: ["content"],
      note: "Una struttura dei contenuti poco chiara influenza sia la comprensione SEO sia la capacita' del sito di fornire risposte informative complete a un sistema di ricerca generativo o AI answer engine.",
    });
  }

  if (seo != null && geoScore != null && seo < THRESHOLD && geoScore < THRESHOLD) {
    insights.push({
      pairLabel: "SEO + GEO",
      categories: ["seo"],
      note: "Le stesse lacune tecniche e di metadati che limitano la SEO tradizionale (titoli, dati strutturati, indicizzabilita') riducono anche la predisposizione del sito a essere compreso da motori di ricerca generativi.",
    });
  }

  if (conversion != null && content != null && conversion < THRESHOLD && content < THRESHOLD) {
    insights.push({
      pairLabel: "Conversion + Content",
      categories: ["conversion", "content"],
      note: "Un contenuto che non comunica in modo chiaro l'offerta rende anche piu' debole la proposta di valore e gli elementi che dovrebbero guidare il visitatore verso un'azione.",
    });
  }

  if (accessibility != null && mobile != null && accessibility < THRESHOLD && mobile < THRESHOLD) {
    insights.push({
      pairLabel: "Accessibility + Mobile",
      categories: ["accessibility", "mobile"],
      note: "Le lacune di accessibilita' rilevate (struttura semantica, moduli, testo alternativo) tendono a pesare di piu' su schermi piccoli, dove lo spazio per correggere l'esperienza in autonomia e' minore.",
    });
  }

  if (technical != null && performance != null && technical < THRESHOLD && performance < THRESHOLD) {
    insights.push({
      pairLabel: "Technical + Performance",
      categories: ["technical", "performance"],
      note: "Aspetti tecnici di base deboli (configurazione HTTP, header, affidabilita' delle risorse) sono spesso concausa di prestazioni di caricamento reali sotto la soglia.",
    });
  }

  return insights;
}
