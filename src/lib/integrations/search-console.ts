const API_BASE = "https://www.googleapis.com/webmasters/v3";

interface GoogleApiErrorBody {
  error?: { code?: number; message?: string; status?: string };
}

function logProviderError(operation: string, rawError: string) {
  console.error(`[search-console] ${operation} fallita: ${rawError}`);
}

/**
 * Esegue una richiesta autenticata verso la Search Console API e
 * distingue il caso "token non piu' valido" (401, o 403 con motivo
 * riconducibile all'autenticazione) da altri errori — serve a decidere
 * se il chiamante deve proporre "ricollega l'account" oppure un
 * messaggio generico.
 */
async function callSearchConsole(
  accessToken: string,
  path: string,
  init: RequestInit = {}
): Promise<{ ok: true; data: unknown } | { ok: false; error: string; unauthorized: boolean }> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: { ...init.headers, Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
  } catch (err) {
    return {
      ok: false,
      unauthorized: false,
      error: err instanceof Error ? err.message : "Errore di rete verso Google Search Console",
    };
  }

  if (response.status === 401) {
    return { ok: false, unauthorized: true, error: "Token di accesso non valido o scaduto (401)" };
  }

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as GoogleApiErrorBody | null;
    return {
      ok: false,
      unauthorized: false,
      error: body?.error?.message ?? `Search Console API ha risposto con status ${response.status}`,
    };
  }

  const data = await response.json().catch(() => null);
  if (data === null) return { ok: false, unauthorized: false, error: "Risposta di Search Console non leggibile" };
  return { ok: true, data };
}

export interface SearchConsoleSite {
  siteUrl: string;
  permissionLevel: string;
}

/** Elenca le proprieta' Search Console a cui l'account autorizzato ha accesso (sites.list). */
export async function listSearchConsoleSites(
  accessToken: string
): Promise<{ ok: true; sites: SearchConsoleSite[] } | { ok: false; error: string; unauthorized: boolean }> {
  const result = await callSearchConsole(accessToken, "/sites");
  if (!result.ok) {
    logProviderError("sites.list", result.error);
    return result;
  }
  const entries = (result.data as { siteEntry?: SearchConsoleSite[] }).siteEntry ?? [];
  return { ok: true, sites: entries };
}

export interface SearchAnalyticsTotals {
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface SearchAnalyticsRow extends SearchAnalyticsTotals {
  key: string;
}

export interface SearchConsoleSummary {
  dateRange: { start: string; end: string };
  totals: SearchAnalyticsTotals;
  topQueries: SearchAnalyticsRow[];
  topPages: SearchAnalyticsRow[];
}

interface RawSearchAnalyticsRow {
  keys?: string[];
  clicks?: number;
  impressions?: number;
  ctr?: number;
  position?: number;
}

async function querySearchAnalytics(
  accessToken: string,
  siteUrl: string,
  body: { startDate: string; endDate: string; dimensions?: string[]; rowLimit?: number }
): Promise<{ ok: true; rows: RawSearchAnalyticsRow[] } | { ok: false; error: string; unauthorized: boolean }> {
  const result = await callSearchConsole(accessToken, `/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!result.ok) {
    logProviderError("searchAnalytics.query", result.error);
    return result;
  }
  const rows = (result.data as { rows?: RawSearchAnalyticsRow[] }).rows ?? [];
  return { ok: true, rows };
}

function toTotals(row: RawSearchAnalyticsRow | undefined): SearchAnalyticsTotals {
  return {
    clicks: row?.clicks ?? 0,
    impressions: row?.impressions ?? 0,
    ctr: row?.ctr ?? 0,
    position: row?.position ?? 0,
  };
}

/**
 * Riepilogo reale per una proprieta' Search Console: totali degli
 * ultimi 28 giorni (esclusi gli ultimi 3, per cui Search Console non ha
 * ancora dati consolidati), query principali, pagine principali. Tre
 * chiamate a searchanalytics.query (l'API non permette di ottenere
 * totali + due breakdown in una sola richiesta).
 *
 * Nota deliberata: non include un conteggio di "pagine indicizzate".
 * La Search Console API non espone un totale affidabile delle pagine
 * indicizzate (quello mostrato nel report "Copertura" dell'interfaccia
 * web non ha un endpoint pubblico equivalente) — mostrarlo qui
 * richiederebbe o inventare il dato o etichettare in modo fuorviante
 * "pagine con almeno un clic/impression" come se fosse "indicizzate",
 * che sono cose diverse. Va contro la regola di non mostrare mai dati
 * non verificabili.
 */
export async function getSearchConsoleSummary(
  accessToken: string,
  siteUrl: string
): Promise<{ ok: true; summary: SearchConsoleSummary } | { ok: false; error: string; unauthorized: boolean }> {
  const end = new Date();
  end.setDate(end.getDate() - 3);
  const start = new Date(end);
  start.setDate(start.getDate() - 28);
  const startDate = start.toISOString().slice(0, 10);
  const endDate = end.toISOString().slice(0, 10);

  const [totalsResult, queriesResult, pagesResult] = await Promise.all([
    querySearchAnalytics(accessToken, siteUrl, { startDate, endDate }),
    querySearchAnalytics(accessToken, siteUrl, { startDate, endDate, dimensions: ["query"], rowLimit: 10 }),
    querySearchAnalytics(accessToken, siteUrl, { startDate, endDate, dimensions: ["page"], rowLimit: 10 }),
  ]);

  if (!totalsResult.ok) return totalsResult;
  if (!queriesResult.ok) return queriesResult;
  if (!pagesResult.ok) return pagesResult;

  const toRow = (row: RawSearchAnalyticsRow): SearchAnalyticsRow => ({
    key: row.keys?.[0] ?? "",
    ...toTotals(row),
  });

  return {
    ok: true,
    summary: {
      dateRange: { start: startDate, end: endDate },
      totals: toTotals(totalsResult.rows[0]),
      topQueries: queriesResult.rows.map(toRow),
      topPages: pagesResult.rows.map(toRow),
    },
  };
}
