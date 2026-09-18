import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getCurrentSession } from "@/lib/auth/session";
import {
  isGoogleOAuthProvider,
  getGoogleOAuthCredentials,
  exchangeGoogleAuthCode,
} from "@/lib/integrations/google-oauth";
import { verifyOAuthState } from "@/lib/integrations/oauth-state";
import { reconcileSelectedProperty } from "@/lib/gestionale/search-console";
import { reconcileSelectedAnalyticsProperty } from "@/lib/gestionale/analytics";

function tabFor(provider: string): string {
  return provider === "analytics" ? "analytics" : "search-console";
}

/**
 * Riceve il code di Google, verifica lo state firmato (userId/siteId
 * coerenti con la sessione corrente e con il sito che deve restare di
 * proprieta' dell'utente) e scrive il token sulla riga di
 * AnalyticsConnection/SearchConsoleConnection del solo sito indicato dallo
 * state, mai su altri siti dello stesso cliente o di clienti diversi.
 */
export async function GET(request: NextRequest, { params }: { params: { provider: string } }) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;
  const gestionaleUrl = new URL("/dashboard/gestionale", appUrl);

  if (!isGoogleOAuthProvider(params.provider)) {
    return NextResponse.json({ error: "Provider non valido" }, { status: 404 });
  }
  const provider = params.provider;
  gestionaleUrl.searchParams.set("tab", tabFor(provider));

  const searchParams = request.nextUrl.searchParams;
  if (searchParams.get("error")) {
    gestionaleUrl.searchParams.set("oauth_error", "denied");
    return NextResponse.redirect(gestionaleUrl);
  }

  const code = searchParams.get("code");
  const state = searchParams.get("state");
  if (!code || !state) {
    gestionaleUrl.searchParams.set("oauth_error", "invalid_request");
    return NextResponse.redirect(gestionaleUrl);
  }

  const session = await getCurrentSession();
  if (!session) {
    const loginUrl = new URL("/login", appUrl);
    loginUrl.searchParams.set("next", "/dashboard/gestionale");
    return NextResponse.redirect(loginUrl);
  }

  const statePayload = await verifyOAuthState(state, provider);
  if (!statePayload || statePayload.userId !== session.userId) {
    gestionaleUrl.searchParams.set("oauth_error", "invalid_state");
    return NextResponse.redirect(gestionaleUrl);
  }

  const site = await prisma.site.findUnique({ where: { id: statePayload.siteId } });
  if (!site || site.ownerId !== session.userId) {
    gestionaleUrl.searchParams.set("oauth_error", "site_not_found");
    return NextResponse.redirect(gestionaleUrl);
  }

  const credentials = getGoogleOAuthCredentials(provider);
  if (!credentials) {
    gestionaleUrl.searchParams.set("oauth_error", "not_configured");
    return NextResponse.redirect(gestionaleUrl);
  }

  const redirectUri = new URL(`/api/gestionale/connections/${provider}/callback`, appUrl).toString();
  const result = await exchangeGoogleAuthCode({ code, credentials, redirectUri });
  if (!result.ok) {
    gestionaleUrl.searchParams.set("oauth_error", "exchange_failed");
    return NextResponse.redirect(gestionaleUrl);
  }

  // La scadenza dell'access token serve al refresh proattivo (vedi
  // getValidSearchConsoleToken / getValidAnalyticsToken).
  const tokenData = {
    connected: true,
    accessToken: result.tokens.accessToken,
    accessTokenExpiresAt: new Date(Date.now() + result.tokens.expiresIn * 1000),
    connectedAt: new Date(),
    ...(result.tokens.refreshToken ? { refreshToken: result.tokens.refreshToken } : {}),
  };

  if (provider === "analytics") {
    await prisma.analyticsConnection.upsert({
      where: { siteId: site.id },
      create: { siteId: site.id, ...tokenData },
      update: tokenData,
    });
    await reconcileSelectedAnalyticsProperty(site.id, result.tokens.accessToken);
  } else {
    await prisma.searchConsoleConnection.upsert({
      where: { siteId: site.id },
      create: { siteId: site.id, ...tokenData },
      update: tokenData,
    });
    await reconcileSelectedProperty(site.id, result.tokens.accessToken);
  }

  gestionaleUrl.searchParams.set("siteId", site.id);
  gestionaleUrl.searchParams.set("connected", "1");
  return NextResponse.redirect(gestionaleUrl);
}
