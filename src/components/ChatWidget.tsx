"use client";

import { useEffect, useRef, useState } from "react";

interface Message {
  role: "user" | "assistant";
  text: string;
}

export function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  // Porta in vista l'ultimo messaggio: senza, dopo qualche scambio la
  // risposta resta sotto il bordo dell'area scrollabile.
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages, loading, open]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || loading) return;

    const nextMessages: Message[] = [...messages, { role: "user", text }];
    setMessages(nextMessages);
    setInput("");
    setLoading(true);

    try {
      const response = await fetch("/api/assistant/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, history: nextMessages.slice(-6) }),
      });
      const data = await response.json();
      if (response.ok) {
        setMessages((m) => [...m, { role: "assistant", text: data.answer }]);
      } else {
        setMessages((m) => [...m, { role: "assistant", text: data.error ?? "Non disponibile al momento." }]);
      }
    } catch {
      setMessages((m) => [...m, { role: "assistant", text: "Connessione non riuscita. Riprova." }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="app-touch fixed bottom-4 right-4 z-50">
      {open && (
        <div className="mb-3 flex h-[min(24rem,calc(100dvh-6.5rem))] w-[min(20rem,calc(100vw-2rem))] flex-col rounded-[14px] border border-line bg-white shadow-xl">
          <div className="flex items-center justify-between rounded-t-[14px] border-b border-line bg-ink py-1 pl-4 pr-4">
            <span className="font-display text-sm text-paper">Assistente DigitalCheck</span>
            <button
              onClick={() => setOpen(false)}
              aria-label="Chiudi assistente"
              className="-mr-3 flex h-11 w-11 items-center justify-center text-paper/70 hover:text-paper"
            >
              ✕
            </button>
          </div>
          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            {messages.length === 0 && (
              <p className="text-sm text-ink-soft">
                Ciao! Chiedimi come funziona DigitalCheck, i piani disponibili, o come migliorare il tuo sito.
              </p>
            )}
            {messages.map((m, i) => (
              <p key={i} className={`text-sm ${m.role === "user" ? "font-medium text-ink" : "text-ink-soft"}`}>
                {m.text}
              </p>
            ))}
            {loading && <p className="text-sm text-ink-soft">...</p>}
            <div ref={endRef} />
          </div>
          <form onSubmit={handleSend} className="flex gap-2 border-t border-line p-3">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Scrivi un messaggio..."
              className="min-w-0 flex-1 rounded-md border border-line px-3 py-2 text-base outline-none focus:border-accent"
            />
            <button
              type="submit"
              disabled={loading}
              className="min-h-[44px] rounded-md bg-accent px-3 py-2 text-sm font-medium text-paper hover:bg-accent-deep disabled:opacity-60"
            >
              Invia
            </button>
          </form>
        </div>
      )}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Apri assistente"
        className="flex h-14 w-14 items-center justify-center rounded-full bg-accent text-2xl text-paper shadow-lg hover:bg-accent-deep"
      >
        💬
      </button>
    </div>
  );
}
