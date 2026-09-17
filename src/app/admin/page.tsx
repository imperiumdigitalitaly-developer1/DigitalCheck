"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

interface AdminStats {
  totalUsers: number;
  freeUsers: number;
  proUsers: number;
  conversionRate: number;
  totalSites: number;
  totalScans: number;
  completedScans: number;
  failedScans: number;
  scanSuccessRate: number;
}

interface AdminUser {
  id: string;
  email: string;
  plan: "FREE" | "PRO";
  isAdmin: boolean;
  emailVerified: boolean;
  createdAt: string;
  siteCount: number;
}

interface AdminSite {
  id: string;
  url: string;
  businessType: string;
  ownerEmail: string;
  monitoringEnabled: boolean;
  createdAt: string;
  lastScan: {
    id: string;
    status: string;
    overallScore: number | null;
    startedAt: string;
    errorMessage: string | null;
  } | null;
}

interface PlanLimit {
  plan: "FREE" | "PRO";
  maxSites: number;
  maxScansMonth: number;
  maxPagesScan: number;
  maxScansWeek: number | null;
  maxSitesMonth: number | null;
}

type Tab = "overview" | "users" | "sites" | "limits";

export default function AdminPage() {
  const [tab, setTab] = useState<Tab>("overview");
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [sites, setSites] = useState<AdminSite[] | null>(null);
  const [limits, setLimits] = useState<PlanLimit[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savingLimit, setSavingLimit] = useState<string | null>(null);

  const loadStats = useCallback(async () => {
    const res = await fetch("/api/admin/stats");
    const data = await res.json();
    if (!res.ok) return setError(data.error ?? "Errore");
    setStats(data);
  }, []);

  const loadUsers = useCallback(async () => {
    const res = await fetch("/api/admin/users");
    const data = await res.json();
    if (!res.ok) return setError(data.error ?? "Errore");
    setUsers(data);
  }, []);

  const loadSites = useCallback(async () => {
    const res = await fetch("/api/admin/sites");
    const data = await res.json();
    if (!res.ok) return setError(data.error ?? "Errore");
    setSites(data);
  }, []);

  const loadLimits = useCallback(async () => {
    const res = await fetch("/api/admin/usage-limits");
    const data = await res.json();
    if (!res.ok) return setError(data.error ?? "Errore");
    setLimits(data);
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  useEffect(() => {
    if (tab === "users" && !users) loadUsers();
    if (tab === "sites" && !sites) loadSites();
    if (tab === "limits" && !limits) loadLimits();
  }, [tab, users, sites, limits, loadUsers, loadSites, loadLimits]);

  async function handleChangePlan(userId: string, plan: "FREE" | "PRO") {
    const res = await fetch(`/api/admin/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan }),
    });
    if (res.ok) {
      setUsers((prev) => prev?.map((u) => (u.id === userId ? { ...u, plan } : u)) ?? null);
    }
  }

  async function handleSaveLimit(limit: PlanLimit) {
    setSavingLimit(limit.plan);
    await fetch("/api/admin/usage-limits", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(limit),
    });
    setSavingLimit(null);
  }

  function updateLimitField(plan: "FREE" | "PRO", field: keyof PlanLimit, value: number | null) {
    setLimits((prev) => prev?.map((l) => (l.plan === plan ? { ...l, [field]: value } : l)) ?? null);
  }

  if (error) return <div className="p-10 text-center text-severity-high">{error}</div>;

  return (
    <main className="min-h-screen bg-paper px-6 py-10">
      <div className="mx-auto max-w-5xl">
        <div className="flex items-baseline gap-2">
          <span className="font-display text-lg">DigitalCheck</span>
          <span className="text-xs text-ink-soft">powered by Imperium Digital</span>
        </div>
        <Link href="/dashboard" className="mt-4 inline-block text-sm text-ink-soft hover:text-ink">
          ← Torna alla dashboard
        </Link>
        <h1 className="mt-2 font-display text-2xl">DigitalCheck — Amministrazione</h1>

        <div className="mt-6 flex gap-2 border-b border-line">
          {([
            ["overview", "Panoramica"],
            ["users", "Utenti"],
            ["sites", "Siti"],
            ["limits", "Limiti piano"],
          ] as [Tab, string][]).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`px-4 py-2 text-sm ${
                tab === key ? "border-b-2 border-accent font-medium text-ink" : "text-ink-soft"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "overview" && (
          <div className="mt-6">
            {!stats ? (
              <p className="text-ink-soft">Caricamento...</p>
            ) : (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                {[
                  { label: "Utenti totali", value: stats.totalUsers },
                  { label: "Utenti Free", value: stats.freeUsers },
                  { label: "Utenti Pro", value: stats.proUsers },
                  { label: "Conversion rate Free→Pro", value: `${stats.conversionRate}%` },
                  { label: "Siti monitorati", value: stats.totalSites },
                  { label: "Scansioni totali", value: stats.totalScans },
                  { label: "Scansioni riuscite", value: stats.completedScans },
                  { label: "Scansioni fallite", value: stats.failedScans },
                  { label: "Tasso di successo scan", value: `${stats.scanSuccessRate}%` },
                ].map((c) => (
                  <div key={c.label} className="rounded-lg border border-line bg-white p-4">
                    <p className="text-sm text-ink-soft">{c.label}</p>
                    <p className="font-display text-2xl">{c.value}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === "users" && (
          <div className="mt-6 space-y-2">
            {!users ? (
              <p className="text-ink-soft">Caricamento...</p>
            ) : (
              users.map((u) => (
                <div
                  key={u.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-white p-4"
                >
                  <div>
                    <p className="font-medium">
                      {u.email} {u.isAdmin && <span className="text-xs text-accent">(admin)</span>}
                    </p>
                    <p className="text-sm text-ink-soft">
                      {u.siteCount} siti · {u.emailVerified ? "email verificata" : "email non verificata"} ·
                      registrato il {new Date(u.createdAt).toLocaleDateString("it-IT")}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-accent-soft px-3 py-1 text-sm text-accent-deep">
                      {u.plan === "PRO" ? "Pro" : "Free"}
                    </span>
                    <button
                      onClick={() => handleChangePlan(u.id, u.plan === "PRO" ? "FREE" : "PRO")}
                      className="rounded-md border border-line px-3 py-1.5 text-sm hover:border-accent"
                    >
                      Passa a {u.plan === "PRO" ? "Free" : "Pro"}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {tab === "sites" && (
          <div className="mt-6 space-y-2">
            {!sites ? (
              <p className="text-ink-soft">Caricamento...</p>
            ) : (
              sites.map((s) => (
                <div key={s.id} className="rounded-lg border border-line bg-white p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-medium">{s.url}</p>
                      <p className="text-sm text-ink-soft">
                        {s.ownerEmail} · {s.businessType} ·{" "}
                        {s.monitoringEnabled ? "monitoraggio attivo" : "monitoraggio disattivo"}
                      </p>
                    </div>
                    {s.lastScan ? (
                      <div className="text-right text-sm">
                        <p className={s.lastScan.status === "FAILED" ? "text-severity-high" : "text-ink-soft"}>
                          {s.lastScan.status === "COMPLETED"
                            ? `Score ${s.lastScan.overallScore}`
                            : s.lastScan.status === "FAILED"
                              ? `Fallito: ${s.lastScan.errorMessage}`
                              : s.lastScan.status}
                        </p>
                        <p className="text-ink-soft">
                          {new Date(s.lastScan.startedAt).toLocaleDateString("it-IT")}
                        </p>
                      </div>
                    ) : (
                      <p className="text-sm text-ink-soft">Nessuna scansione</p>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {tab === "limits" && (
          <div className="mt-6 space-y-4">
            {!limits ? (
              <p className="text-ink-soft">Caricamento...</p>
            ) : (
              limits.map((l) => (
                <div key={l.plan} className="rounded-lg border border-line bg-white p-5">
                  <h3 className="font-display text-lg">{l.plan === "PRO" ? "Piano Pro" : "Piano Free"}</h3>
                  {l.plan === "PRO" ? (
                    <p className="mt-1 text-xs text-ink-soft">
                      Siti: illimitati (regola di prodotto, non modificabile qui). Analisi mensili e pagine per
                      scan restano configurabili.
                    </p>
                  ) : (
                    <p className="mt-1 text-xs text-ink-soft">
                      Regola di prodotto: 1 analisi a settimana, 1 sito nuovo al mese.
                    </p>
                  )}
                  <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                    {l.plan === "FREE" ? (
                      <>
                        <label className="text-sm text-ink-soft">
                          Analisi/settimana
                          <input
                            type="number"
                            value={l.maxScansWeek ?? 1}
                            onChange={(e) => updateLimitField(l.plan, "maxScansWeek", Number(e.target.value))}
                            className="mt-1 w-full rounded-md border border-line px-3 py-2 text-ink outline-none focus:border-accent"
                          />
                        </label>
                        <label className="text-sm text-ink-soft">
                          Nuovi siti/mese
                          <input
                            type="number"
                            value={l.maxSitesMonth ?? 1}
                            onChange={(e) => updateLimitField(l.plan, "maxSitesMonth", Number(e.target.value))}
                            className="mt-1 w-full rounded-md border border-line px-3 py-2 text-ink outline-none focus:border-accent"
                          />
                        </label>
                      </>
                    ) : (
                      <label className="text-sm text-ink-soft">
                        Scansioni/mese
                        <input
                          type="number"
                          value={l.maxScansMonth}
                          onChange={(e) => updateLimitField(l.plan, "maxScansMonth", Number(e.target.value))}
                          className="mt-1 w-full rounded-md border border-line px-3 py-2 text-ink outline-none focus:border-accent"
                        />
                      </label>
                    )}
                    <label className="text-sm text-ink-soft">
                      Pagine per scan
                      <input
                        type="number"
                        value={l.maxPagesScan}
                        onChange={(e) => updateLimitField(l.plan, "maxPagesScan", Number(e.target.value))}
                        className="mt-1 w-full rounded-md border border-line px-3 py-2 text-ink outline-none focus:border-accent"
                      />
                    </label>
                  </div>
                  <button
                    onClick={() => handleSaveLimit(l)}
                    disabled={savingLimit === l.plan}
                    className="mt-4 rounded-md bg-accent px-4 py-2 text-sm font-medium text-paper hover:bg-accent-deep disabled:opacity-60"
                  >
                    {savingLimit === l.plan ? "Salvataggio..." : "Salva"}
                  </button>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </main>
  );
}
