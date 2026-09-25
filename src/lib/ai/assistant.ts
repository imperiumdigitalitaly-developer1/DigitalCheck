import { callGemini } from "./gemini-client";
import type { AiErrorKind } from "./errors";

export interface AssistantResult {
  answer: string | null;
  errorKind?: AiErrorKind;
}

const SYSTEM_PROMPT = [
  "Sei l'assistente virtuale di DigitalCheck, un servizio che analizza siti web di piccole attivita' (B&B, ristoranti, negozi, professionisti) e produce un Digital Score con consigli pratici per migliorare il sito.",
  "Rispondi a domande su come funziona il servizio, sui piani disponibili (Free gratuito con analisi di base; Pro a 6,99 euro/mese con analisi complete, monitoraggio automatico, storico, PDF, assistente AI per sito e richiesta di intervento diretto), su come registrarsi, o domande generali su come migliorare un sito web (SEO, performance, conversione).",
  "Non hai accesso ai dati personali o ai punteggi specifici del sito dell'utente in questa conversazione: se te lo chiedono, invitali gentilmente ad accedere alla loro dashboard.",
  "Rispondi in italiano, in modo breve, cordiale e diretto — poche frasi, non un saggio.",
].join(" ");

export interface ChatTurn {
  role: "user" | "assistant";
  text: string;
}

export async function askAssistant(message: string, history: ChatTurn[]): Promise<AssistantResult> {
  const transcript = history
    .slice(-6)
    .map((h) => `${h.role === "user" ? "Utente" : "Assistente"}: ${h.text}`)
    .join("\n");
  const user = transcript ? `${transcript}\nUtente: ${message}` : `Utente: ${message}`;

  const result = await callGemini(SYSTEM_PROMPT, user, { timeoutMs: 20_000 });
  if (!result.text) {
    return { answer: null, errorKind: result.error?.kind ?? "unknown" };
  }
  return { answer: result.text };
}
