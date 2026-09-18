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

export async function callGemini(
  system: string,
  user: string,
  options?: { timeoutMs?: number; priority?: GeminiPriority }
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
        }),
      }
    );

    if (!response.ok) {
      // 429 = quota esaurita: da qui le chiamate "low" si fermano per un
      // minuto invece di continuare a martellare un provider gia' saturo.
      if (response.status === 429) quotaCooldownUntil = Date.now() + QUOTA_COOLDOWN_MS;
      const errorBody = await response.text().catch(() => "");
      return {
        text: null,
        errorReason: `Il provider AI ha risposto con status ${response.status}: ${errorBody.slice(0, 300)}`,
      };
    }

    const data = (await response.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      return { text: null, errorReason: "Risposta del provider AI priva di contenuto testuale" };
    }
    return { text };
  } catch (err) {
    return {
      text: null,
      errorReason: err instanceof Error ? err.message : "Errore sconosciuto durante la chiamata AI",
    };
  } finally {
    clearTimeout(timer);
  }
}
