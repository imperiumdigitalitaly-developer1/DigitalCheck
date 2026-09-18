const ADMIN_API_BASE = "https://analyticsadmin.googleapis.com/v1beta";
const DATA_API_BASE = "https://analyticsdata.googleapis.com/v1beta";

interface GoogleApiErrorBody {
  error?: { code?: number; message?: string; status?: string };
}

type ApiFailure = { ok: false; error: string; unauthorized: boolean };

function logProviderError(operation: string, rawError: string) {
  console.error(`[analytics] ${operation} fallita: ${rawError}`);
}

/**
 * Esegue una richiesta autenticata verso le API di Google Analytics e
 * distingue il caso "token non piu' valido" (401) dagli altri errori —
 * stessa logica di Search Console: serve a decidere se proporre
 * "ricollega l'account" oppure un messaggio generico.
 */
async function callAnalytics(
  accessToken: string,
  url: string,
  init: RequestInit = {}
): Promise<{ ok: true; data: unknown } | ApiFailure> {
  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      headers: { ...init.headers, Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
  } catch (err) {
    return {
      ok: false,
      unauthorized: false,
      error: err instanceof Error ? err.message : "Errore di rete verso Google Analytics",
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
      error: body?.error?.message ?? `Google Analytics API ha risposto con status ${response.status}`,
    };
  }

  const data = await response.json().catch(() => null);
  if (data === null) return { ok: false, unauthorized: false, error: "Risposta di Google Analytics non leggibile" };
  return { ok: true, data };
}

export interface Ga4Property {
  /** Solo l'id numerico, senza il prefisso "properties/". */
  propertyId: string;
  displayName: string;
  accountName: string;
}

interface RawAccountSummary {
  displayName?: string;
  propertySummaries?: { property?: string; displayName?: string }[];
}

const MAX_SUMMARY_PAGES = 5; // 5 x 200 = fino a 1000 account: oltre e' un caso anomalo, non serve seguirlo all'infinito

/** Elenca le proprieta' GA4 a cui l'account autorizzato ha accesso (accountSummaries.list). */
export async function listGa4Properties(
  accessToken: string
): Promise<{ ok: true; properties: Ga4Property[] } | ApiFailure> {
  const properties: Ga4Property[] = [];
  let pageToken: string | undefined;

  for (let page = 0; page < MAX_SUMMARY_PAGES; page++) {
    const url = new URL(`${ADMIN_API_BASE}/accountSummaries`);
    url.searchParams.set("pageSize", "200");
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    const result = await callAnalytics(accessToken, url.toString());
    if (!result.ok) {
      logProviderError("accountSummaries.list", result.error);
      return result;
    }

    const body = result.data as { accountSummaries?: RawAccountSummary[]; nextPageToken?: string };
    for (const account of body.accountSummaries ?? []) {
      for (const summary of account.propertySummaries ?? []) {
        const propertyId = summary.property?.replace(/^properties\//, "");
        if (!propertyId || !/^\d+$/.test(propertyId)) continue;
        properties.push({
          propertyId,
          displayName: summary.displayName ?? `Proprieta' ${propertyId}`,
          accountName: account.displayName ?? "",
        });
      }
    }

    pageToken = body.nextPageToken || undefined;
    if (!pageToken) break;
  }

  return { ok: true, properties };
}

export interface Ga4Totals {
  users: number;
  sessions: number;
}

export interface Ga4SourceRow {
  source: string;
  users: number;
  sessions: number;
}

export interface Ga4PageRow {
  path: string;
  views: number;
  users: number;
}

export interface Ga4Summary {
  dateRange: { start: string; end: string };
  totals: Ga4Totals;
  topSources: Ga4SourceRow[];
  topPages: Ga4PageRow[];
}

interface RawReportRow {
  dimensionValues?: { value?: string }[];
  metricValues?: { value?: string }[];
}

async function runReport(
  accessToken: string,
  propertyId: string,
  body: {
    dateRanges: { startDate: string; endDate: string }[];
    metrics: { name: string }[];
    dimensions?: { name: string }[];
    orderBys?: { metric: { metricName: string }; desc: boolean }[];
    limit?: number;
  }
): Promise<{ ok: true; rows: RawReportRow[] } | ApiFailure> {
  const result = await callAnalytics(accessToken, `${DATA_API_BASE}/properties/${propertyId}:runReport`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!result.ok) {
    logProviderError("runReport", result.error);
    return result;
  }
  const rows = (result.data as { rows?: RawReportRow[] }).rows ?? [];
  return { ok: true, rows };
}

const metric = (row: RawReportRow, index: number): number => {
  const value = Number(row.metricValues?.[index]?.value ?? 0);
  return Number.isFinite(value) ? value : 0;
};

const dimension = (row: RawReportRow): string => row.dimensionValues?.[0]?.value ?? "";

/**
 * Riepilogo reale per una proprieta' GA4: utenti attivi e sessioni degli
 * ultimi 28 giorni (fino a ieri; oggi e' ancora parziale), sorgenti di
 * traffico e pagine piu' viste. Tre chiamate runReport (una per totali,
 * una per dimensione: GA4 non restituisce totali e breakdown per
 * dimensioni diverse nella stessa richiesta).
 *
 * "Sorgente" e' il gruppo di canali predefinito di GA4
 * (sessionDefaultChannelGroup: Organic Search, Direct, Referral, ...):
 * e' la classificazione che l'utente vede anche in Analytics.
 */
export async function getGa4Summary(
  accessToken: string,
  propertyId: string
): Promise<{ ok: true; summary: Ga4Summary } | ApiFailure> {
  const end = new Date();
  end.setUTCDate(end.getUTCDate() - 1);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 27);
  const startDate = start.toISOString().slice(0, 10);
  const endDate = end.toISOString().slice(0, 10);
  const dateRanges = [{ startDate, endDate }];

  const [totalsResult, sourcesResult, pagesResult] = await Promise.all([
    runReport(accessToken, propertyId, {
      dateRanges,
      metrics: [{ name: "activeUsers" }, { name: "sessions" }],
    }),
    runReport(accessToken, propertyId, {
      dateRanges,
      dimensions: [{ name: "sessionDefaultChannelGroup" }],
      metrics: [{ name: "activeUsers" }, { name: "sessions" }],
      orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
      limit: 10,
    }),
    runReport(accessToken, propertyId, {
      dateRanges,
      dimensions: [{ name: "pagePath" }],
      metrics: [{ name: "screenPageViews" }, { name: "activeUsers" }],
      orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
      limit: 10,
    }),
  ]);

  if (!totalsResult.ok) return totalsResult;
  if (!sourcesResult.ok) return sourcesResult;
  if (!pagesResult.ok) return pagesResult;

  const totalsRow = totalsResult.rows[0];
  return {
    ok: true,
    summary: {
      dateRange: { start: startDate, end: endDate },
      totals: { users: totalsRow ? metric(totalsRow, 0) : 0, sessions: totalsRow ? metric(totalsRow, 1) : 0 },
      topSources: sourcesResult.rows.map((row) => ({
        source: dimension(row),
        users: metric(row, 0),
        sessions: metric(row, 1),
      })),
      topPages: pagesResult.rows.map((row) => ({
        path: dimension(row),
        views: metric(row, 0),
        users: metric(row, 1),
      })),
    },
  };
}
