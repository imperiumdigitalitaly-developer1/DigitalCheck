"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

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
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json() as any;
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
    <main className="flex min-h-screen items-center justify-center bg-paper px-6 py-16">
      <div className="w-full max-w-sm">
        <h1 className="font-display text-3xl">Accedi</h1>
        <p className="mt-2 text-ink-soft">Entra nella tua dashboard DigitalCheck.</p>

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

        <form onSubmit={handleSubmit} className="mt-6 space-y-3">
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
              className="w-full rounded-md border border-line bg-white px-3 py-2.5 outline-none focus:border-accent"
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
              className="w-full rounded-md border border-line bg-white px-3 py-2.5 outline-none focus:border-accent"
            />
          </div>

          {error && <p className="text-sm text-severity-high">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-accent px-6 py-2.5 font-medium text-paper transition-colors hover:bg-accent-deep disabled:opacity-60"
          >
            {loading ? "Accesso in corso..." : "Accedi"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-ink-soft">
          Non hai un account?{" "}
          <Link href="/register" className="text-accent hover:underline">
            Registrati
          </Link>
        </p>
      </div>
    </main>
  );
}
