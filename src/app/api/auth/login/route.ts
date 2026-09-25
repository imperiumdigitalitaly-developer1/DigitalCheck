import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { verifyPassword } from "@/lib/auth/password";
import {
  createSessionToken,
  sessionCookieOptions,
  SESSION_COOKIE_NAME,
  REMEMBER_ME_DURATION_SECONDS,
} from "@/lib/auth/session";
import { grantOwnerPrivilegesIfNeeded } from "@/lib/auth/owner";

const schema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
  rememberMe: z.boolean().optional().default(false),
});

// Rate limiting minimale per rallentare il brute force sulle password,
// stesso approccio in-memory della route di scan — vedi README, sez. Sicurezza.
const attempts = new Map<string, number[]>();
const MAX_ATTEMPTS = 8;
const WINDOW_MS = 10 * 60 * 1000;

function isRateLimited(key: string): boolean {
  const now = Date.now();
  const recent = (attempts.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  attempts.set(key, recent);
  return recent.length > MAX_ATTEMPTS;
}

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Email o password non validi" }, { status: 400 });
  }
  const { email, password, rememberMe } = parsed.data;

  if (isRateLimited(`${ip}:${email}`)) {
    return NextResponse.json({ error: "Troppi tentativi. Riprova tra qualche minuto." }, { status: 429 });
  }

  const user = await prisma.user.findUnique({ where: { email } });
  // Messaggio identico in entrambi i casi di fallimento: non rivela se
  // il problema e' l'email inesistente o la password sbagliata.
  const genericError = { error: "Email o password non corretti." } as const;

  if (!user) {
    return NextResponse.json(genericError, { status: 401 });
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    return NextResponse.json(genericError, { status: 401 });
  }

  const currentUser = await grantOwnerPrivilegesIfNeeded(user);

  // "Rimani connesso": stesso cookie/JWT, solo scadenza piu' lunga (30gg
  // invece di 7) — vedi src/lib/auth/session.ts.
  const duration = rememberMe ? REMEMBER_ME_DURATION_SECONDS : undefined;
  const sessionToken = await createSessionToken(
    {
      userId: currentUser.id,
      email: currentUser.email,
      isAdmin: currentUser.isAdmin,
    },
    duration
  );
  const response = NextResponse.json({ id: currentUser.id, email: currentUser.email });
  response.cookies.set(SESSION_COOKIE_NAME, sessionToken, sessionCookieOptions(duration));
  return response;
}
