"use client";

import { useState } from "react";

interface ConsultationModalProps {
  onClose: () => void;
  prefillUrl?: string;
}

export function ConsultationModal({ onClose, prefillUrl }: ConsultationModalProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    setError(null);
    try {
      const response = await fetch("/api/consultation-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, phone, message, url: prefillUrl }),
      });
      const data = await response.json() as any;
      if (!response.ok) {
        setError(data.error ?? "Non e' stato possibile inviare la richiesta.");
        setSending(false);
        return;
      }
      setSent(true);
    } catch {
      setError("Connessione non riuscita. Riprova.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-md rounded-lg bg-white p-6">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-xl">Richiedi una consulenza</h3>
          <button onClick={onClose} aria-label="Chiudi" className="text-ink-soft hover:text-ink">
            ✕
          </button>
        </div>

        {sent ? (
          <p className="mt-4 text-ink-soft">
            Richiesta inviata. Ti contatteremo il prima possibile all&apos;indirizzo che ci hai lasciato.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="mt-4 space-y-3">
            <input
              type="text"
              required
              placeholder="Nome"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-md border border-line px-3 py-2 outline-none focus:border-accent"
            />
            <input
              type="email"
              required
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-md border border-line px-3 py-2 outline-none focus:border-accent"
            />
            <input
              type="tel"
              placeholder="Telefono (facoltativo)"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full rounded-md border border-line px-3 py-2 outline-none focus:border-accent"
            />
            <textarea
              required
              placeholder="Descrivi le tue esigenze..."
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full rounded-md border border-line px-3 py-2 outline-none focus:border-accent"
            />
            {error && <p className="text-sm text-severity-high">{error}</p>}
            <button
              type="submit"
              disabled={sending}
              className="w-full rounded-md bg-accent px-4 py-2.5 font-medium text-paper hover:bg-accent-deep disabled:opacity-60"
            >
              {sending ? "Invio..." : "Invia richiesta"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
