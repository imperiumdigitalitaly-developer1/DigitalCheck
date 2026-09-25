"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { DashboardShell } from "@/components/DashboardShell";
import { EmptyState } from "@/components/EmptyState";
import { ScoreCircle } from "@/components/ScoreCircle";

interface MeUser {
  id: string;
  email: string;
  plan: "FREE" | "PRO";
  isAdmin: boolean;
}

interface ReportItem {
  scanId: string;
  siteId: string;
  url: string;
  overallScore: number | null;
  date: string;
}

export default function ReportsPage() {
  const [user, setUser] = useState<MeUser | null>(null);
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([fetch("/api/auth/me").then((r) => r.json()), fetch("/api/reports").then((r) => (r.ok ? r.json() : []))]).then(
      ([me, list]) => {
        setUser(me.user);
        setReports(list);
        setLoading(false);
      }
    );
  }, []);

  if (loading || !user) return <div className="p-10 text-center text-ink-soft">Caricamento...</div>;

  return (
    <DashboardShell user={user}>
      <h1 className="font-display text-2xl">Report</h1>
      <p className="mt-1 text-sm text-ink-soft">
        {user.plan === "PRO"
          ? "Ogni analisi completata genera un report PDF completo (almeno 5 pagine)."
          : "Con il piano Free il PDF e' sintetico (1 pagina). Passa a Pro per il report completo."}
      </p>

      {reports.length === 0 ? (
        <div className="mt-6">
          <EmptyState title="Nessun report ancora disponibile" description="Esegui la tua prima analisi per generare un report." />
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          {reports.map((r) => (
            <div key={r.scanId} className="flex items-center justify-between gap-4 rounded-[14px] border border-line bg-white p-4">
              <div className="flex min-w-0 items-center gap-4">
                {r.overallScore != null && (
                  <div className="shrink-0">
                    <ScoreCircle score={r.overallScore} size={44} />
                  </div>
                )}
                <div className="min-w-0">
                  <Link href={`/dashboard/site/${r.siteId}`} className="tap-target break-words font-medium hover:text-accent">
                    {r.url}
                  </Link>
                  <p className="text-sm text-ink-soft">{new Date(r.date).toLocaleDateString("it-IT")}</p>
                </div>
              </div>
              <a
                href={`/api/reports/${r.scanId}/pdf`}
                target="_blank"
                rel="noreferrer"
                className="tap-target shrink-0 rounded-md border border-line px-3 py-1.5 text-sm hover:border-accent"
              >
                Scarica PDF
              </a>
            </div>
          ))}
        </div>
      )}
    </DashboardShell>
  );
}
