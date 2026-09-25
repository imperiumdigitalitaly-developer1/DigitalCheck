import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { hashPassword, isPasswordStrongEnough } from "@/lib/auth/password";
import { createSessionToken, sessionCookieOptions, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { generateToken, tokenExpiry } from "@/lib/auth/tokens";
import { sendMail } from "@/lib/mail/mailer";
import { grantOwnerPrivilegesIfNeeded } from "@/lib/auth/owner";

const schema = z.object({
  email: z.string().trim().toLowerCase().email("Email non valida"),
  password: z.string().min(10, "La password deve avere almeno 10 caratteri"),
  organizationName: z.string().trim().max(120).optional(),
});

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dati non validi" }, { status: 400 });
  }
  const { email, password, organizationName } = parsed.data;

  if (!isPasswordStrongEnough(password)) {
    return NextResponse.json({ error: "Password troppo debole (minimo 10 caratteri)" }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    // Messaggio generico: non confermiamo ne' neghiamo esplicitamente
    // che l'email sia gia' registrata, per non facilitare l'enumerazione
    // di account esistenti.
    return NextResponse.json(
      { error: "Non e' stato possibile completare la registrazione con questi dati." },
      { status: 409 }
    );
  }

  const passwordHash = await hashPassword(password);
  const { token, tokenHash } = generateToken();

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      emailVerifyTokenHash: tokenHash,
      emailVerifyExpiresAt: tokenExpiry(60 * 24),
      organizations: {
        create: { name: organizationName || "La mia attivita'" },
      },
    },
  });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;
  const verifyLink = `${appUrl}/api/auth/verify-email?token=${token}`;
  const mailResult = await sendMail({
    to: email,
    subject: "Conferma il tuo account DigitalCheck",
    text: `Conferma il tuo indirizzo email visitando questo link (valido 24 ore): ${verifyLink}`,
  });

  const currentUser = await grantOwnerPrivilegesIfNeeded(user);

  const sessionToken = await createSessionToken({
    userId: currentUser.id,
    email: currentUser.email,
    isAdmin: currentUser.isAdmin,
  });
  const response = NextResponse.json({
    id: currentUser.id,
    email: currentUser.email,
    emailVerificationSent: mailResult.sent,
    // Solo fuori produzione e solo se l'email non e' stata davvero
    // inviata: il link viene restituito per permettere di testare il
    // flusso in locale senza un provider email configurato. In
    // produzione questo campo non compare mai.
    devVerifyLink:
      !mailResult.sent && process.env.NODE_ENV !== "production" ? verifyLink : undefined,
  });
  response.cookies.set(SESSION_COOKIE_NAME, sessionToken, sessionCookieOptions());
  return response;
}
