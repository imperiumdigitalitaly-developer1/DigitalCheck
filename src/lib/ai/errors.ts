export type AiErrorKind = "quota" | "overloaded" | "timeout" | "auth" | "model" | "unknown";

/**
 * Errore tipizzato del provider AI: il dettaglio grezzo (status, corpo
 * della risposta) resta SOLO su questo oggetto, mai nel messaggio verso il
 * cliente — quello arriva esclusivamente da aiErrorClientMessage(). Vedi
 * gemini-client.ts per come viene costruito e classificato.
 */
export class AiError extends Error {
  readonly kind: AiErrorKind;
  readonly status?: number;
  readonly rawDetail?: string;
  /** Solo per kind "quota": secondi di attesa indicati dal provider (RetryInfo), se presenti. */
  readonly retryDelaySeconds?: number;

  constructor(
    kind: AiErrorKind,
    message: string,
    opts?: { status?: number; rawDetail?: string; retryDelaySeconds?: number }
  ) {
    super(message);
    this.name = "AiError";
    this.kind = kind;
    this.status = opts?.status;
    this.rawDetail = opts?.rawDetail;
    this.retryDelaySeconds = opts?.retryDelaySeconds;
  }
}

// Messaggi cordiali e professionali per il cliente: mai lo status HTTP o il
// corpo della risposta del provider. "quota" e "overloaded"/"timeout" hanno
// testi diversi perche' implicano un'attesa diversa (quota si rinnova a
// finestra fissa, sovraccarico e' tipicamente questione di secondi/minuti).
const CLIENT_MESSAGES: Record<AiErrorKind, string> = {
  quota: "L'assistente AI ha raggiunto il limite di utilizzo per il momento. Riprova tra qualche minuto.",
  overloaded: "L'assistente AI è momentaneamente molto richiesto. Riprova tra poco.",
  timeout: "L'assistente AI è momentaneamente molto richiesto. Riprova tra poco.",
  auth: "L'assistente AI non è disponibile in questo momento. Il nostro team è stato avvisato.",
  model: "L'assistente AI non è disponibile in questo momento. Il nostro team è stato avvisato.",
  unknown: "L'assistente AI non è disponibile in questo momento. Il nostro team è stato avvisato.",
};

export function aiErrorClientMessage(kind: AiErrorKind): string {
  return CLIENT_MESSAGES[kind];
}

/** Status HTTP da restituire al client per ciascun tipo di errore: solo 429 o 503, mai il codice grezzo del provider. */
export function aiErrorHttpStatus(kind: AiErrorKind): 429 | 503 {
  return kind === "quota" ? 429 : 503;
}
