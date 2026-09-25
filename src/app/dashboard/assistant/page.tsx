"use client";

import { useEffect, useState, useCallback } from "react";
import { DashboardShell } from "@/components/DashboardShell";
import { UpgradeCard } from "@/components/UpgradeCard";
import { EmptyState } from "@/components/EmptyState";
import { getPlanFeatures } from "@/lib/billing/plan-config";

interface MeUser {
  id: string;
  email: string;
  plan: "FREE" | "PRO";
  isAdmin: boolean;
}

interface SiteListItem {
  id: string;
  url: string;
  lastScanStatus: string | null;
}

export default function AssistantPage() {
  const [user, setUser] = useState<MeUser | null>(null);
  const [sites, setSites] = useState<SiteListItem[]>([]);
  const [selectedSiteId, setSelectedSiteId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState<{ question: string; answer: string }[]>([]);
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([fetch("/api/auth/me").then((r) => r.json()), fetch("/api/sites").then((r) => (r.ok ? r.json() : []))]).then(
      ([me, siteList]) => {
        setUser(me.user);
        setSites(siteList);
        if (siteList[0]) setSelectedSiteId(siteList[0].id);
        setLoading(false);
      }
    );
  }, []);

  const loadHistory = useCallback(async (siteId: string) => {
    if (!siteId) return;
    const res = await fetch(`/api/sites/${siteId}/advisor`);
    if (!res.ok) return;
    const { messages } = await res.json();
    const turns: { question: string; answer: string }[] = [];
    for (let i = 0; i < messages.length - 1; i += 2) {
      if (messages[i]?.role === "user" && messages[i + 1]?.role === "assistant") {
        turns.push({ question: messages[i].text, answer: messages[i + 1].text });
      }
    }
    setHistory(turns);
  }, []);

  const aiEnabled = user ? getPlanFeatures(user.plan).ai : false;

  useEffect(() => {
    if (aiEnabled && selectedSiteId) loadHistory(selectedSiteId);
  }, [selectedSiteId, aiEnabled, loadHistory]);

  async function handleUpgrade() {
    const response = await fetch("/api/billing/checkout", { method: "POST" });
    const data = await response.json();
    if (data.url) window.location.href = data.url;
    else alert(data.error ?? "Pagamenti non disponibili al momento.");
  }

  async function handleAsk(e: React.FormEvent) {
    e.preventDefault();
    if (!question.trim() || !selectedSiteId) return;
    setAsking(true);
    setError(null);
    const response = await fetch(`/api/sites/${selectedSiteId}/advisor`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question }),
    });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error ?? "Non e' stato possibile ottenere una risposta.");
    } else {
      setHistory((h) => [...h, { question, answer: data.answer }]);
      setQuestion("");
    }
    setAsking(false);
  }

  if (loading || !user) return <div className="p-10 text-center text-ink-soft">Caricamento...</div>;

  if (!aiEnabled) {
    return (
      <DashboardShell user={user}>
        <h1 className="font-display text-2xl">DigitalCheck AI Assistant</h1>
        <p className="mt-2 max-w-prose text-ink-soft">
          Analizza i risultati, interpreta le criticita' e ricevi indicazioni operative personalizzate per ogni sito
          che monitori.
        </p>
        <div className="mt-6 max-w-lg">
          <UpgradeCard
            title="Disponibile con Pro"
            description="L'assistente usa i dati reali dell'ultima analisi del tuo sito per rispondere in modo specifico, non generico."
            onCtaClick={handleUpgrade}
          />
        </div>
      </DashboardShell>
    );
  }

  if (sites.length === 0) {
    return (
      <DashboardShell user={user}>
        <h1 className="font-display text-2xl">DigitalCheck AI Assistant</h1>
        <div className="mt-6">
          <EmptyState
            title="Nessun sito disponibile"
            description="Aggiungi ed esegui l'analisi di un sito prima di usare l'assistente: ha bisogno di dati reali per rispondere."
          />
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell user={user}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl">DigitalCheck AI Assistant</h1>
        <select
          value={selectedSiteId}
          onChange={(e) => setSelectedSiteId(e.target.value)}
          aria-label="Sito"
          className="min-h-[44px] w-full min-w-0 rounded-md border border-line px-3 py-2 text-base outline-none focus:border-accent md:w-auto md:max-w-sm"
        >
          {sites.map((s) => (
            <option key={s.id} value={s.id}>
              {s.url}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-6 rounded-[14px] border border-line bg-white p-6">
        {history.length === 0 && (
          <p className="text-sm text-ink-soft">
            Fai una domanda sul sito selezionato — es. &quot;come miglioro il punteggio SEO?&quot; o &quot;spiegami il
            problema piu' importante&quot;.
          </p>
        )}
        <div className="space-y-4">
          {history.map((turn, i) => (
            <div key={i}>
              <p className="text-sm font-medium">{turn.question}</p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-ink-soft">{turn.answer}</p>
            </div>
          ))}
        </div>
        <form onSubmit={handleAsk} className="mt-5 flex gap-2 border-t border-line pt-4">
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Scrivi la tua domanda..."
            className="min-w-0 flex-1 rounded-md border border-line px-3 py-2 text-base outline-none focus:border-accent"
          />
          <button
            type="submit"
            disabled={asking}
            className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-paper hover:bg-accent-deep disabled:opacity-60"
          >
            {asking ? "..." : "Chiedi"}
          </button>
        </form>
        {error && <p className="mt-2 text-sm text-severity-high">{error}</p>}
      </div>
    </DashboardShell>
  );
}
