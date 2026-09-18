"use client";

import { useCallback, useEffect, useState } from "react";
import { MetricCard } from "@/components/MetricCard";

interface Row {
  key: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

interface PanelData {
  connected: boolean;
  siteUrl: string | null;
  properties: { siteUrl: string; permissionLevel: string }[] | null;
  summary: {
    dateRange: { start: string; end: string };
    totals: Omit<Row, "key">;
    topQueries: Row[];
    topPages: Row[];
  } | null;
  error: string | null;
  reauthRequired: boolean;
}

const formatPercent = (ctr: number) => `${(ctr * 100).toFixed(1)}%`;
const formatPosition = (position: number) => (position > 0 ? position.toFixed(1) : "—");

/**
 * Contenuto della tab Search Console per un sito gia' collegato: sceglie la
 * proprieta' se manca, mostra i dati reali altrimenti, e negli altri casi un
 * messaggio onesto (token scaduto, nessuna proprieta', errore di Google) —
 * mai numeri di ripiego.
 */
export function SearchConsolePanel({ siteId, connectHref }: { siteId: string; connectHref: string }) {
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
        const res = await fetch(`/api/gestionale/search-console?siteId=${siteId}${selecting ? "&select=1" : ""}`);
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

  async function chooseProperty(siteUrl: string) {
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch("/api/gestionale/search-console", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteId, siteUrl }),
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

  if (loading && !data) return <p className="mt-3 text-sm text-ink-soft">Caricamento dati da Google Search Console...</p>;

  if (failed || !data) {
    return (
      <>
        <p className="mt-3 text-sm text-severity-high">Impossibile caricare i dati di Search Console.</p>
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
        <a href={connectHref} className="mt-4 inline-block rounded-md bg-accent px-4 py-2 text-sm text-paper hover:bg-accent-deep">
          Riconnetti l&apos;account
        </a>
      </>
    );
  }

  if (data.properties) {
    if (data.properties.length === 0) {
      return (
        <>
          <p className="mt-3 text-sm text-ink-soft">
            Nessuna proprieta&apos; Search Console verificata trovata su questo account Google.
          </p>
          <p className="mt-1 text-sm text-ink-soft">
            Aggiungi e verifica il sito su Search Console con questo account, oppure riconnetti con un account diverso.
          </p>
          <div className="mt-4 flex gap-2">
            <button onClick={() => load(true)} className="rounded-md border border-line px-4 py-2 text-sm hover:border-accent">
              Ricontrolla
            </button>
            <a href={connectHref} className="rounded-md border border-line px-4 py-2 text-sm hover:border-accent">
              Usa un altro account
            </a>
          </div>
        </>
      );
    }
    return (
      <>
        <p className="mt-3 text-sm text-ink-soft">Scegli la proprieta&apos; Search Console da usare per questo sito.</p>
        <ul className="mt-3 space-y-2">
          {data.properties.map((p) => (
            <li key={p.siteUrl}>
              <button
                onClick={() => chooseProperty(p.siteUrl)}
                disabled={saving}
                className="w-full rounded-md border border-line px-3 py-2 text-left text-sm hover:border-accent disabled:opacity-60"
              >
                {p.siteUrl}
              </button>
            </li>
          ))}
        </ul>
        {saveError && <p className="mt-2 text-sm text-severity-high">{saveError}</p>}
        {data.siteUrl && (
          <button onClick={() => load()} className="mt-3 text-sm text-ink-soft underline">
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
        <div className="mt-4 flex gap-2">
          <button onClick={() => load()} className="rounded-md border border-line px-4 py-2 text-sm hover:border-accent">
            Riprova
          </button>
          {data.siteUrl && (
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
  const noData = totals.impressions === 0 && summary.topQueries.length === 0 && summary.topPages.length === 0;

  return (
    <>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm text-ink-soft">
        <span>
          {data.siteUrl} · dal {dateRange.start} al {dateRange.end}
        </span>
        <button onClick={() => load(true)} className="underline">
          Cambia proprieta&apos;
        </button>
      </div>
      {noData ? (
        <p className="mt-4 text-sm text-ink-soft">
          Search Console non ha registrato click o impression per questa proprieta&apos; nel periodo. Se il sito e&apos;
          stato aggiunto da poco, i dati possono richiedere alcuni giorni.
        </p>
      ) : (
        <>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <MetricCard label="Click" value={totals.clicks.toLocaleString("it-IT")} />
            <MetricCard label="Impression" value={totals.impressions.toLocaleString("it-IT")} />
            <MetricCard label="CTR" value={formatPercent(totals.ctr)} />
            <MetricCard label="Posizione media" value={formatPosition(totals.position)} />
          </div>
          <RowsTable title="Query principali" keyLabel="Query" rows={summary.topQueries} />
          <RowsTable title="Pagine principali" keyLabel="Pagina" rows={summary.topPages} />
        </>
      )}
    </>
  );
}

function RowsTable({ title, keyLabel, rows }: { title: string; keyLabel: string; rows: Row[] }) {
  if (rows.length === 0) return null;
  return (
    <section className="mt-6">
      <h3 className="font-display text-base">{title}</h3>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-ink-soft">
            <tr>
              <th className="py-1 pr-3 font-normal">{keyLabel}</th>
              <th className="py-1 pr-3 text-right font-normal">Click</th>
              <th className="py-1 pr-3 text-right font-normal">Impr.</th>
              <th className="py-1 pr-3 text-right font-normal">CTR</th>
              <th className="py-1 text-right font-normal">Pos.</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key} className="border-t border-line">
                <td className="max-w-[16rem] truncate py-1 pr-3" title={row.key}>
                  {row.key}
                </td>
                <td className="py-1 pr-3 text-right">{row.clicks}</td>
                <td className="py-1 pr-3 text-right">{row.impressions}</td>
                <td className="py-1 pr-3 text-right">{formatPercent(row.ctr)}</td>
                <td className="py-1 text-right">{formatPosition(row.position)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
