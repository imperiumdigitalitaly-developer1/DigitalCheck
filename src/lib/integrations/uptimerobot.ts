const API_BASE = "https://api.uptimerobot.com/v2";

/**
 * Main API Key di UptimeRobot (brief: integrazione Observability). Ritorna
 * null se non configurata, cosi' il chiamante puo' restare su "Monitoring
 * non ancora configurato" invece di rompersi — stesso pattern di
 * getGoogleOAuthCredentials in src/lib/integrations/google-oauth.ts.
 */
export function getUptimeRobotApiKey(): string | null {
  return process.env.UPTIMEROBOT_API_KEY || null;
}

export type MonitorLiveStatus = "up" | "down" | "paused" | "pending" | "unknown";

// Valori numerici documentati dall'API v2 di UptimeRobot per monitor.status.
function mapMonitorStatus(status: number): MonitorLiveStatus {
  switch (status) {
    case 0:
      return "paused";
    case 1:
      return "pending"; // non ancora controllato
    case 2:
      return "up";
    case 8:
    case 9:
      return "down"; // 8 = "seems down", 9 = "down" confermato
    default:
      return "unknown";
  }
}

export interface MonitorIncident {
  kind: "down" | "up" | "started" | "paused" | "other";
  at: string; // ISO 8601
  durationSeconds: number | null;
}

// Valori documentati per logs[].type.
function mapLogType(type: number): MonitorIncident["kind"] {
  switch (type) {
    case 1:
      return "down";
    case 2:
      return "up";
    case 98:
      return "started";
    case 99:
      return "paused";
    default:
      return "other";
  }
}

export interface MonitorSnapshot {
  monitorId: string;
  url: string;
  status: MonitorLiveStatus;
  /** Percentuale di uptime sugli ultimi 30 giorni, null se UptimeRobot non la fornisce (mai stimata). */
  uptimeRatio30d: number | null;
  /** Tempo di risposta dell'ultima rilevazione registrata, in ms; null se non disponibile. */
  lastResponseTimeMs: number | null;
  incidents: MonitorIncident[];
}

interface UptimeRobotOkResponse {
  stat: "ok";
  [key: string]: unknown;
}
interface UptimeRobotFailResponse {
  stat: "fail";
  error?: { type?: string; message?: string };
}
type UptimeRobotResponse = UptimeRobotOkResponse | UptimeRobotFailResponse;

async function callUptimeRobot(
  method: string,
  apiKey: string,
  params: Record<string, string>
): Promise<{ ok: true; data: UptimeRobotOkResponse } | { ok: false; error: string; errorType?: string }> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ api_key: apiKey, format: "json", ...params }),
      // Le chiamate a Observability sono lette dal Gestionale con una cache
      // applicativa breve (vedi src/lib/gestionale/observability.ts): qui
      // disabilitiamo comunque la cache di fetch/Next per non sovrapporne
      // una seconda, non controllata, sopra quella.
      cache: "no-store",
    });
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Errore di rete verso UptimeRobot" };
  }

  const body = (await response.json().catch(() => null)) as UptimeRobotResponse | null;
  if (!body) {
    return { ok: false, error: `UptimeRobot ha risposto con status ${response.status} (corpo non leggibile)` };
  }
  if (body.stat !== "ok") {
    return {
      ok: false,
      error: body.error?.message ?? `UptimeRobot ha rifiutato la richiesta (${method})`,
      errorType: body.error?.type,
    };
  }
  return { ok: true, data: body };
}

/**
 * Il messaggio grezzo di UptimeRobot (in inglese, es. "You are not allowed
 * to use some settings with your current plan") non deve mai arrivare al
 * cliente: lo si logga qui per il debug e si restituisce un messaggio
 * onesto ma comprensibile in italiano al chiamante.
 */
function logProviderError(operation: string, rawError: string) {
  console.error(`[uptimerobot] ${operation} fallita: ${rawError}`);
}

