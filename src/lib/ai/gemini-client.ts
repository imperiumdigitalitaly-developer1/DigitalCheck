export interface GeminiCallResult {
  text: string | null;
  errorReason?: string;
}

/**
 * La quota Gemini e' condivisa tra tutte le funzioni AI del sito. Le
 * chiamate "low" (oggi solo il widget di scansione pubblico, non
 * autenticato) non devono poterla saturare a scapito di AI Assistant e
 * Report/PDF, che restano "high" (default) e non vengono mai limitate qui.
 *
 * Stato in-memory per istanza (stesso limite gia' accettato dai rate limit
 * delle route pubbliche): su piu' istanze serverless il tetto e' per
 * istanza, quindi e' una protezione best-effort, non un limite globale.
 */
export type GeminiPriority = "high" | "low";

const LOW_PRIORITY_MAX_PER_MINUTE = Number(process.env.AI_LOW_PRIORITY_MAX_PER_MINUTE ?? 3);
const QUOTA_COOLDOWN_MS = 60_000;
let quotaCooldownUntil = 0;
const lowPriorityCalls: number[] = [];

function lowPriorityBlockedReason(): string | null {
  const now = Date.now();
  if (now < quotaCooldownUntil) {
    return "servizio AI momentaneamente sovraccarico, riprova tra qualche minuto";
  }
  while (lowPriorityCalls.length > 0 && now - (lowPriorityCalls[0] ?? now) >= 60_000) lowPriorityCalls.shift();
  if (lowPriorityCalls.length >= LOW_PRIORITY_MAX_PER_MINUTE) {
    return "servizio AI momentaneamente occupato, riprova tra qualche minuto";
  }
  lowPriorityCalls.push(now);
  return null;
}

// Errori temporanei del provider (503 = "high demand", 429 = rate limit):
// le chiamate ad alta priorita' (analisi Report/PDF, AI Assistant) li
// ritentano con un breve backoff prima di arrendersi. Le chiamate "low"
// (widget pubblico) non ritentano mai, per non aggiungere carico a un
// provider gia' saturo. Ogni tentativo ha il proprio timeout.
const RETRYABLE_STATUSES = new Set([429, 503]);
const RETRY_DELAYS_MS = [2_000, 5_000]; // 3 tentativi totali

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

interface AttemptOutcome {
  result: GeminiCallResult;
  retryable: boolean;
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
      // 429 = quota esaurita: da qui le chiamate "low" si fermano per un
      // minuto invece di continuare a martellare un provider gia' saturo.
      if (response.status === 429) quotaCooldownUntil = Date.now() + QUOTA_COOLDOWN_MS;
      const errorBody = await response.text().catch(() => "");
      return {
        result: {
          text: null,
          errorReason: `Il provider AI ha risposto con status ${response.status}: ${errorBody.slice(0, 300)}`,
        },
        retryable: RETRYABLE_STATUSES.has(response.status),
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
        result: { text: null, errorReason: "Risposta del provider AI priva di contenuto testuale" },
        retryable: false,
      };
    }
    return { result: { text }, retryable: false };
  } catch (err) {
    return {
      result: {
        text: null,
        errorReason: err instanceof Error ? err.message : "Errore sconosciuto durante la chiamata AI",
      },
      retryable: false,
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function callGemini(
  system: string,
  user: string,
  options?: { timeoutMs?: number; priority?: GeminiPriority; json?: boolean }
): Promise<GeminiCallResult> {
  const apiKey = process.env.AI_API_KEY;
  if (!apiKey) {
    return { text: null, errorReason: "Nessun provider AI configurato (AI_API_KEY assente)." };
  }

  if (options?.priority === "low") {
    const blocked = lowPriorityBlockedReason();
    if (blocked) return { text: null, errorReason: blocked };
  }

  const model = process.env.AI_MODEL || "gemini-3.6-flash";
  const maxAttempts = options?.priority === "low" ? 1 : RETRY_DELAYS_MS.length + 1;

  let attempts = 1;
  let outcome = await requestOnce(apiKey, model, system, user, options);
  while (!outcome.result.text && outcome.retryable && attempts < maxAttempts) {
    const delay = RETRY_DELAYS_MS[attempts - 1] ?? 0;
    console.warn(
      `[gemini-client] ${outcome.result.errorReason} - nuovo tentativo ${attempts + 1}/${maxAttempts} tra ${delay / 1000}s`
    );
    await sleep(delay);
    attempts++;
    outcome = await requestOnce(apiKey, model, system, user, options);
  }
  if (!outcome.result.text && attempts > 1) {
    outcome.result.errorReason = `${outcome.result.errorReason} (dopo ${attempts} tentativi)`;
  }
  return outcome.result;
}
