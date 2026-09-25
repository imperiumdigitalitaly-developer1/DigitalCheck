import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { askAssistant } from "@/lib/ai/assistant";
import { aiErrorClientMessage, aiErrorHttpStatus } from "@/lib/ai/errors";

export const runtime = "nodejs";
// Peggior caso della chiamata AI con retry su 503/429: ~67s (3 x 20s + 7s).
export const maxDuration = 90;

const schema = z.object({
  message: z.string().trim().min(1).max(500),
  history: z
    .array(z.object({ role: z.enum(["user", "assistant"]), text: z.string().max(2000) }))
    .max(10)
    .optional(),
});

const REQUESTS_PER_WINDOW = 20;
const WINDOW_MS = 10 * 60 * 1000;
const requestLog = new Map<string, number[]>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const timestamps = (requestLog.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  timestamps.push(now);
  requestLog.set(ip, timestamps);
  return timestamps.length > REQUESTS_PER_WINDOW;
}

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (isRateLimited(ip)) {
    return NextResponse.json({ error: "Troppe richieste. Riprova tra qualche minuto." }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Messaggio non valido." }, { status: 400 });
  }

  const result = await askAssistant(parsed.data.message, parsed.data.history ?? []);
  if (!result.answer) {
    const kind = result.errorKind ?? "unknown";
    return NextResponse.json({ error: aiErrorClientMessage(kind), code: kind }, { status: aiErrorHttpStatus(kind) });
  }
  return NextResponse.json({ answer: result.answer });
}
