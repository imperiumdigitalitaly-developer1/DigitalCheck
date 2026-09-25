import { NextResponse, type NextRequest } from "next/server";
import { getSessionFromRequest, verifySessionToken } from "@/lib/auth/session";

// Route pubbliche che non hanno senso per un utente gia' autenticato: chi ha
// gia' una sessione valida viene mandato dritto alla dashboard, senza mai
// vedere il form (nessun flash, il redirect avviene qui lato edge, prima che
// la pagina venga renderizzata).
const AUTH_ONLY_ROUTES = ["/login", "/register", "/reset-password"];

export const config = {
  matcher: ["/dashboard/:path*", "/admin/:path*", "/login", "/register", "/reset-password"],
};

export async function middleware(request: NextRequest) {
  const token = getSessionFromRequest(request);
  const session = token ? await verifySessionToken(token) : null;

  const isAuthOnlyRoute = AUTH_ONLY_ROUTES.includes(request.nextUrl.pathname);

  if (session && isAuthOnlyRoute) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  if (isAuthOnlyRoute) {
    return NextResponse.next();
  }

  if (!session) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (request.nextUrl.pathname.startsWith("/admin") && !session.isAdmin) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}
