import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { getCurrentSession } from "@/lib/auth/session";

const FALLBACK = {
  FREE: { maxSites: 12, maxScansMonth: 4, maxPagesScan: 5, maxScansWeek: 1, maxSitesMonth: 1 },
  PRO: { maxSites: 999_999, maxScansMonth: 200, maxPagesScan: 20, maxScansWeek: null, maxSitesMonth: null },
} as const;

export async function GET() {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
  if (!session.isAdmin) return NextResponse.json({ error: "Non autorizzato" }, { status: 403 });

  const rows = await prisma.usageLimit.findMany();
  const byPlan = new Map(rows.map((r) => [r.plan, r]));

  const result = (["FREE", "PRO"] as const).map((plan) => {
    const row = byPlan.get(plan);
    return {
      plan,
      maxSites: row?.maxSites ?? FALLBACK[plan].maxSites,
      maxScansMonth: row?.maxScansMonth ?? FALLBACK[plan].maxScansMonth,
      maxPagesScan: row?.maxPagesScan ?? FALLBACK[plan].maxPagesScan,
      maxScansWeek: row?.maxScansWeek ?? FALLBACK[plan].maxScansWeek,
      maxSitesMonth: row?.maxSitesMonth ?? FALLBACK[plan].maxSitesMonth,
    };
  });

  return NextResponse.json(result);
}

const schema = z.object({
  plan: z.enum(["FREE", "PRO"]),
  maxSites: z.number().int().min(1).max(1_000_000),
  maxScansMonth: z.number().int().min(1).max(10000),
  maxPagesScan: z.number().int().min(1).max(100),
  maxScansWeek: z.number().int().min(1).max(1000).nullable().optional(),
  maxSitesMonth: z.number().int().min(1).max(1000).nullable().optional(),
});

export async function PATCH(request: NextRequest) {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
  if (!session.isAdmin) return NextResponse.json({ error: "Non autorizzato" }, { status: 403 });

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dati non validi" }, { status: 400 });
  }

  const { plan, ...limits } = parsed.data;

  await prisma.usageLimit.upsert({
    where: { plan },
    create: { plan, ...limits },
    update: limits,
  });

  return NextResponse.json({ ok: true });
}
