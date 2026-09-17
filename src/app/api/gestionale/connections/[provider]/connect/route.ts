import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getCurrentSession } from "@/lib/auth/session";
import { getPlanFeatures } from "@/lib/billing/plan-config";
import {
  isGoogleOAuthProvider,
  getGoogleOAuthCredentials,
  buildGoogleAuthorizationUrl,
} from "@/lib/integrations/google-oauth";
import { createOAuthState } from "@/lib/integrations/oauth-state";

function tabFor(provider: string): string {
  return provider === "analytics" ? "analytics" : "search-console";
}

/**
 * Avvia il consenso OAuth Google per un sito specifico. Ogni sito ha una
 * propria connessione indipendente (vedi AnalyticsConnection/
 * SearchConsoleConnection, siteId @unique): il siteId viaggia nello state
 * firmato e viene riverificato nella callback prima di scrivere il token.
 */
export async function GET(request: NextRequest, { params }: { params: { provider: string } }) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;
  const gestionaleUrl = new URL("/dashboard/gestionale", appUrl);

  if (!isGoogleOAuthProvider(params.provider)) {
    return NextResponse.json({ error: "Provider non valido" }, { status: 404 });
  }
  const provider = params.provider;
  gestionaleUrl.searchParams.set("tab", tabFor(provider));

  const session = await getCurrentSession();
  if (!session) {
    const loginUrl = new URL("/login", appUrl);
    loginUrl.searchParams.set("next", request.nextUrl.pathname + request.nextUrl.search);
    return NextResponse.redirect(loginUrl);
  }

  const siteId = request.nextUrl.searchParams.get("siteId");
  if (!siteId) {
    gestionaleUrl.searchParams.set("oauth_error", "missing_site");
    return NextResponse.redirect(gestionaleUrl);
  }

  const [user, site] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: session.userId } }),
    prisma.site.findUnique({ where: { id: siteId } }),
  ]);

  if (!site || site.ownerId !== session.userId) {
    gestionaleUrl.searchParams.set("oauth_error", "site_not_found");
    return NextResponse.redirect(gestionaleUrl);
  }

  if (!getPlanFeatures(user.plan).dashboard) {
    gestionaleUrl.searchParams.set("oauth_error", "plan_required");
    return NextResponse.redirect(gestionaleUrl);
  }

  const credentials = getGoogleOAuthCredentials(provider);
  if (!credentials) {
    gestionaleUrl.searchParams.set("oauth_error", "not_configured");
    return NextResponse.redirect(gestionaleUrl);
  }

  const redirectUri = new URL(`/api/gestionale/connections/${provider}/callback`, appUrl).toString();
  const state = await createOAuthState({ userId: session.userId, siteId: site.id, provider });
  const authUrl = buildGoogleAuthorizationUrl({ credentials, redirectUri, state });

  return NextResponse.redirect(authUrl);
}
