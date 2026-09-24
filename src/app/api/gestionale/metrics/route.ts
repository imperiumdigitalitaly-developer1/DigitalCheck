import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getCurrentSession } from "@/lib/auth/session";
import { getPlanFeatures } from "@/lib/billing/plan-config";
import { fromDbGeoCategory } from "@/lib/geo/geo-enum-map";

/**
 * Storico dei punteggi per un sito, ricavato dalle scansioni realmente
 * salvate (brief sezione 19/34): nessun dato temporale simulato, solo
 * cio' che e' stato effettivamente misurato.
 */
export async function GET(request: NextRequest) {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });

  const user = await prisma.user.findUniqueOrThrow({ where: { id: session.userId } });
  if (!getPlanFeatures(user.plan).dashboard) {
    return NextResponse.json({ error: "I Metrics sono una funzionalita' del piano Pro." }, { status: 403 });
  }

  const siteId = request.nextUrl.searchParams.get("siteId");
  if (!siteId) return NextResponse.json({ error: "siteId mancante" }, { status: 400 });

  const site = await prisma.site.findUnique({ where: { id: siteId } });
  if (!site || site.ownerId !== session.userId) {
    return NextResponse.json({ error: "Sito non trovato" }, { status: 404 });
  }

  const scans = await prisma.scan.findMany({
    where: { siteId, status: "COMPLETED" },
    orderBy: { startedAt: "asc" },
    take: 30,
    include: { scores: true, geoAnalysis: { include: { categoryScores: true } } },
  });

  const points = scans.map((scan) => ({
    scanId: scan.id,
    date: scan.startedAt,
    overallScore: scan.overallScore,
    categoryScores: Object.fromEntries(scan.scores.map((s) => [s.category, s.score])),
    geoOverallScore: scan.geoAnalysis?.overallScore ?? null,
    geoCategoryScores: scan.geoAnalysis
      ? Object.fromEntries(
          scan.geoAnalysis.categoryScores.filter((c) => c.applicable).map((c) => [fromDbGeoCategory(c.category), c.score])
        )
      : null,
  }));

  function trendNoteFor(label: string, key: "overallScore" | "geoOverallScore"): string | null {
    const withScore = points.filter((p) => p[key] != null);
    if (withScore.length < 2) return null;
    const first = withScore[0];
    const last = withScore[withScore.length - 1];
    const firstScore = first?.[key];
    const lastScore = last?.[key];
    if (firstScore == null || lastScore == null) return null;
    const delta = lastScore - firstScore;
    if (delta > 0) return `Il punteggio ${label} e' migliorato di ${delta} punti dalla prima analisi disponibile.`;
    if (delta < 0) return `Il punteggio ${label} e' peggiorato di ${Math.abs(delta)} punti dalla prima analisi disponibile.`;
    return `Il punteggio ${label} e' rimasto stabile dalla prima analisi disponibile.`;
  }

  return NextResponse.json({
    points,
    trendNote: trendNoteFor("complessivo", "overallScore"),
    geoTrendNote: trendNoteFor("GEO", "geoOverallScore"),
  });
}
