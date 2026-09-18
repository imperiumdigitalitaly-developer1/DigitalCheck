import { prisma } from "@/lib/db/prisma";
import type { PlanType } from "@prisma/client";

export interface PlanLimits {
  maxSites: number;
  maxScansMonth: number;
  maxPagesScan: number;
  /** Solo Free: analisi settimanali consentite. Null per Pro (nessun cap settimanale). */
  maxScansWeek: number | null;
  /** Solo Free: nuovi siti aggiungibili nel mese corrente. Null per Pro (illimitato). */
  maxSitesMonth: number | null;
}

// Fallback usato solo se la tabella UsageLimit non e' stata ancora
// popolata (es. subito dopo la prima migrazione, prima del seed).
// Vedi prisma/seed.ts per i valori "ufficiali".
const FALLBACK: Record<PlanType, PlanLimits> = {
  FREE: {
    maxSites: 12,
    maxScansMonth: 4,
    maxPagesScan: Number(process.env.SCAN_MAX_PAGES_FREE ?? 5),
    maxScansWeek: 1,
    maxSitesMonth: 1,
  },
  PRO: {
    maxSites: 999_999,
    maxScansMonth: 200,
    maxPagesScan: Number(process.env.SCAN_MAX_PAGES_PRO ?? 20),
    maxScansWeek: null,
    maxSitesMonth: null,
  },
};

export async function getPlanLimits(plan: PlanType): Promise<PlanLimits> {
  const row = await prisma.usageLimit.findUnique({ where: { plan } });
  if (!row) return FALLBACK[plan];
  return {
    maxSites: row.maxSites,
    maxScansMonth: row.maxScansMonth,
    maxPagesScan: row.maxPagesScan,
    maxScansWeek: row.maxScansWeek ?? (plan === "FREE" ? FALLBACK.FREE.maxScansWeek : null),
    maxSitesMonth: row.maxSitesMonth ?? (plan === "FREE" ? FALLBACK.FREE.maxSitesMonth : null),
  };
}

function startOfCurrentMonth(): Date {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfCurrentWeek(): Date {
  // Settimana ISO (lunedi'-domenica), coerente indipendentemente dal
  // fuso del server.
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  const day = d.getDay(); // 0 = domenica
  const diffToMonday = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diffToMonday);
  return d;
}

// Le tre funzioni "ThisWeek/ThisMonth" leggono da UsageEvent (registro
// append-only), MAI da Scan/Site: quelle righe possono essere cancellate
// dall'utente (eliminazione sito) o dalla cascade DB, e un conteggio
// derivato da righe cancellabili permetterebbe di "liberare" quota gia'
// consumata semplicemente eliminando il sito o lo scan. countSites (sotto)
// e' l'unica eccezione voluta: rappresenta lo stato attuale (quanti siti
// esistono ORA), non un consumo storico, quindi e' corretto che scenda
// quando un sito viene eliminato.
export async function countScansThisMonth(userId: string): Promise<number> {
  return prisma.usageEvent.count({
    where: { userId, type: "SCAN", createdAt: { gte: startOfCurrentMonth() } },
  });
}

export async function countScansThisWeek(userId: string): Promise<number> {
  return prisma.usageEvent.count({
    where: { userId, type: "SCAN", createdAt: { gte: startOfCurrentWeek() } },
  });
}

export async function countSites(userId: string): Promise<number> {
  return prisma.site.count({ where: { ownerId: userId } });
}

export async function countSitesThisMonth(userId: string): Promise<number> {
  return prisma.usageEvent.count({
    where: { userId, type: "NEW_SITE", createdAt: { gte: startOfCurrentMonth() } },
  });
}
