import type { PlanType } from "@prisma/client";

/**
 * Fonte unica delle regole di piano (brief, sezione 31): le feature
 * booleane sotto NON sono configurabili da admin (sono regole di
 * prodotto, non quote numeriche) — a differenza dei limiti quantitativi
 * (siti/analisi), che restano in UsageLimit e sono gestibili dall'area
 * admin. Nessun componente o route deve controllare `plan === "PRO"`
 * direttamente per decidere se una funzione e' disponibile: deve sempre
 * passare da qui, cosi' la regola vive in un solo posto.
 */
export interface PlanFeatures {
  ai: boolean; // assistente AI (advisor per sito + storico conversazioni)
  fullReports: boolean; // report/PDF completi, non troncati
  dashboard: boolean; // accesso al Gestionale (Analytics/Search Console/Metrics/Observability)
  monitoring: boolean; // monitoraggio periodico automatico dei siti
  pdfMaxPages: number; // tetto indicativo di pagine del PDF generato
}

export const PLAN_FEATURES: Record<PlanType, PlanFeatures> = {
  FREE: {
    ai: false,
    fullReports: false,
    dashboard: false,
    monitoring: false,
    pdfMaxPages: 1,
  },
  PRO: {
    ai: true,
    fullReports: true,
    dashboard: true,
    monitoring: true,
    pdfMaxPages: 5,
  },
};

export function getPlanFeatures(plan: PlanType): PlanFeatures {
  return PLAN_FEATURES[plan];
}

/** Quante analisi complete (non troncate) mostrare nell'anteprima Free. */
export const FREE_PREVIEW_ISSUE_COUNT = 2;
export const FREE_PREVIEW_STRENGTH_COUNT = 2;
export const FREE_PREVIEW_ACTION_COUNT = 1;
