"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [devLink, setDevLink] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, organizationName }),
      });
      const data = await response.json() as any;
      if (!response.ok) {
        setError(data.error ?? "Registrazione non riuscita.");
        setLoading(false);
        return;
      }
      if (data.devVerifyLink) {
        // Solo in sviluppo, quando non e' configurato un provider email:
        // mostriamo il link invece di lasciare l'utente bloccato.
        setDevLink(data.devVerifyLink);
        setLoading(false);
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Non e' stato possibile completare la registrazione. Riprova.");
      setLoading(false);
    }
  }

  if (devLink) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-paper px-6 py-16">
        <div className="w-full max-w-sm text-center">
          <h1 className="font-display text-2xl">Account creato</h1>
          <p className="mt-2 text-ink-soft">
            Nessun provider email e' configurato in questo ambiente: usa questo link per confermare
            l&apos;indirizzo (solo in sviluppo).
          </p>
          <a href={devLink} className="mt-4 inline-block break-all text-sm text-accent hover:underline">
            {devLink}
          </a>
          <div className="mt-6">
            <Link href="/login" className="text-accent hover:underline">
              Vai al login
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-paper px-6 py-16">
      <div className="w-full max-w-sm">
        <h1 className="font-display text-3xl">Crea il tuo account</h1>
        <p className="mt-2 text-ink-soft">Monitora e migliora il sito della tua attivita'.</p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-3">
          <div>
            <label htmlFor="organizationName" className="mb-1 block text-sm text-ink-soft">
              Nome attivita' (opzionale)
            </label>
            <input
              id="organizationName"
              type="text"
              value={organizationName}
              onChange={(e) => setOrganizationName(e.target.value)}
              className="w-full rounded-md border border-line bg-white px-3 py-2.5 outline-none focus:border-accent"
            />
          </div>
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
            <label htmlFor="password" className="mb-1 block text-sm text-ink-soft">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              minLength={10}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-md border border-line bg-white px-3 py-2.5 outline-none focus:border-accent"
            />
            <p className="mt-1 text-xs text-ink-soft">Almeno 10 caratteri.</p>
          </div>

          {error && <p className="text-sm text-severity-high">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-accent px-6 py-2.5 font-medium text-paper transition-colors hover:bg-accent-deep disabled:opacity-60"
          >
            {loading ? "Creazione in corso..." : "Crea account"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-ink-soft">
          Hai gia' un account?{" "}
          <Link href="/login" className="text-accent hover:underline">
            Accedi
          </Link>
        </p>
      </div>
    </main>
  );
}
