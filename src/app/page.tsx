"use client";

import { useState } from "react";
import Link from "next/link";
import type { DigitalCheckReport } from "@/types";
import { ReportView } from "@/components/ReportView";

const BUSINESS_TYPES = [
  { value: "bnb", label: "B&B / Casa vacanze" },
  { value: "hotel", label: "Hotel" },
  { value: "restaurant", label: "Ristorante" },
  { value: "shop", label: "Negozio" },
  { value: "professional", label: "Professionista" },
  { value: "other", label: "Altro" },
] as const;

const GOALS = [
  { value: "increase_bookings", label: "Ricevere piu' prenotazioni" },
  { value: "increase_calls", label: "Ricevere piu' telefonate" },
  { value: "increase_quote_requests", label: "Ricevere piu' richieste di preventivo" },
  { value: "increase_visibility", label: "Aumentare la visibilita' online" },
  { value: "sell_products", label: "Vendere prodotti" },
  { value: "increase_contacts", label: "Ottenere piu' contatti" },
] as const;

type Status = "idle" | "loading" | "error" | "done";

export default function HomePage() {
  const [url, setUrl] = useState("");
  const [businessType, setBusinessType] = useState<(typeof BUSINESS_TYPES)[number]["value"]>("bnb");
  const [goal, setGoal] = useState<(typeof GOALS)[number]["value"]>("increase_bookings");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<DigitalCheckReport | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setError(null);
    setReport(null);

    try {
      const response = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, businessType, goal }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "Si e' verificato un errore durante l'analisi.");
        setStatus("error");
        return;
      }
      setReport(data as DigitalCheckReport);
      setStatus("done");
    } catch {
      setError("Non e' stato possibile completare l'analisi. Riprova tra poco.");
      setStatus("error");
    }
  }

  return (
    <main>
      <nav className="flex items-center justify-between border-b border-line px-6 py-4">
        <div className="flex items-baseline gap-2">
          <span className="font-display text-lg">DigitalCheck</span>
          <span className="text-xs text-ink-soft">powered by Imperium Digital</span>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <Link href="/login" className="text-ink-soft hover:text-ink">
            Accedi
          </Link>
          <Link
            href="/register"
            className="rounded-md bg-ink px-4 py-2 font-medium text-paper hover:bg-ink/90"
          >
            Crea account
          </Link>
        </div>
      </nav>

      {/* HERO */}
      <section className="border-b border-line bg-paper px-6 py-20 sm:py-28">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="font-display text-4xl leading-tight sm:text-5xl">
            Scopri quanto e' efficace il tuo sito.
          </h1>
          <p className="mx-auto mt-4 max-w-prose text-lg text-ink-soft">
            Analizza SEO, performance, mobile, contenuti e capacita' di conversione. Ottieni un
            report chiaro e indicazioni concrete per migliorare la presenza digitale della tua
            attivita'.
          </p>

          <form onSubmit={handleSubmit} className="mx-auto mt-10 max-w-xl space-y-3 text-left">
            <label htmlFor="url" className="sr-only">
              Sito web
            </label>
            <input
              id="url"
              type="text"
              required
              placeholder="Inserisci il tuo sito web (es. www.tuosito.it)"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="w-full rounded-md border border-line bg-white px-4 py-3 text-base outline-none focus:border-accent"
            />

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="businessType" className="mb-1 block text-sm text-ink-soft">
                  Tipo di attivita'
                </label>
                <select
                  id="businessType"
                  value={businessType}
                  onChange={(e) => setBusinessType(e.target.value as typeof businessType)}
                  className="w-full rounded-md border border-line bg-white px-3 py-2.5 outline-none focus:border-accent"
                >
                  {BUSINESS_TYPES.map((b) => (
                    <option key={b.value} value={b.value}>
                      {b.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="goal" className="mb-1 block text-sm text-ink-soft">
                  Obiettivo principale
                </label>
                <select
                  id="goal"
                  value={goal}
                  onChange={(e) => setGoal(e.target.value as typeof goal)}
                  className="w-full rounded-md border border-line bg-white px-3 py-2.5 outline-none focus:border-accent"
                >
                  {GOALS.map((g) => (
                    <option key={g.value} value={g.value}>
                      {g.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <button
              type="submit"
              disabled={status === "loading"}
              className="w-full rounded-md bg-accent px-6 py-3 font-medium text-paper transition-colors hover:bg-accent-deep disabled:opacity-60"
            >
              {status === "loading" ? "Analisi in corso..." : "Analizza gratuitamente"}
            </button>

            {status === "loading" && (
              <p className="text-center text-sm text-ink-soft" role="status">
                Stiamo raggiungendo il sito e analizzando homepage, SEO e struttura tecnica. Puo'
                richiedere qualche secondo.
              </p>
            )}
            {status === "error" && error && (
              <p className="text-center text-sm text-severity-high" role="alert">
                {error}
              </p>
            )}
          </form>
        </div>
      </section>

      {/* RESULTS */}
      {status === "done" && report && (
        <section className="border-b border-line px-6 py-16">
          <div className="mx-auto max-w-4xl">
            <ReportView report={report} />
          </div>
        </section>
      )}

      {/* COME FUNZIONA */}
      <section className="border-b border-line px-6 py-16">
        <div className="mx-auto max-w-4xl">
          <h2 className="font-display text-3xl">Come funziona</h2>
          <div className="mt-8 grid grid-cols-1 gap-8 sm:grid-cols-3">
            {[
              { title: "1. Inserisci il sito", text: "Indica l'indirizzo del tuo sito, il tipo di attivita' e il tuo obiettivo principale." },
              { title: "2. Analisi automatica", text: "Il sistema esamina SEO, aspetti tecnici, mobile, contenuti e capacita' di conversione." },
              { title: "3. Report con azioni concrete", text: "Ricevi un Digital Score e indicazioni pratiche, spiegate in linguaggio semplice." },
            ].map((step) => (
              <div key={step.title}>
                <h3 className="font-display text-lg">{step.title}</h3>
                <p className="mt-2 text-ink-soft">{step.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* COSA ANALIZZIAMO */}
      <section className="border-b border-line bg-white px-6 py-16">
        <div className="mx-auto max-w-4xl">
          <h2 className="font-display text-3xl">Cosa analizziamo</h2>
          <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {["SEO", "Performance", "Mobile", "Contenuti", "Conversione", "Accessibilita'", "Tecnica"].map(
              (cat) => (
                <div key={cat} className="rounded-lg border border-line px-4 py-3 text-center">
                  {cat}
                </div>
              )
            )}
          </div>
        </div>
      </section>

      {/* DIGITAL SCORE */}
      <section className="border-b border-line px-6 py-16">
        <div className="mx-auto max-w-4xl">
          <h2 className="font-display text-3xl">Il Digital Score</h2>
          <p className="mt-3 max-w-prose text-ink-soft">
            Un punteggio da 0 a 100 che riassume lo stato del sito, calcolato con pesi diversi per
            categoria a seconda del tipo di attivita' — non una semplice media.
          </p>
          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-5">
            {[
              { range: "0-39", label: "Critico", color: "#B4483F" },
              { range: "40-59", label: "Da migliorare", color: "#C97A3D" },
              { range: "60-74", label: "Buono", color: "#3F7D8F" },
              { range: "75-89", label: "Molto buono", color: "#1F6F64" },
              { range: "90-100", label: "Eccellente", color: "#2F7A4F" },
            ].map((band) => (
              <div key={band.range} className="rounded-lg border border-line p-4 text-center">
                <p className="font-display text-xl" style={{ color: band.color }}>
                  {band.range}
                </p>
                <p className="mt-1 text-sm text-ink-soft">{band.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* AI */}
      <section className="border-b border-line bg-white px-6 py-16">
        <div className="mx-auto max-w-4xl grid grid-cols-1 gap-10 sm:grid-cols-2">
          <div>
            <h2 className="font-display text-3xl">Intelligenza artificiale</h2>
            <p className="mt-3 max-w-prose text-ink-soft">
              Trasforma dati tecnici complessi in indicazioni comprensibili e operative. L&apos;AI di DigitalCheck
              interpreta i dati PageSpeed — non li sostituisce — e spiega cosa fare, in ordine di priorita'.
            </p>
          </div>
          <div>
            <h2 className="font-display text-3xl">Un centro di controllo</h2>
            <p className="mt-3 max-w-prose text-ink-soft">
              Con il Gestionale di DigitalCheck Pro monitori performance, metriche e stato tecnico di tutti i tuoi
              siti da un unico ambiente, con storico e alert quando qualcosa cambia.
            </p>
          </div>
        </div>
      </section>

      {/* PIANI */}
      <section id="pricing" className="border-b border-line bg-white px-6 py-16">
        <div className="mx-auto max-w-4xl">
          <h2 className="font-display text-3xl">Scopri DigitalCheck</h2>
          <p className="mt-2 max-w-prose text-ink-soft">Analizza, monitora e migliora i tuoi siti web.</p>
          <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div className="rounded-lg border border-line p-6">
              <h3 className="font-display text-xl">Free</h3>
              <p className="mt-1 text-sm text-ink-soft">Per provare concretamente il servizio</p>
              <p className="mt-4 font-display text-3xl">€0</p>
              <ul className="mt-4 space-y-2 text-sm text-ink-soft">
                <li className="flex gap-2"><span className="text-accent">✓</span> 1 analisi a settimana</li>
                <li className="flex gap-2"><span className="text-accent">✓</span> 1 sito al mese</li>
                <li className="flex gap-2"><span className="text-accent">✓</span> Analisi essenziale</li>
                <li className="flex gap-2"><span className="text-accent">✓</span> Punteggi principali</li>
                <li className="flex gap-2"><span className="text-accent">✓</span> Sintesi dei risultati</li>
                <li className="flex gap-2"><span className="text-accent">✓</span> Report PDF sintetico di 1 pagina</li>
              </ul>
              <ul className="mt-4 space-y-2 border-t border-line pt-4 text-sm text-ink-soft">
                <li className="flex gap-2"><span className="text-severity-high">✕</span> Assistente AI</li>
                <li className="flex gap-2"><span className="text-severity-high">✕</span> Report completo</li>
                <li className="flex gap-2"><span className="text-severity-high">✕</span> Gestionale</li>
                <li className="flex gap-2"><span className="text-severity-high">✕</span> Monitoraggio</li>
                <li className="flex gap-2"><span className="text-severity-high">✕</span> Analytics avanzate</li>
                <li className="flex gap-2"><span className="text-severity-high">✕</span> Storico completo</li>
                <li className="flex gap-2"><span className="text-severity-high">✕</span> Analisi illimitate</li>
              </ul>
              <Link
                href="/register"
                className="mt-6 block rounded-md border border-line px-4 py-2.5 text-center text-sm font-medium hover:border-accent"
              >
                Inizia gratis
              </Link>
            </div>
            <div className="rounded-lg border border-accent bg-accent-soft/40 p-6">
              <h3 className="font-display text-xl">DigitalCheck Pro</h3>
              <p className="mt-1 text-sm text-ink-soft">La piattaforma completa</p>
              <p className="mt-4 font-display text-3xl">
                €6,99 <span className="text-base font-normal text-ink-soft">/ mese</span>
              </p>
              <ul className="mt-4 space-y-2 text-sm text-ink-soft">
                <li className="flex gap-2"><span className="text-accent">✓</span> Siti illimitati</li>
                <li className="flex gap-2"><span className="text-accent">✓</span> Fino a 200 analisi/mese</li>
                <li className="flex gap-2"><span className="text-accent">✓</span> Analisi complete</li>
                <li className="flex gap-2"><span className="text-accent">✓</span> PDF professionali di almeno 5 pagine</li>
                <li className="flex gap-2"><span className="text-accent">✓</span> Assistente AI</li>
                <li className="flex gap-2"><span className="text-accent">✓</span> AI integrata con PageSpeed</li>
                <li className="flex gap-2"><span className="text-accent">✓</span> Storico analisi</li>
                <li className="flex gap-2"><span className="text-accent">✓</span> Gestionale</li>
                <li className="flex gap-2"><span className="text-accent">✓</span> Web Analytics</li>
                <li className="flex gap-2"><span className="text-accent">✓</span> Metrics</li>
                <li className="flex gap-2"><span className="text-accent">✓</span> Observability</li>
                <li className="flex gap-2"><span className="text-accent">✓</span> Monitoraggio</li>
                <li className="flex gap-2"><span className="text-accent">✓</span> Grafici e report</li>
                <li className="flex gap-2"><span className="text-accent">✓</span> Insight AI</li>
                <li className="flex gap-2"><span className="text-accent">✓</span> Dashboard avanzata</li>
              </ul>
              <Link
                href="/register"
                className="mt-6 block rounded-md bg-accent px-4 py-2.5 text-center text-sm font-medium text-paper hover:bg-accent-deep"
              >
                Inizia con Pro
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="border-b border-line px-6 py-16">
        <div className="mx-auto max-w-3xl">
          <h2 className="font-display text-3xl">Domande frequenti</h2>
          <div className="mt-6 space-y-6">
            {[
              {
                q: "L'analisi e' davvero gratuita?",
                a: "Si', il piano Free include un'analisi di base senza costi. Il piano Pro sblocca analisi complete, monitoraggio e report PDF.",
              },
              {
                q: "I dati mostrati sono reali?",
                a: "Si'. Quando un dato non puo' essere verificato con gli strumenti attualmente collegati, il report lo dichiara esplicitamente invece di stimarlo come fosse certo.",
              },
              {
                q: "DigitalCheck sostituisce Google PageSpeed o Lighthouse?",
                a: "No: li usa come una delle fonti tecniche possibili, ma il valore principale e' spiegare cosa significano i dati per la tua attivita' e cosa fare in pratica.",
              },
            ].map((item) => (
              <div key={item.q}>
                <h3 className="font-medium">{item.q}</h3>
                <p className="mt-1 text-ink-soft">{item.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA FINALE */}
      <section className="border-b border-line px-6 py-16 text-center" id="consulenza">
        <h2 className="font-display text-3xl">Pronto a scoprire il tuo Digital Score?</h2>
        <a
          href="#url"
          className="mt-6 inline-block rounded-md bg-accent px-6 py-3 font-medium text-paper transition-colors hover:bg-accent-deep"
        >
          Analizza il mio sito
        </a>
      </section>

      <footer className="px-6 py-10 text-center">
        <div className="flex items-baseline justify-center gap-2">
          <span className="font-display text-lg">DigitalCheck</span>
          <span className="text-xs text-ink-soft">powered by Imperium Digital</span>
        </div>
        <nav className="mt-4 flex items-center justify-center gap-4 text-xs text-ink-soft">
          <Link href="/privacy" className="hover:text-ink">
            Privacy Policy
          </Link>
          <span aria-hidden="true">·</span>
          <Link href="/termini" className="hover:text-ink">
            Termini di Servizio
          </Link>
        </nav>
        <p className="mt-2 text-xs text-ink-soft">
          © {new Date().getFullYear()} Imperium Digital. Tutti i dati mostrati provengono da analisi tecniche reali.
        </p>
      </footer>
    </main>
  );
}
