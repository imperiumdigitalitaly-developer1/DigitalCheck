"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { AuthShell } from "@/components/auth/AuthShell";

const VERIFY_MESSAGES: Record<string, { text: string; tone: "ok" | "error" }> = {
  success: { text: "Email confermata. Ora puoi accedere.", tone: "ok" },
  invalid_or_expired: { text: "Il link di conferma non e' valido o e' scaduto.", tone: "error" },
  missing_token: { text: "Link di conferma incompleto.", tone: "error" },
};

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const verifyStatus = searchParams.get("verify");
  const verifyMessage = verifyStatus ? VERIFY_MESSAGES[verifyStatus] : null;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, rememberMe }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "Accesso non riuscito.");
        setLoading(false);
        return;
      }
      router.push(searchParams.get("next") || "/dashboard");
      router.refresh();
    } catch {
      setError("Non e' stato possibile completare l'accesso. Riprova.");
      setLoading(false);
    }
  }

  return (
    <AuthShell>
      <h1 className="font-display text-[28px] font-semibold tracking-tight">Accedi</h1>
      <p className="mt-2 text-[15px] text-ink-soft">Entra nella tua dashboard DigitalCheck.</p>

      {verifyMessage && (
        <p
          className={`mt-4 rounded-md border px-3 py-2 text-sm ${
            verifyMessage.tone === "ok"
              ? "border-accent/30 bg-accent-soft/40 text-accent-deep"
              : "border-severity-high/30 bg-severity-high/10 text-severity-high"
          }`}
        >
          {verifyMessage.text}
        </p>
      )}

      <form onSubmit={handleSubmit} className="mt-6 space-y-3.5">
        <div>
          <label htmlFor="email" className="mb-1 block text-sm text-ink-soft">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-md border border-line bg-white px-3 py-2.5 outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/15"
          />
        </div>
        <div>
          <div className="mb-1 flex items-center justify-between">
            <label htmlFor="password" className="text-sm text-ink-soft">
              Password
            </label>
            <Link href="/reset-password" className="text-sm text-accent hover:underline">
              Password dimenticata?
            </Link>
          </div>
          <input
            id="password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-md border border-line bg-white px-3 py-2.5 outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/15"
          />
        </div>

        <label htmlFor="rememberMe" className="flex min-h-[44px] cursor-pointer select-none items-center gap-2.5 -my-1">
          <input
            id="rememberMe"
            type="checkbox"
            checked={rememberMe}
            onChange={(e) => setRememberMe(e.target.checked)}
            className="h-[18px] w-[18px] shrink-0 cursor-pointer rounded border-line-strong accent-accent focus:outline-none focus:ring-2 focus:ring-accent/30 focus:ring-offset-1"
          />
          <span className="inline-flex items-center gap-1.5 text-sm text-ink-soft">
            Rimani connesso
            <span
              title="Mantieni l'accesso a DigitalCheck anche quando chiudi il browser."
              className="inline-flex h-[15px] w-[15px] cursor-help items-center justify-center rounded-full text-ink-faint"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-full w-full">
                <circle cx="12" cy="12" r="9.5" />
                <line x1="12" y1="10.5" x2="12" y2="16.5" strokeLinecap="round" />
                <circle cx="12" cy="7.3" r="0.9" fill="currentColor" stroke="none" />
              </svg>
            </span>
          </span>
        </label>

        {error && <p className="text-sm text-severity-high">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-accent px-6 py-2.5 font-medium text-white transition-colors hover:bg-accent-deep disabled:opacity-60"
        >
          {loading ? "Accesso in corso..." : "Accedi"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-ink-soft">
        Non hai un account?{" "}
        <Link href="/register" className="font-medium text-accent hover:underline">
          Registrati
        </Link>
      </p>
    </AuthShell>
  );
}
