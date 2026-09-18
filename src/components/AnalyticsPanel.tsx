"use client";

import { useCallback, useEffect, useState } from "react";
import { MetricCard } from "@/components/MetricCard";

interface PanelData {
  connected: boolean;
  propertyId: string | null;
  propertyName: string | null;
  properties: { propertyId: string; displayName: string; accountName: string }[] | null;
  summary: {
    dateRange: { start: string; end: string };
    totals: { users: number; sessions: number };
    topSources: { source: string; users: number; sessions: number }[];
    topPages: { path: string; views: number; users: number }[];
  } | null;
  error: string | null;
  reauthRequired: boolean;
}

const formatNumber = (value: number) => value.toLocaleString("it-IT");

/**
 * Contenuto della tab Web Analytics per un sito gia' collegato: sceglie la
 * proprieta' GA4 se manca, mostra i dati reali altrimenti, e negli altri casi
 * un messaggio onesto (token scaduto, nessuna proprieta', errore di Google) —
 * mai numeri di ripiego.
 */
export function AnalyticsPanel({ siteId, connectHref }: { siteId: string; connectHref: string }) {
  const [data, setData] = useState<PanelData | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const load = useCallback(
    async (selecting = false) => {
      setLoading(true);
      setFailed(false);
      try {
        const res = await fetch(`/api/gestionale/analytics?siteId=${siteId}${selecting ? "&select=1" : ""}`);
        if (!res.ok) {
          setFailed(true);
          return;
        }
        setData(await res.json());
      } catch {
        setFailed(true);
      } finally {
        setLoading(false);
      }
    },
    [siteId]
  );

  useEffect(() => {
    setData(null);
    load();
  }, [load]);

  async function chooseProperty(propertyId: string) {
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch("/api/gestionale/analytics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteId, propertyId }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setSaveError(body.error ?? "Impossibile salvare la proprieta'.");
        return;
      }
      await load();
    } finally {
      setSaving(false);
    }
  }

  if (loading && !data) return <p className="mt-3 text-sm text-ink-soft">Caricamento dati da Google Analytics...</p>;

  if (failed || !data) {
    return (
      <>
        <p className="mt-3 text-sm text-severity-high">Impossibile caricare i dati di Google Analytics.</p>
        <button onClick={() => load()} className="mt-4 rounded-md border border-line px-4 py-2 text-sm hover:border-accent">
          Riprova
        </button>
      </>
    );
  }

  if (data.reauthRequired) {
    return (
      <>
        <p className="mt-3 text-sm text-severity-high">
          L&apos;accesso a Google non e&apos; piu&apos; valido (token scaduto o revocato).
        </p>
        <p className="mt-1 text-sm text-ink-soft">Riconnetti l&apos;account per tornare a vedere i dati di questo sito.</p>
        <a href={connectHref} className="tap-target mt-4 inline-block rounded-md bg-accent px-4 py-2 text-sm text-paper hover:bg-accent-deep">
          Riconnetti l&apos;account
        </a>
      </>
    );
  }

  if (data.properties) {
    if (data.properties.length === 0) {
      return (
        <>
          <p className="mt-3 text-sm text-ink-soft">Nessuna proprieta&apos; GA4 trovata su questo account Google.</p>
          <p className="mt-1 text-sm text-ink-soft">
            Verifica di avere accesso a una proprieta&apos; Google Analytics 4 con questo account, oppure riconnetti con un
            account diverso.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button onClick={() => load(true)} className="rounded-md border border-line px-4 py-2 text-sm hover:border-accent">
              Ricontrolla
            </button>
            <a href={connectHref} className="tap-target rounded-md border border-line px-4 py-2 text-sm hover:border-accent">
              Usa un altro account
            </a>
          </div>
        </>
      );
    }
    return (
      <>
        <p className="mt-3 text-sm text-ink-soft">Scegli la proprieta&apos; Google Analytics da usare per questo sito.</p>
        <ul className="mt-3 space-y-2">
          {data.properties.map((p) => (
            <li key={p.propertyId}>
              <button
                onClick={() => chooseProperty(p.propertyId)}
                disabled={saving}
                className="w-full break-words rounded-md border border-line px-3 py-2 text-left text-sm hover:border-accent disabled:opacity-60"
              >
                {p.displayName}
                {p.accountName && <span className="ml-2 text-ink-soft">· {p.accountName}</span>}
              </button>
            </li>
          ))}
        </ul>
        {saveError && <p className="mt-2 text-sm text-severity-high">{saveError}</p>}
        {data.propertyId && (
          <button onClick={() => load()} className="-mx-2 mt-3 px-2 py-2 text-sm text-ink-soft underline">
            Annulla
          </button>
        )}
      </>
    );
  }

  if (data.error) {
    return (
      <>
        <p className="mt-3 text-sm text-severity-high">{data.error}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button onClick={() => load()} className="rounded-md border border-line px-4 py-2 text-sm hover:border-accent">
            Riprova
          </button>
          {data.propertyId && (
            <button onClick={() => load(true)} className="rounded-md border border-line px-4 py-2 text-sm hover:border-accent">
              Cambia proprieta&apos;
            </button>
          )}
        </div>
      </>
    );
  }

  const summary = data.summary;
  if (!summary) return null;
  const { totals, dateRange } = summary;
  const noData = totals.users === 0 && totals.sessions === 0 && summary.topSources.length === 0 && summary.topPages.length === 0;

  return (
    <>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm text-ink-soft">
        <span className="min-w-0 break-words">
          {data.propertyName ?? `Proprieta' ${data.propertyId}`} · dal {dateRange.start} al {dateRange.end}
        </span>
        <button onClick={() => load(true)} className="-mx-2 px-2 py-2 underline">
          Cambia proprieta&apos;
        </button>
      </div>
      {noData ? (
        <p className="mt-4 text-sm text-ink-soft">
          Google Analytics non ha registrato visite per questa proprieta&apos; nel periodo. Se il tag e&apos; stato
          installato da poco, i dati possono richiedere alcune ore.
        </p>
      ) : (
        <>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <MetricCard label="Utenti" value={formatNumber(totals.users)} />
            <MetricCard label="Sessioni" value={formatNumber(totals.sessions)} />
          </div>
          {summary.topSources.length > 0 && (
            <section className="mt-6">
              <h3 className="font-display text-base">Sorgenti di traffico</h3>
              <div className="scroll-shadow-x scroll-shadow-x-white mt-2">
                <table className="w-full text-left text-sm">
                  <thead className="text-ink-soft">
                    <tr>
                      <th className="py-1 pr-3 font-normal">Sorgente</th>
                      <th className="py-1 pr-3 text-right font-normal">Utenti</th>
                      <th className="py-1 text-right font-normal">Sessioni</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.topSources.map((row) => (
                      <tr key={row.source} className="border-t border-line">
                        <td className="max-w-[16rem] truncate py-1 pr-3" title={row.source}>
                          {row.source || "(non assegnata)"}
                        </td>
                        <td className="py-1 pr-3 text-right">{formatNumber(row.users)}</td>
                        <td className="py-1 text-right">{formatNumber(row.sessions)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
          {summary.topPages.length > 0 && (
            <section className="mt-6">
              <h3 className="font-display text-base">Pagine principali</h3>
              <div className="scroll-shadow-x scroll-shadow-x-white mt-2">
                <table className="w-full text-left text-sm">
                  <thead className="text-ink-soft">
                    <tr>
                      <th className="py-1 pr-3 font-normal">Pagina</th>
                      <th className="py-1 pr-3 text-right font-normal">Visualizzazioni</th>
                      <th className="py-1 text-right font-normal">Utenti</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.topPages.map((row) => (
                      <tr key={row.path} className="border-t border-line">
                        <td className="max-w-[16rem] truncate py-1 pr-3" title={row.path}>
                          {row.path}
                        </td>
                        <td className="py-1 pr-3 text-right">{formatNumber(row.views)}</td>
                        <td className="py-1 text-right">{formatNumber(row.users)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </>
      )}
    </>
  );
}
