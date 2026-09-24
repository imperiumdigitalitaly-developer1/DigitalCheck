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

/**
 * Quanti punti di forza sintetici mostrare nell'anteprima Free (brief
 * audit sezione 16: il PDF/dashboard Free non mostra piu' problemi o
 * raccomandazioni, solo una panoramica generale).
 */
export const FREE_PREVIEW_STRENGTH_COUNT = 2;
