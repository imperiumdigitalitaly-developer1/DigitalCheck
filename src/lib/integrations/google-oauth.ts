export type GoogleOAuthProvider = "analytics" | "search-console";

export function isGoogleOAuthProvider(value: string): value is GoogleOAuthProvider {
  return value === "analytics" || value === "search-console";
}

interface ProviderEnvConfig {
  clientIdEnv: string;
  clientSecretEnv: string;
  scope: string;
}

const PROVIDER_ENV_CONFIG: Record<GoogleOAuthProvider, ProviderEnvConfig> = {
  analytics: {
    clientIdEnv: "GOOGLE_ANALYTICS_CLIENT_ID",
    clientSecretEnv: "GOOGLE_ANALYTICS_CLIENT_SECRET",
    scope: "https://www.googleapis.com/auth/analytics.readonly",
  },
  "search-console": {
    clientIdEnv: "GOOGLE_SEARCH_CONSOLE_CLIENT_ID",
    clientSecretEnv: "GOOGLE_SEARCH_CONSOLE_CLIENT_SECRET",
    scope: "https://www.googleapis.com/auth/webmasters.readonly",
  },
};

export interface GoogleOAuthCredentials {
  clientId: string;
  clientSecret: string;
  scope: string;
}

/**
 * Le credenziali sono quelle dell'app OAuth di Imperium Digital, registrata
 * una sola volta su Google Cloud Console (una per Analytics, una per Search
 * Console). Ogni cliente autorizza comunque il proprio account Google contro
 * questa app: il token risultante viene salvato per singolo sito
 * (AnalyticsConnection/SearchConsoleConnection hanno siteId @unique), mai
 * condiviso tra siti o clienti diversi. Ritorna null se le variabili
 * d'ambiente non sono configurate, cosi' il chiamante puo' restare
 * "Connessione richiesta" invece di rompersi.
 */
export function getGoogleOAuthCredentials(provider: GoogleOAuthProvider): GoogleOAuthCredentials | null {
  const config = PROVIDER_ENV_CONFIG[provider];
  const clientId = process.env[config.clientIdEnv];
  const clientSecret = process.env[config.clientSecretEnv];
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret, scope: config.scope };
}

export function buildGoogleAuthorizationUrl(params: {
  credentials: GoogleOAuthCredentials;
  redirectUri: string;
  state: string;
}): string {
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", params.credentials.clientId);
  url.searchParams.set("redirect_uri", params.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", params.credentials.scope);
  // access_type=offline + prompt=consent: garantisce un refresh_token a ogni
  // autorizzazione (non solo alla primissima), necessario perche' ogni sito
  // ha una propria connessione indipendente da poter rinnovare.
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("include_granted_scopes", "true");
  url.searchParams.set("state", params.state);
  return url.toString();
}

export interface GoogleTokenResult {
  accessToken: string;
  refreshToken: string | null;
  expiresIn: number;
}

export async function exchangeGoogleAuthCode(params: {
  code: string;
  credentials: GoogleOAuthCredentials;
  redirectUri: string;
}): Promise<{ ok: true; tokens: GoogleTokenResult } | { ok: false; error: string }> {
  try {
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code: params.code,
        client_id: params.credentials.clientId,
        client_secret: params.credentials.clientSecret,
        redirect_uri: params.redirectUri,
        grant_type: "authorization_code",
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      return { ok: false, error: `Google ha risposto con status ${response.status}: ${body.slice(0, 300)}` };
    }

    const data = (await response.json()) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
    };
    if (!data.access_token) {
      return { ok: false, error: "Risposta di Google priva di access_token" };
    }
    return {
      ok: true,
      tokens: {
        accessToken: data.access_token,
        refreshToken: data.refresh_token ?? null,
        expiresIn: data.expires_in ?? 3600,
      },
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Errore sconosciuto durante lo scambio del code",
    };
  }
}

export interface GoogleRefreshResult {
  accessToken: string;
  expiresIn: number;
}

/**
 * Rinnova un access token scaduto usando il refresh_token salvato
 * (grant_type=refresh_token). Condiviso da tutte le integrazioni Google
 * (Analytics, Search Console, eventuali future): la logica di "quando"
 * chiamarlo e di persistenza vive in src/lib/gestionale/google-connection.ts,
 * qui c'e' solo la chiamata OAuth pura.
 *
 * `invalidGrant: true` distingue il caso in cui il refresh token stesso
 * non e' piu' valido (revocato dall'utente su Google, o scaduto per
 * inattivita' prolungata) — in quel caso non ha senso riprovare, serve
 * ricollegare l'account da capo.
 */
export async function refreshGoogleAccessToken(params: {
  refreshToken: string;
  credentials: GoogleOAuthCredentials;
}): Promise<{ ok: true; result: GoogleRefreshResult } | { ok: false; error: string; invalidGrant: boolean }> {
  try {
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        refresh_token: params.refreshToken,
        client_id: params.credentials.clientId,
        client_secret: params.credentials.clientSecret,
        grant_type: "refresh_token",
      }),
    });

    const data = (await response.json().catch(() => null)) as
      | { access_token?: string; expires_in?: number; error?: string }
      | null;

    if (!response.ok || !data?.access_token) {
      const invalidGrant = data?.error === "invalid_grant";
      return {
        ok: false,
        invalidGrant,
        error: data?.error
          ? `Google ha rifiutato il refresh (${data.error})`
          : `Google ha risposto con status ${response.status} durante il refresh`,
      };
    }

    return { ok: true, result: { accessToken: data.access_token, expiresIn: data.expires_in ?? 3600 } };
  } catch (err) {
    return {
      ok: false,
      invalidGrant: false,
      error: err instanceof Error ? err.message : "Errore di rete durante il refresh del token Google",
    };
  }
}
