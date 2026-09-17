import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getCurrentSession } from "@/lib/auth/session";

/** Elenco dei report generabili (uno per scan completato) su tutti i siti dell'utente. */
export async function GET() {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });

  const scans = await prisma.scan.findMany({
    where: { site: { ownerId: session.userId }, status: "COMPLETED" },
    orderBy: { startedAt: "desc" },
    take: 50,
    include: { site: true },
  });

  return NextResponse.json(
    scans.map((scan) => ({
      scanId: scan.id,
      siteId: scan.siteId,
      url: scan.site.url,
      overallScore: scan.overallScore,
      date: scan.completedAt ?? scan.startedAt,
    }))
  );
}