/** Crea un monitor HTTP(s) su UptimeRobot per l'URL indicato. */
export async function createMonitor(
  url: string,
  friendlyName: string
): Promise<{ ok: true; monitorId: string } | { ok: false; error: string }> {
  const apiKey = getUptimeRobotApiKey();
  if (!apiKey) return { ok: false, error: "UPTIMEROBOT_API_KEY non configurata" };

  // Parametri ridotti al minimo indispensabile — monitor HTTP(s) semplice,
  // nessun alert_contact, nessuna opzione avanzata. Niente `interval`:
  // sui piani free piu' recenti di UptimeRobot anche un valore "sicuro"
  // come 300s puo' essere rifiutato con "You are not allowed to use some
  // settings with your current plan" perche' l'intervallo personalizzato
  // via API e' riservato al piano Pro di UptimeRobot — omettendolo,
  // UptimeRobot applica l'intervallo di default consentito dall'account.
  const result = await callUptimeRobot("newMonitor", apiKey, {
    type: "1", // HTTP(s)
    url,
    friendly_name: friendlyName,
  });
  if (!result.ok) {
    logProviderError("newMonitor", result.error);
    return { ok: false, error: "Impossibile configurare il monitoring al momento, riprova piu' tardi." };
  }

  const monitor = result.data.monitor as { id?: number } | undefined;
  if (!monitor?.id) {
    logProviderError("newMonitor", "risposta priva di monitor.id nonostante stat=ok");
    return { ok: false, error: "Impossibile configurare il monitoring al momento, riprova piu' tardi." };
  }
  return { ok: true, monitorId: String(monitor.id) };
}

/** Elimina un monitor su UptimeRobot. Idempotente lato chiamante: un fallimento va loggato ma non deve bloccare l'operazione che lo ha richiesto (es. eliminazione del sito). */
export async function deleteMonitor(monitorId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const apiKey = getUptimeRobotApiKey();
  if (!apiKey) return { ok: false, error: "UPTIMEROBOT_API_KEY non configurata" };

  const result = await callUptimeRobot("deleteMonitor", apiKey, { id: monitorId });
  if (!result.ok) {
    // Un monitor gia' inesistente (rimosso a mano su UptimeRobot) va trattato
    // come eliminato: l'obiettivo, che non ne resti uno orfano, e' raggiunto.
    if (result.errorType === "not_found" || /not\s+found|does\s+not\s+exist/i.test(result.error)) {
      return { ok: true };
    }
    logProviderError("deleteMonitor", result.error);
    return { ok: false, error: "Impossibile eliminare il monitor di uptime al momento." };
  }
  return { ok: true };
}

/** Stato live di un monitor: uptime reale, ultimo tempo di risposta rilevato, incidenti recenti. Nessun dato stimato: se un campo non arriva da UptimeRobot resta null. */
export async function getMonitorSnapshot(
  monitorId: string
): Promise<{ ok: true; monitor: MonitorSnapshot } | { ok: false; error: string }> {
  const apiKey = getUptimeRobotApiKey();
  if (!apiKey) return { ok: false, error: "UPTIMEROBOT_API_KEY non configurata" };

  const result = await callUptimeRobot("getMonitors", apiKey, {
    monitors: monitorId,
    response_times: "1",
    response_times_limit: "1",
    logs: "1",
    logs_limit: "5",
    custom_uptime_ratios: "30",
  });
  if (!result.ok) {
    logProviderError("getMonitors", result.error);
    return { ok: false, error: "Impossibile leggere lo stato del monitoring al momento, riprova piu' tardi." };
  }

  const monitors = result.data.monitors as
    | {
        id: number;
        url: string;
        status: number;
        custom_uptime_ratio?: string;
        response_times?: { datetime: number; value: number }[];
        logs?: { type: number; datetime: number; duration?: number }[];
      }[]
    | undefined;
  const raw = monitors?.[0];
  if (!raw) return { ok: false, error: "Monitor non trovato su UptimeRobot (potrebbe essere stato eliminato manualmente)" };

  const uptimeRatio30d = raw.custom_uptime_ratio ? Number.parseFloat(raw.custom_uptime_ratio) : null;
  const lastResponseTimeMs = raw.response_times?.[0]?.value ?? null;
  const incidents: MonitorIncident[] = (raw.logs ?? []).map((log) => ({
    kind: mapLogType(log.type),
    at: new Date(log.datetime * 1000).toISOString(),
    durationSeconds: typeof log.duration === "number" ? log.duration : null,
  }));

  return {
    ok: true,
    monitor: {
      monitorId: String(raw.id),
      url: raw.url,
      status: mapMonitorStatus(raw.status),
      uptimeRatio30d: Number.isFinite(uptimeRatio30d) ? uptimeRatio30d : null,
      lastResponseTimeMs,
      incidents,
    },
  };
}
