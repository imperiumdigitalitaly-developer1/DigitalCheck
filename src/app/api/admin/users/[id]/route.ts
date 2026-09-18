import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { getCurrentSession } from "@/lib/auth/session";
import { cancelSubscriptionImmediately } from "@/lib/billing/stripe";

const patchSchema = z.object({
  plan: z.enum(["FREE", "PRO"]),
});

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
  if (!session.isAdmin) return NextResponse.json({ error: "Non autorizzato" }, { status: 403 });

  const body = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dati non validi" }, { status: 400 });
  }

  const target = await prisma.user.findUnique({ where: { id: params.id } });
  if (!target) return NextResponse.json({ error: "Utente non trovato" }, { status: 404 });

  const updated = await prisma.user.update({
    where: { id: params.id },
    data: { plan: parsed.data.plan },
  });

  return NextResponse.json({ id: updated.id, plan: updated.plan });
}

const deleteSchema = z.object({
  // Doppia conferma lato server: l'admin deve digitare l'email esatta
  // dell'account da eliminare. Non e' sufficiente nascondere/mostrare il
  // pulsante in UI, dato che l'azione e' irreversibile su dati di terzi.
  confirmEmail: z.string().trim().toLowerCase(),
});

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
  if (!session.isAdmin) return NextResponse.json({ error: "Non autorizzato" }, { status: 403 });

  if (params.id === session.userId) {
    return NextResponse.json(
      { error: "Non puoi eliminare il tuo stesso account admin da qui." },
      { status: 400 }
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = deleteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Conferma mancante o non valida" }, { status: 400 });
  }

  const target = await prisma.user.findUnique({
    where: { id: params.id },
    include: { subscription: true },
  });
  if (!target) return NextResponse.json({ error: "Utente non trovato" }, { status: 404 });

  if (parsed.data.confirmEmail !== target.email.toLowerCase()) {
    return NextResponse.json(
      { error: "L'email digitata non corrisponde all'account da eliminare." },
      { status: 400 }
    );
  }

  if (target.subscription?.stripeSubscriptionId) {
    await cancelSubscriptionImmediately(target.subscription.stripeSubscriptionId);
  }

  // Cascade a livello DB (vedi schema.prisma) rimuove automaticamente:
  // organizzazioni possedute, siti, scan, report, subscription,
  // notifiche, connessioni Analytics/Search Console, conversazioni AI.
  await prisma.user.delete({ where: { id: params.id } });

  console.log(
    JSON.stringify({
      event: "admin_user_deleted",
      adminId: session.userId,
      adminEmail: session.email,
      deletedUserId: target.id,
      deletedUserEmail: target.email,
      hadActiveSubscription: !!target.subscription?.stripeSubscriptionId,
      timestamp: new Date().toISOString(),
    })
  );

  return NextResponse.json({ ok: true });
}
