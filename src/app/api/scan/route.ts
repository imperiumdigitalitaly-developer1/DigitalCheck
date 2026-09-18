import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth/session";

/**
 * Era lo scan pubblico e stateless del widget della landing. Ora ogni
 * analisi richiede un account ed e' tracciata: si esegue solo da
 * /api/sites/[id]/scan, che la salva e applica i limiti del piano.
 *
 * La route resta come stub esplicito invece di sparire:
 * - senza sessione risponde 401, cosi' nessuna analisi parte in anonimo;
 * - con sessione risponde 410, perche' riattivarla per gli utenti
 *   autenticati darebbe analisi non salvate e fuori dai limiti del piano.
 */
export async function POST() {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json(
      { error: "Per analizzare un sito serve un account: accedi o registrati.", errorCode: "AUTH_REQUIRED" },
      { status: 401 }
    );
  }
  return NextResponse.json(
    { error: "Questa route non e' piu' disponibile: avvia l'analisi dalla dashboard.", errorCode: "GONE" },
    { status: 410 }
  );
}
