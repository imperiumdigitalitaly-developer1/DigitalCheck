import { rgb } from "pdf-lib";
import type { IssueCategory, IssueSeverity } from "@/types";
import type { GeoIssueSeverity } from "@/lib/geo/geo-types";
import type { Severity } from "@/lib/analysis/types";

/**
 * Palette del PDF: stessi valori esadecimali di tailwind.config.js, cosi'
 * il report resta visivamente coerente con il prodotto web (brief,
 * sezione 8). Non introdurre nuovi colori qui senza aggiornarli anche la'.
 */
export const COLOR = {
  ink: rgb(0x14 / 255, 0x17 / 255, 0x1c / 255),
  inkSoft: rgb(0x3a / 255, 0x3f / 255, 0x47 / 255),
  paper: rgb(0xf7 / 255, 0xf5 / 255, 0xf1 / 255),
  line: rgb(0xe3 / 255, 0xe0 / 255, 0xd8 / 255),
  accent: rgb(0x1f / 255, 0x6f / 255, 0x64 / 255),
  accentSoft: rgb(0xe4 / 255, 0xef / 255, 0xec / 255),
  accentDeep: rgb(0x12 / 255, 0x3f / 255, 0x38 / 255),
  white: rgb(1, 1, 1),
} as const;

export const SEVERITY_COLOR: Record<IssueSeverity, ReturnType<typeof rgb>> = {
  high: rgb(0xb4 / 255, 0x48 / 255, 0x3f / 255),
  medium: rgb(0xc9 / 255, 0x7a / 255, 0x3d / 255),
  low: rgb(0x3f / 255, 0x7d / 255, 0x8f / 255),
};

export const SEVERITY_SOFT_COLOR: Record<IssueSeverity, ReturnType<typeof rgb>> = {
  high: rgb(0xf6 / 255, 0xe8 / 255, 0xe6 / 255),
  medium: rgb(0xf8 / 255, 0xed / 255, 0xe0 / 255),
  low: rgb(0xe6 / 255, 0xef / 255, 0xf1 / 255),
};

// Solo 3 livelli reali di severita' (vedi types/index.ts): niente quarto
// livello "opportunita'" fittizio, per non inventare una distinzione che
// il motore di scoring non produce.
export const SEVERITY_LABEL: Record<IssueSeverity, string> = {
  high: "Critico",
  medium: "Alto",
  low: "Basso",
};

// 4 livelli per gli issue GEO (brief GEO sezione 16: Critical/High/Medium/
// Low). "low" usa un grigio neutro invece del blu di SEVERITY_COLOR.low,
// per restare distinguibile dai 3 livelli SEO quando le due liste
// compaiono nella stessa pagina (brief GEO sezione 22, pagina combinata).
export const GEO_SEVERITY_COLOR: Record<GeoIssueSeverity, ReturnType<typeof rgb>> = {
  critical: rgb(0xb4 / 255, 0x48 / 255, 0x3f / 255),
  high: rgb(0xc9 / 255, 0x7a / 255, 0x3d / 255),
  medium: rgb(0x3f / 255, 0x7d / 255, 0x8f / 255),
  low: rgb(0x6b / 255, 0x6f / 255, 0x76 / 255),
};

export const GEO_SEVERITY_SOFT_COLOR: Record<GeoIssueSeverity, ReturnType<typeof rgb>> = {
  critical: rgb(0xf6 / 255, 0xe8 / 255, 0xe6 / 255),
  high: rgb(0xf8 / 255, 0xed / 255, 0xe0 / 255),
  medium: rgb(0xe6 / 255, 0xef / 255, 0xf1 / 255),
  low: rgb(0xea / 255, 0xea / 255, 0xeb / 255),
};

export const GEO_SEVERITY_LABEL: Record<GeoIssueSeverity, string> = {
  critical: "Critico",
  high: "Alto",
  medium: "Medio",
  low: "Basso",
};

