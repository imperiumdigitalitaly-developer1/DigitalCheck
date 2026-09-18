import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { getCurrentSession } from "@/lib/auth/session";
import { sendMail } from "@/lib/mail/mailer";

export const runtime = "nodejs";

const schema = z.object({ message: z.string().trim().min(1).max(2000) });

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });

  const user = await prisma.user.findUniqueOrThrow({ where: { id: session.userId } });
  if (user.plan !== "PRO") {
    return NextResponse.json(
      { error: "Richiedere il nostro intervento diretto e' una funzionalita' del piano Pro." },
      { status: 403 }
    );
  }

  const site = await prisma.site.findUnique({ where: { id: params.id } });
  if (!site || site.ownerId !== session.userId) {
    return NextResponse.json({ error: "Sito non trovato" }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Scrivi cosa vorresti che sistemassimo." }, { status: 400 });
  }

  const supportEmail = process.env.SUPPORT_EMAIL;
  if (!supportEmail) {
    return NextResponse.json(
      { error: "Questa funzione non e' ancora configurata (manca l'indirizzo email del team)." },
      { status: 503 }
    );
  }

  const mailResult = await sendMail({
    to: supportEmail,
    subject: `Richiesta intervento — ${site.url}`,
    text: `Cliente: ${user.email}\nSito: ${site.url}\n\nRichiesta:\n${parsed.data.message}`,
  });

  await prisma.notification.create({
    data: {
      userId: session.userId,
      siteId: site.id,
      type: "help_request",
      message: mailResult.sent
        ? `Richiesta di intervento inviata per ${site.url}.`
        : `Richiesta per ${site.url} salvata, ma l'invio email non e' andato a buon fine: contattaci direttamente.`,
    },
  });

  return NextResponse.json({ sent: mailResult.sent });
}
