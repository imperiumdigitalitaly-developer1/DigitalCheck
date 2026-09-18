import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { getCurrentSession } from "@/lib/auth/session";
import { getPlanLimits, countSitesThisMonth } from "@/lib/billing/plan-limits";
import { toDbBusinessType, fromDbBusinessType } from "@/lib/db/enum-map";
import { getPlanFeatures } from "@/lib/billing/plan-config";
import { getUptimeRobotApiKey } from "@/lib/integrations/uptimerobot";
import { provisionMonitorForSite } from "@/lib/gestionale/observability";

const createSchema = z.object({
  url: z
    .string()
    .trim()
    .transform((v) => (/^https?:\/\//i.test(v) ? v : `https://${v}`))
    .refine((v) => {
      try {
        new URL(v);
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

export async function GET() {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });

  const sites = await prisma.site.findMany({
    where: { ownerId: session.userId },
    orderBy: { createdAt: "desc" },
    include: {
      scans: {
        orderBy: { startedAt: "desc" },
        take: 2, // l'ultimo scan e il precedente, per calcolare la variazione
      },
    },
  });

  return NextResponse.json(
    sites.map((site) => ({
      id: site.id,
      url: site.url,
      businessType: fromDbBusinessType(site.businessType),
      goal: site.goal,
      monitoringEnabled: site.monitoringEnabled,
      lastScore: site.scans[0]?.overallScore ?? null,
      previousScore: site.scans[1]?.overallScore ?? null,
      lastScanAt: site.scans[0]?.completedAt ?? null,
      lastScanStatus: site.scans[0]?.status ?? null,
    }))
  );
}

export async function POST(request: NextRequest) {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dati non validi" }, { status: 400 });
  }

  const user = await prisma.user.findUniqueOrThrow({ where: { id: session.userId } });
  const limits = await getPlanLimits(user.plan);

  // Pro: siti illimitati, nessun controllo. Free: un nuovo sito al mese
  // (non un tetto di siti totali) — vedi brief sezione 3/31.
  if (user.plan === "FREE") {
    const sitesThisMonth = await countSitesThisMonth(session.userId);
    const cap = limits.maxSitesMonth ?? 1;
    if (sitesThisMonth >= cap) {
      return NextResponse.json(
        {
          error: `Con il piano Free puoi aggiungere ${cap} sito al mese. Passa a Pro per siti illimitati.`,
          errorCode: "FREE_SITES_MONTH_LIMIT",
        },
        { status: 403 }
      );
    }
  }

  const site = await prisma.site.create({
    data: {
      url: parsed.data.url,
      businessType: toDbBusinessType(parsed.data.businessType),
      goal: parsed.data.goal,
      ownerId: session.userId,
    },
  });

  // Consumo di quota "nuovo sito" registrato indipendentemente dal sito
  // stesso: eliminarlo in seguito non deve liberare la quota mensile gia'
  // usata (altrimenti create+delete diventerebbe un modo per aggirare il
  // limite "1 sito nuovo al mese" del piano Free).
  await prisma.usageEvent.create({ data: { userId: session.userId, type: "NEW_SITE" } });

  // Monitor UptimeRobot per la tab Observability del Gestionale (piano
  // Pro): creazione best-effort, non deve mai far fallire la creazione
  // del sito. Se fallisce (chiave assente, rete, quota UptimeRobot) il
  // sito resta senza monitor e la UI mostra il pulsante per collegarlo
  // retroattivamente (vedi POST /api/gestionale/observability).
  if (getPlanFeatures(user.plan).dashboard && getUptimeRobotApiKey()) {
    await provisionMonitorForSite(site.id, site.url).catch((err) => {
      console.error(`[observability] provisioning monitor fallito per il sito ${site.id}:`, err);
    });
  }

  return NextResponse.json(site, { status: 201 });
}
