"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordContent />
    </Suspense>
  );
}

function ResetPasswordContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  return (
    <main className="flex min-h-screen items-center justify-center bg-paper px-6 py-16">
      <div className="w-full max-w-sm">
        {token ? <ConfirmStep token={token} /> : <RequestStep />}
      </div>
    </main>
  );
}

function RequestStep() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [devLink, setDevLink] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const response = await fetch("/api/auth/reset-password/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const data = await response.json() as any;
    setMessage(data.message ?? "Se l'indirizzo e' registrato, riceverai un'email.");
    setDevLink(data.devResetLink ?? null);
    setLoading(false);
  }

  return (
    <>
      <h1 className="font-display text-3xl">Password dimenticata</h1>
      <p className="mt-2 text-ink-soft">Inserisci la tua email: ti invieremo un link per reimpostarla.</p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-3">
        <input
          type="email"
          required
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-md border border-line bg-white px-3 py-2.5 outline-none focus:border-accent"
        />
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-accent px-6 py-2.5 font-medium text-paper transition-colors hover:bg-accent-deep disabled:opacity-60"
        >
          {loading ? "Invio in corso..." : "Invia il link"}
        </button>
      </form>

      {message && <p className="mt-4 text-sm text-ink-soft">{message}</p>}
      {devLink && (
        <p className="mt-2 break-all text-xs text-ink-soft">
          Provider email non configurato — link di sviluppo:{" "}
          <a href={devLink} className="text-accent hover:underline">
            {devLink}
          </a>
        </p>
      )}

      <p className="mt-6 text-center text-sm text-ink-soft">
        <Link href="/login" className="text-accent hover:underline">
          Torna al login
        </Link>
      </p>
    </>
  );
}

function ConfirmStep({ token }: { token: string }) {
  const router = useRouter();
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const response = await fetch("/api/auth/reset-password/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, newPassword }),
    });
    const data = await response.json() as any;
    if (!response.ok) {
      setError(data.error ?? "Non e' stato possibile aggiornare la password.");
      setLoading(false);
      return;
    }
    setDone(true);
    setLoading(false);
    setTimeout(() => router.push("/login"), 1500);
  }

  if (done) {
    return <p className="text-center text-ink-soft">Password aggiornata. Ti stiamo portando al login...</p>;
  }

  return (
    <>
      <h1 className="font-display text-3xl">Imposta una nuova password</h1>
      <form onSubmit={handleSubmit} className="mt-6 space-y-3">
        <input
          type="password"
          required
          minLength={10}
          placeholder="Nuova password (minimo 10 caratteri)"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          className="w-full rounded-md border border-line bg-white px-3 py-2.5 outline-none focus:border-accent"
        />
        {error && <p className="text-sm text-severity-high">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-accent px-6 py-2.5 font-medium text-paper transition-colors hover:bg-accent-deep disabled:opacity-60"
        >
          {loading ? "Aggiornamento..." : "Aggiorna password"}
        </button>
      </form>
    </>
  );
}
