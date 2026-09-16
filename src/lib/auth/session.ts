import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";

export const SESSION_COOKIE_NAME = "dc_session";
const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 7; // 7 giorni

export interface SessionPayload {
  userId: string;
  email: string;
  isAdmin: boolean;
}

function getSecretKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error(
      "AUTH_SECRET non configurato: necessario per firmare le sessioni. Vedi .env.example."
    );
  }
  return new TextEncoder().encode(secret);
}

export async function createSessionToken(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION_SECONDS}s`)
    .sign(getSecretKey());
}

/**
 * Verifica il JWT senza alcuna chiamata al database — per questo e'
 * sicuro da usare nel middleware (che gira su Edge runtime, dove
 * Prisma non e' disponibile). Il payload (incluso isAdmin) riflette lo
 * stato dell'utente al momento del login: se un ruolo cambia, l'utente
 * dovra' rifare login perche' il cambiamento sia effettivo. Per un
 * controllo sempre aggiornato sui permessi critici, ricontrolla anche
 * lato server/DB nella route stessa (vedi /admin).
 */
export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    if (
      typeof payload.userId === "string" &&
      typeof payload.email === "string" &&
      typeof payload.isAdmin === "boolean"
    ) {
      return { userId: payload.userId, email: payload.email, isAdmin: payload.isAdmin };
    }
    return null;
  } catch {
    return null;
  }
}

export function getSessionFromRequest(request: NextRequest): string | null {
  return request.cookies.get(SESSION_COOKIE_NAME)?.value ?? null;
}

/** Da usare in Server Component / route handler (App Router). */
export async function getCurrentSession(): Promise<SessionPayload | null> {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

export const sessionCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: SESSION_DURATION_SECONDS,
};