// 5 livelli (brief audit sezione 41, Finding/Recommendation del sistema di
// audit multi-categoria — src/lib/analysis/types.ts): riusa la stessa
// palette del GEO per i 4 livelli in comune, aggiunge solo "info" (grigio
// piu' neutro del "low"), cosi' il PDF Pro non introduce un terzo
// linguaggio visivo di severita' oltre a SEO (3 livelli, legacy) e GEO.
export const SEVERITY5_COLOR: Record<Severity, ReturnType<typeof rgb>> = {
  critical: GEO_SEVERITY_COLOR.critical,
  high: GEO_SEVERITY_COLOR.high,
  medium: GEO_SEVERITY_COLOR.medium,
  low: GEO_SEVERITY_COLOR.low,
  info: rgb(0x9a / 255, 0x9d / 255, 0xa3 / 255),
};

export const SEVERITY5_SOFT_COLOR: Record<Severity, ReturnType<typeof rgb>> = {
  critical: GEO_SEVERITY_SOFT_COLOR.critical,
  high: GEO_SEVERITY_SOFT_COLOR.high,
  medium: GEO_SEVERITY_SOFT_COLOR.medium,
  low: GEO_SEVERITY_SOFT_COLOR.low,
  info: rgb(0xf0 / 255, 0xf0 / 255, 0xf1 / 255),
};

const SCORE_STOPS: { max: number; color: ReturnType<typeof rgb> }[] = [
  { max: 40, color: rgb(0xb4 / 255, 0x48 / 255, 0x3f / 255) },
  { max: 60, color: rgb(0xc9 / 255, 0x7a / 255, 0x3d / 255) },
  { max: 75, color: rgb(0x3f / 255, 0x7d / 255, 0x8f / 255) },
  { max: 90, color: rgb(0x1f / 255, 0x6f / 255, 0x64 / 255) },
  { max: 101, color: rgb(0x2f / 255, 0x7a / 255, 0x4f / 255) },
];

export function scoreColor(score: number): ReturnType<typeof rgb> {
  const stop = SCORE_STOPS.find((s) => score < s.max) ?? SCORE_STOPS[SCORE_STOPS.length - 1];
  return (stop as (typeof SCORE_STOPS)[number]).color;
}

// Raggruppa le 5 categorie di ScanIssue (IssueCategory) in etichette
// leggibili dal cliente per la pagina "Problemi e diagnosi" e per
// l'Action Plan. L'ordine qui definisce anche l'ordine di stampa.
export const ISSUE_GROUP_ORDER: IssueCategory[] = ["seo", "technical", "ux", "conversion", "content"];

export const ISSUE_GROUP_LABEL: Record<IssueCategory, string> = {
  seo: "SEO",
  technical: "Performance & aspetti tecnici",
  ux: "Accessibilita'",
  conversion: "Conversione",
  content: "Contenuti",
};

// Etichetta di "impatto potenziale" / "obiettivo": descrive l'area che
// migliora risolvendo il problema, non un dato misurato — non e' un
// numero, non e' una promessa di risultato (brief, sezioni 3 e 17).
export const ISSUE_IMPACT_LABEL: Record<IssueCategory, string> = {
  seo: "Visibilita' sui motori di ricerca",
  technical: "Affidabilita' tecnica del sito",
  ux: "Accessibilita' ed esperienza d'uso",
  conversion: "Capacita' del sito di generare contatti/prenotazioni",
  content: "Qualita' percepita dei contenuti",
};

export const ISSUE_GOAL_LABEL: Record<IssueCategory, string> = {
  seo: "Migliorare la visibilita' del sito nei risultati di ricerca.",
  technical: "Rendere il sito piu' solido e affidabile dal punto di vista tecnico.",
  ux: "Rendere il sito piu' accessibile e semplice da usare per tutti i visitatori.",
  conversion: "Aumentare la probabilita' che un visitatore diventi un contatto o un cliente.",
  content: "Migliorare la qualita' e la chiarezza dei contenuti pubblicati.",
};
