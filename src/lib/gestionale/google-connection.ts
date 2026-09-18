import { prisma } from "@/lib/db/prisma";
import {
  getGoogleOAuthCredentials,
  refreshGoogleAccessToken,
  type GoogleOAuthProvider,
} from "@/lib/integrations/google-oauth";

const REFRESH_BUFFER_MS = 60_000; // rinnova un po' prima della scadenza reale, non esattamente allo scadere

export interface TokenState {
  connected: boolean;
  accessToken: string | null;
  refreshToken: string | null;
  accessTokenExpiresAt: Date | null;
}

export type ValidTokenResult =
  | { ok: true; accessToken: string }
  | { ok: false; error: string; reauthRequired: boolean };

/**
 * Restituisce un access token Google valido, rinnovandolo se necessario.
 * Condivisa da Search Console e Analytics: la differenza tra
 * le due integrazioni e' solo QUALE riga di connessione leggere/scrivere,
 * passata qui tramite le due funzioni onRefreshed/onReauthRequired cosi'
 * questa funzione non deve conoscere Prisma ne' i due modelli diversi.
 *
 * `reauthRequired: true` significa che l'utente deve ricollegare
 * l'account da capo (refresh token assente, revocato o scaduto per
 * inattivita' prolungata) — non ha senso ritentare automaticamente.
 */
export async function resolveGoogleAccessToken(
  provider: GoogleOAuthProvider,
  state: TokenState,
  onRefreshed: (accessToken: string, expiresAt: Date) => Promise<void>,
  onReauthRequired: () => Promise<void>
): Promise<ValidTokenResult> {
  if (!state.connected || !state.accessToken) {
    return { ok: false, error: "Nessuna connessione attiva per questo sito.", reauthRequired: true };
  }

  const stillValid = state.accessTokenExpiresAt && state.accessTokenExpiresAt.getTime() - REFRESH_BUFFER_MS > Date.now();
  if (stillValid) return { ok: true, accessToken: state.accessToken };

  if (!state.refreshToken) {
    await onReauthRequired();
    return {
      ok: false,
      reauthRequired: true,
      error: "Il token e' scaduto e non e' disponibile un refresh token: e' necessario ricollegare l'account.",
    };
  }

  const credentials = getGoogleOAuthCredentials(provider);
  if (!credentials) {
    return { ok: false, reauthRequired: false, error: "Credenziali OAuth non configurate lato server." };
  }

  const refreshed = await refreshGoogleAccessToken({ refreshToken: state.refreshToken, credentials });
  if (!refreshed.ok) {
    if (refreshed.invalidGrant) await onReauthRequired();
    return {
      ok: false,
      reauthRequired: refreshed.invalidGrant,
      error: refreshed.invalidGrant
        ? "L'autorizzazione di Google e' scaduta o e' stata revocata: e' necessario ricollegare l'account."
        : "Impossibile rinnovare la connessione a Google al momento, riprova piu' tardi.",
    };
  }

  const expiresAt = new Date(Date.now() + refreshed.result.expiresIn * 1000);
  await onRefreshed(refreshed.result.accessToken, expiresAt);
  return { ok: true, accessToken: refreshed.result.accessToken };
}

/** Access token valido per Search Console, con refresh e persistenza automatici. */
export async function getValidSearchConsoleToken(siteId: string): Promise<ValidTokenResult> {
  const connection = await prisma.searchConsoleConnection.findUnique({ where: { siteId } });
  if (!connection) return { ok: false, error: "Search Console non collegata per questo sito.", reauthRequired: true };

  return resolveGoogleAccessToken(
    "search-console",
    connection,
    async (accessToken, accessTokenExpiresAt) => {
      await prisma.searchConsoleConnection.update({ where: { siteId }, data: { accessToken, accessTokenExpiresAt } });
    },
    async () => {
      await prisma.searchConsoleConnection.update({ where: { siteId }, data: { connected: false } });
    }
  );
}

/** Access token valido per Google Analytics, con refresh e persistenza automatici. */
export async function getValidAnalyticsToken(siteId: string): Promise<ValidTokenResult> {
  const connection = await prisma.analyticsConnection.findUnique({ where: { siteId } });
  if (!connection) return { ok: false, error: "Google Analytics non collegato per questo sito.", reauthRequired: true };

  return resolveGoogleAccessToken(
    "analytics",
    connection,
    async (accessToken, accessTokenExpiresAt) => {
      await prisma.analyticsConnection.update({ where: { siteId }, data: { accessToken, accessTokenExpiresAt } });
    },
    async () => {
      await prisma.analyticsConnection.update({ where: { siteId }, data: { connected: false } });
    }
  );
}
