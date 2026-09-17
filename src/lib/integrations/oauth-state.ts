import { SignJWT, jwtVerify } from "jose";
import type { GoogleOAuthProvider } from "./google-oauth";

const STATE_DURATION_SECONDS = 10 * 60; // finestra ragionevole per completare il consenso su Google

interface OAuthStatePayload {
  userId: string;
  siteId: string;
  provider: GoogleOAuthProvider;
}

function getSecretKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("AUTH_SECRET non configurato: necessario per firmare lo state OAuth. Vedi .env.example.");
  }
  return new TextEncoder().encode(secret);
}

// Lo state e' un JWT firmato (stesso meccanismo del token di sessione, vedi
// lib/auth/session.ts) invece di una riga su DB: porta siteId/provider/userId
// in modo verificabile senza bisogno di persistere e ripulire record scaduti.
export async function createOAuthState(payload: OAuthStatePayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${STATE_DURATION_SECONDS}s`)
    .sign(getSecretKey());
}

/**
 * Verifica firma, scadenza e che il provider nello state corrisponda a
 * quello della callback che lo sta consumando (evita che uno state emesso
 * per Analytics venga riusato sulla callback di Search Console).
 */
export async function verifyOAuthState(
  token: string,
  expectedProvider: GoogleOAuthProvider
): Promise<OAuthStatePayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    if (
      typeof payload.userId === "string" &&
      typeof payload.siteId === "string" &&
      payload.provider === expectedProvider
    ) {
      return { userId: payload.userId, siteId: payload.siteId, provider: expectedProvider };
    }
    return null;
  } catch {
    return null;
  }
}
