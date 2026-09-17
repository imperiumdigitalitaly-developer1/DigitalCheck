import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getCurrentSession } from "@/lib/auth/session";
import { createBillingPortalSession } from "@/lib/billing/stripe";

export async function POST(request: NextRequest) {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });

  const subscription = await prisma.subscription.findUnique({ where: { userId: session.userId } });
  if (!subscription?.stripeCustomerId) {
    return NextResponse.json(
      { error: "Nessun abbonamento attivo trovato per questo account." },
      { status: 404 }
    );
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;
  const result = await createBillingPortalSession(subscription.stripeCustomerId, appUrl);
  if (!result.url) {
    return NextResponse.json({ error: result.error ?? "Gestione abbonamento non disponibile al momento." }, { status: 503 });
  }

  return NextResponse.json({ url: result.url });
}
