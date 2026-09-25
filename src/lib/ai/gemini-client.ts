import { AiError, type AiErrorKind } from "./errors";

export interface GeminiCallResult {
  text: string | null;
  error?: AiError;
}

// Backoff esponenziale SOLO per errori di sovraccarico/timeout (500/503):
// max 2 tentativi aggiuntivi (3 chiamate totali). I 429 (quota) NON rientrano
// qui: hanno una politica dedicata (vedi RETRY_DELAY_CAP_MS sotto) perche'
// ritentare un rate limit senza che il provider lo richieda esplicitamente
// consuma altra quota inutilmente invece di risparmiarla.
const OVERLOAD_RETRY_DELAYS_MS = [2_000, 5_000];

// Un 429 va ritentato SOLO se il provider stesso indica un retryDelay breve
// (RetryInfo): mai un retry "a scommessa" su un rate limit.
const RETRY_DELAY_CAP_MS = 10_000;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function classifyStatus(status: number): AiErrorKind {
  if (status === 429) return "quota";
  if (status === 500 || status === 503) return "overloaded";
  if (status === 401 || status === 403) return "auth";
  if (status === 404) return "model";
  return "unknown";
}

/**
 * Estrae il RetryInfo.retryDelay da un corpo di errore 429 di Google
 * (formato "19s" / "0.5s" dentro error.details[]). Ritorna i secondi se
 * presente e numerico, altrimenti null — mai un valore inventato.
 */
function parseRetryDelaySeconds(errorBody: string): number | null {
  try {
    const parsed = JSON.parse(errorBody) as {
      error?: { details?: { "@type"?: string; retryDelay?: string }[] };
    };
    const detail = parsed.error?.details?.find((d) => typeof d.retryDelay === "string");
    const match = detail?.retryDelay?.match(/^(\d+(?:\.\d+)?)s$/);
    return match ? Number(match[1]) : null;
  } catch {
    return null;
  }
}

interface AttemptOutcome {
  text: string | null;
  error?: AiError;
}

async function requestOnce(
  apiKey: string,
  model: string,
  system: string,
  user: string,
  options?: { timeoutMs?: number; json?: boolean }
): Promise<AttemptOutcome> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options?.timeoutMs ?? 20_000);

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: user }] }],
          systemInstruction: { parts: [{ text: system }] },
          // Solo per le chiamate che si aspettano JSON (analisi dei
          // contenuti): assistente e advisor rispondono in testo libero.
          ...(options?.json ? { generationConfig: { responseMimeType: "application/json" } } : {}),
        }),
      }
    );

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "");
      const kind = classifyStatus(response.status);
      const retryDelaySeconds = kind === "quota" ? parseRetryDelaySeconds(errorBody) : null;
      return {
        text: null,
        error: new AiError(kind, `Provider AI: status ${response.status}`, {
          status: response.status,
          rawDetail: errorBody.slice(0, 500),
          retryDelaySeconds: retryDelaySeconds ?? undefined,
        }),
      };
    }

    const data = (await response.json()) as {
      candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] } }[];
    };
    // Gemini puo' spezzare la risposta in piu' parti (e i modelli con
    // "thinking" possono anteporre parti di ragionamento): si concatena il
    // testo di tutte le parti di risposta, non solo della prima.
    const text = (data.candidates?.[0]?.content?.parts ?? [])
      .filter((part) => !part.thought)
      .map((part) => part.text ?? "")
      .join("");
    if (!text) {
      return {
        text: null,
        error: new AiError("unknown", "Risposta del provider AI priva di contenuto testuale"),
      };
    }
    return { text };
  } catch (err) {
    const isAbort = err instanceof Error && err.name === "AbortError";
    return {
      text: null,
      error: new AiError(isAbort ? "timeout" : "unknown", isAbort ? "Timeout della chiamata AI" : "Errore di rete durante la chiamata AI", {
        rawDetail: err instanceof Error ? err.message : String(err),
      }),
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function callGemini(
  system: string,
  user: string,
  options?: { timeoutMs?: number; json?: boolean }
): Promise<GeminiCallResult> {
  const apiKey = process.env.AI_API_KEY;
  if (!apiKey) {
    return {
      text: null,
      error: new AiError("unknown", "Nessun provider AI configurato", { rawDetail: "AI_API_KEY assente" }),
    };
  }

  const model = process.env.AI_MODEL || "gemini-3.6-flash";

  let outcome = await requestOnce(apiKey, model, system, user, options);
  if (outcome.text) return outcome;

  const errorBody = outcome.error!;

  // 429 (quota): NESSUN retry, salvo un'unica eccezione — il provider stesso
  // indica un'attesa breve (<=10s) tramite RetryInfo. Un solo tentativo in
  // piu', mai una serie di backoff su un rate limit (consumerebbe altra
  // quota condivisa inutilmente).
  if (errorBody.kind === "quota") {
    const retryDelaySeconds = errorBody.retryDelaySeconds;
    if (retryDelaySeconds != null && retryDelaySeconds * 1000 <= RETRY_DELAY_CAP_MS) {
      console.warn(`[gemini-client] 429 con retryDelay=${retryDelaySeconds}s: un solo retry dopo l'attesa indicata`);
      await sleep(retryDelaySeconds * 1000);
      outcome = await requestOnce(apiKey, model, system, user, options);
    }
    if (!outcome.text) console.error(`[gemini-client] chiamata AI fallita (${outcome.error!.kind}): ${outcome.error!.rawDetail ?? outcome.error!.message}`);
    return outcome;
  }

  // 500/503/timeout: backoff esponenziale, max 2 tentativi aggiuntivi.
  if (errorBody.kind === "overloaded" || errorBody.kind === "timeout") {
    let attempt = 0;
    while (!outcome.text && attempt < OVERLOAD_RETRY_DELAYS_MS.length) {
      const delay = OVERLOAD_RETRY_DELAYS_MS[attempt] ?? 2_000;
      console.warn(
        `[gemini-client] ${outcome.error!.kind} - nuovo tentativo ${attempt + 2}/${OVERLOAD_RETRY_DELAYS_MS.length + 1} tra ${delay / 1000}s`
      );
      await sleep(delay);
      attempt++;
      outcome = await requestOnce(apiKey, model, system, user, options);
    }
    if (!outcome.text) console.error(`[gemini-client] chiamata AI fallita (${outcome.error!.kind}): ${outcome.error!.rawDetail ?? outcome.error!.message}`);
    return outcome;
  }

  // auth/model/unknown: mai un retry (un errore di configurazione non si
  // risolve riprovando).
  console.error(`[gemini-client] chiamata AI fallita (${errorBody.kind}): ${errorBody.rawDetail ?? errorBody.message}`);
  return outcome;
}
