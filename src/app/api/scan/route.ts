import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { runScanPipeline } from "@/lib/pipeline/run-scan";
import { toFreeReport } from "@/lib/billing/report-tiering";

export const runtime = "nodejs"; // serve dns/net, non compatibile con l'edge runtime

const requestSchema = z.object({
  url: z
    .string()
    .trim()
    .min(1, "Inserisci un URL")
    .transform((value) => (/^https?:\/\//i.test(value) ? value : `https://${value}`))
    .refine((value) => {
      try {
        new URL(value);
        return true;
      } catch {
        return false;
      }
    }, "URL non valido"),
  businessType: z.enum(["bnb", "hotel", "restaurant", "shop", "professional", "other"]),
  goal: z.enum([
    "increase_bookings",
    "increase_calls",
    "increase_quote_requests",
    "increase_visibility",
    "sell_products",
    "increase_contacts",
  ]),
});

// Rate limiting minimale in-memory, sufficiente per l'MVP a singolo
// processo. In produzione multi-istanza va sostituito con uno store
// condiviso (es. Redis) — vedi README, sezione Sicurezza.
const REQUESTS_PER_WINDOW = 5;
const WINDOW_MS = 10 * 60 * 1000;
const requestLog = new Map<string, number[]>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const timestamps = (requestLog.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  timestamps.push(now);
  requestLog.set(ip, timestamps);
  return timestamps.length > REQUESTS_PER_WINDOW;
}

/**
 * Scan pubblico e stateless (il widget della landing page): nessun
 * account richiesto, nessuna persistenza. Per gli scan persistiti,
 * legati a un utente e a un Site, vedi /api/sites/[id]/scan.
 */
export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (isRateLimited(ip)) {
    return NextResponse.json(
      { error: "Troppe richieste. Riprova tra qualche minuto." },
      { status: 429 }
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Richiesta non valida" },
      { status: 400 }
    );
  }

  const { url, businessType, goal } = parsed.data;
  const maxPages = Number(process.env.SCAN_MAX_PAGES_FREE ?? 5);

  // Widget pubblico non autenticato: priorita' bassa sulla quota Gemini
  // condivisa, cosi' non toglie spazio ad AI Assistant e Report/PDF.
  const result = await runScanPipeline(url, businessType, goal, maxPages, { aiPriority: "low" });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.errorMessage, errorCode: result.errorCode },
      { status: 422 }
    );
  }

  // Il widget pubblico non richiede un account: e' equivalente al piano
  // Free (anzi, un assaggio), quindi risponde sempre con il report
  // troncato — mai con l'analisi completa (brief sezioni 3 e 30).
  return NextResponse.json(toFreeReport(result.report));
}
