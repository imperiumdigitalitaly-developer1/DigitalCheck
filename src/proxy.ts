import { NextResponse, type NextRequest } from "next/server";
import { getSessionFromRequest, verifySessionToken } from "@/lib/auth/session";

export const config = {
  matcher: ["/dashboard/:path*", "/admin/:path*"],
};

export async function proxy(request: NextRequest) {
  const token = getSessionFromRequest(request);
  const session = token ? await verifySessionToken(token) : null;

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
