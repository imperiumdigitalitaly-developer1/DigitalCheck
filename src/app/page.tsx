import Link from "next/link";
import { LandingNav } from "@/components/landing/LandingNav";
import { DigitalScoreGauge } from "@/components/landing/DigitalScoreGauge";
import { AnimatedBar } from "@/components/landing/AnimatedBar";
import { BAND_HEX, BAND_LABEL } from "@/components/landing/band";

// Dati dimostrativi per il mockup del Digital Score in homepage: mai
// un'analisi reale, dichiarato esplicitamente nella UI (device-foot).
// Riusati identici in hero, sezione Digital Score e pannello "Le 8
// analisi" cosi' il numero raccontato resta coerente in tutta la pagina.
const CATEGORIES: { key: string; name: string; score: number; desc: string; icon: JSX.Element }[] = [
  {
    key: "seo",
    name: "SEO",
    score: 84,
    desc: "Titoli, meta tag, struttura semantica e indicizzabilità.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
        <circle cx="10" cy="10" r="6" />
        <line x1="14.6" y1="14.6" x2="20" y2="20" />
      </svg>
    ),
  },
  {
    key: "performance",
    name: "Performance",
    score: 72,
    desc: "Velocità di caricamento, Core Web Vitals, dati reali PageSpeed.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="4,15 9,9 13,13 20,5" />
        <polyline points="15,5 20,5 20,10" />
      </svg>
    ),
  },
  {
    key: "mobile",
    name: "Mobile",
    score: 81,
    desc: "Esperienza su smartphone: layout, leggibilità, usabilità touch.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
        <rect x="7" y="3" width="10" height="18" rx="2.2" />
        <line x1="11" y1="18" x2="13" y2="18" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    key: "conversione",
    name: "Conversione",
    score: 69,
    desc: "Call to action, moduli di contatto, percorso verso l'obiettivo.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
        <circle cx="12" cy="12" r="8.2" />
        <circle cx="12" cy="12" r="4.6" />
        <circle cx="12" cy="12" r="1.1" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  {
    key: "contenuti",
    name: "Contenuti",
    score: 76,
    desc: "Chiarezza dei testi, completezza e qualità delle informazioni.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
        <rect x="5" y="3.5" width="14" height="17" rx="1.8" />
        <line x1="8.2" y1="8.5" x2="15.8" y2="8.5" />
        <line x1="8.2" y1="12" x2="15.8" y2="12" />
        <line x1="8.2" y1="15.5" x2="13" y2="15.5" />
      </svg>
    ),
  },
  {
    key: "accessibilita",
    name: "Accessibilità",
    score: 91,
    desc: "Contrasto, testo alternativo, navigabilità da tastiera.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
        <circle cx="12" cy="7.4" r="2.6" />
        <path d="M5.5 19.5c0-3.6 2.9-6.3 6.5-6.3s6.5 2.7 6.5 6.3" />
      </svg>
    ),
  },
  {
    key: "tecnica",
    name: "Tecnica",
    score: 74,
    desc: "HTTPS, header di sicurezza, affidabilità dell'infrastruttura del sito.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
        <circle cx="12" cy="12" r="7" />
        <circle cx="12" cy="12" r="2.4" fill="currentColor" stroke="none" />
        <line x1="12" y1="3.6" x2="12" y2="5.5" />
        <line x1="12" y1="18.5" x2="12" y2="20.4" />
        <line x1="16.7" y1="6" x2="15.5" y2="7.5" />
        <line x1="8.5" y1="16.5" x2="7.3" y2="18" />
        <line x1="20.4" y1="12" x2="18.5" y2="12" />
        <line x1="5.5" y1="12" x2="3.6" y2="12" />
      </svg>
    ),
  },
  {
    key: "geo",
    name: "GEO",
    score: 76,
    desc: "Predisposizione del sito a essere compreso e citato dai motori di ricerca generativi.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round">
        <path d="M12 3l1.8 6.2L20 11l-6.2 1.8L12 19l-1.8-6.2L4 11l6.2-1.8z" />
      </svg>
    ),
  },
];

const BAND_LEGEND: { range: string; band: keyof typeof BAND_HEX }[] = [
  { range: "0–39", band: "critical" },
  { range: "40–59", band: "weak" },
  { range: "60–74", band: "good" },
  { range: "75–89", band: "strong" },
  { range: "90–100", band: "excellent" },
];

const FREE_FEATURES = [
  "1 analisi a settimana",
  "1 sito al mese",
  "Analisi essenziale",
  "Punteggi principali",
  "Sintesi dei risultati",
  "Report PDF sintetico di 1 pagina",
];
const FREE_MISSING = ["Assistente AI", "Report completo", "Gestionale e monitoraggio", "Analisi illimitate"];
const PRO_FEATURES = [
  "Siti illimitati",
  "Fino a 200 analisi al mese",
  "Analisi complete",
  "PDF professionali di almeno 5 pagine",
  "Assistente AI integrato con PageSpeed",
  "Storico analisi e monitoraggio",
  "Gestionale, Web Analytics e Metrics",
  "Grafici, report e insight AI",
];

const FAQ = [
  {
    q: "L'analisi è davvero gratuita?",
    a: "Sì, il piano Free include un'analisi di base senza costi. Il piano Pro sblocca analisi complete, monitoraggio e report PDF.",
  },
  {
    q: "I dati mostrati sono reali?",
    a: "Sì. Quando un dato non può essere verificato con gli strumenti attualmente collegati, il report lo dichiara esplicitamente invece di stimarlo come fosse certo.",
  },
  {
    q: "DigitalCheck sostituisce Google PageSpeed o Lighthouse?",
    a: "No: li usa come una delle fonti tecniche possibili, ma il valore principale è spiegare cosa significano i dati per la tua attività e cosa fare in pratica.",
  },
];

const CheckIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 h-[15px] w-[15px] shrink-0">
    <polyline points="4,12.5 9.5,18 20,6" />
  </svg>
);
const CrossIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="mt-0.5 h-[15px] w-[15px] shrink-0">
    <line x1="6" y1="6" x2="18" y2="18" />
    <line x1="18" y1="6" x2="6" y2="18" />
  </svg>
);

const RAIL_ICONS = [
  {
    label: "Panoramica",
    active: true,
    svg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <rect x="4" y="4" width="7" height="7" rx="1.4" />
        <rect x="13" y="4" width="7" height="7" rx="1.4" />
        <rect x="4" y="13" width="7" height="7" rx="1.4" />
        <rect x="13" y="13" width="7" height="7" rx="1.4" />
      </svg>
    ),
  },
  {
    label: "Siti",
    active: false,
    svg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <circle cx="12" cy="12" r="8.4" />
        <line x1="3.6" y1="12" x2="20.4" y2="12" />
        <path d="M12 3.6c2.4 2.4 3.6 5.4 3.6 8.4s-1.2 6-3.6 8.4c-2.4-2.4-3.6-5.4-3.6-8.4s1.2-6 3.6-8.4z" />
      </svg>
    ),
  },
  {
    label: "Report",
    active: false,
    svg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
        <rect x="5.5" y="3.5" width="13" height="17" rx="1.6" />
        <line x1="8.3" y1="8.5" x2="15.7" y2="8.5" />
        <line x1="8.3" y1="12" x2="15.7" y2="12" />
        <line x1="8.3" y1="15.5" x2="12.5" y2="15.5" />
      </svg>
    ),
  },
  {
    label: "Impostazioni",
    active: false,
    svg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M12 3.8v2.1M12 18.1v2.1M20.2 12h-2.1M5.9 12H3.8M17.5 6.5l-1.5 1.5M8 16l-1.5 1.5M17.5 17.5L16 16M8 8L6.5 6.5" />
      </svg>
    ),
  },
];

export default function HomePage() {
  const overallScore = Math.round(CATEGORIES.reduce((sum, c) => sum + c.score, 0) / CATEGORIES.length);

  return (
    <main id="top">
      <LandingNav />

      {/* HERO */}
      <section className="relative overflow-hidden px-5 py-14 sm:px-8 sm:py-20">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 opacity-90"
          style={{
            backgroundImage:
              "radial-gradient(560px 320px at 82% 8%, #EAF1FE, transparent 70%), radial-gradient(#D7D2C6 1px, transparent 1px)",
            backgroundSize: "auto, 24px 24px",
          }}
        />
        <div className="mx-auto grid max-w-[1120px] grid-cols-1 items-center gap-11 lg:grid-cols-[1.05fr_1fr] lg:gap-14">
          <div className="animate-fadeUp">
            <div className="mb-3.5 flex items-center gap-2.5">
              <span className="block h-px w-[26px] bg-accentBlue" />
              <span className="text-xs font-semibold uppercase tracking-wider text-accentBlue">Analisi tecnica · SEO · Conversione</span>
            </div>
            <h1 className="text-balance font-display text-[34px] font-semibold leading-[1.08] tracking-tight sm:text-[54px]">
              Scopri quanto vale davvero il tuo sito web.
            </h1>
            <p className="mt-[18px] max-w-[52ch] text-lg leading-relaxed text-ink-soft">
              DigitalCheck analizza il tuo sito sotto molteplici aspetti e trasforma i dati in indicazioni concrete per migliorarlo.
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3.5">
              <Link
                href="/register"
                className="inline-flex items-center justify-center rounded-md bg-accentBlue px-6 py-3.5 text-[15.5px] font-medium text-white shadow-sm transition-colors hover:bg-accentBlue-deep"
              >
                Analizza il tuo sito →
              </Link>
              <a
                href="#digital-score"
                className="inline-flex items-center justify-center rounded-md border border-line-strong px-6 py-3.5 text-[15.5px] font-medium text-ink transition-colors hover:border-accentBlue hover:text-accentBlue"
              >
                Guarda un report di esempio
              </a>
            </div>
            <p className="mt-3.5 text-[13px] text-ink-faint">Include un piano Free per iniziare subito, senza impegno.</p>
          </div>

          <div className="animate-fadeUp [animation-delay:140ms]">
            <div className="overflow-hidden rounded-[14px] border border-line bg-white shadow-[0_24px_60px_-16px_rgba(16,20,28,0.18),0_8px_20px_-8px_rgba(16,20,28,0.08)]">
              <div className="flex items-center justify-between gap-2.5 border-b border-line px-5 py-4">
                <span className="flex min-w-0 items-center gap-1.5 overflow-hidden whitespace-nowrap font-mono text-xs text-ink-faint">
                  <b className="font-medium text-ink-soft">digitalcheck.app</b>
                  <span className="text-line-strong">/</span>esempio-hotel-roma.it
                </span>
                <span className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-accent/10 px-2.5 py-1 text-[11.5px] font-medium text-accent">
                  <i className="block h-1.5 w-1.5 rounded-full bg-accent" />
                  Aggiornato ora
                </span>
              </div>
              <div className="flex items-center gap-1 border-b border-line px-3.5 pt-2">
                <span className="-mb-px border-b-2 border-accentBlue px-3 py-2 text-[12.5px] font-medium text-accentBlue">Panoramica</span>
                <span className="-mb-px px-3 py-2 text-[12.5px] font-medium text-ink-faint">Problemi</span>
                <span className="-mb-px px-3 py-2 text-[12.5px] font-medium text-ink-faint">Azioni</span>
              </div>
              <div className="flex">
                <div className="flex w-[42px] shrink-0 flex-col items-center gap-2.5 border-r border-line bg-paper py-3.5">
                  {RAIL_ICONS.map((r) => (
                    <span
                      key={r.label}
                      title={r.label}
                      className={`flex h-[26px] w-[26px] items-center justify-center rounded-md [&_svg]:h-3.5 [&_svg]:w-3.5 ${
                        r.active ? "bg-accentBlue-soft text-accentBlue" : "text-ink-faint"
                      }`}
                    >
                      {r.svg}
                    </span>
                  ))}
                </div>
                <div className="min-w-0 flex-1 px-5 py-6">
                  <div className="flex items-center gap-5">
                    <DigitalScoreGauge score={overallScore} size={132} strokeWidth={10} />
                    <div className="min-w-0">
                      <p className="text-[15px] font-semibold" style={{ color: BAND_HEX.strong }}>
                        {BAND_LABEL.strong}
                      </p>
                      <p className="mt-0.5 text-[12.5px] text-ink-faint">Calcolato su 8 categorie, pesate per tipo di attività.</p>
                    </div>
                  </div>
                  <div className="mt-5 flex flex-col gap-2.5">
                    {CATEGORIES.map((c) => (
                      <div key={c.key} className="grid grid-cols-[88px_1fr_30px] items-center gap-2.5">
                        <span className="text-[12.5px] text-ink-soft">{c.name}</span>
                        <AnimatedBar value={c.score} className="h-1.5" />
                        <span className="text-right font-mono text-xs tabular-nums text-ink-faint">{c.score}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="border-t border-dashed border-line px-5 py-3 text-[11px] text-ink-faint">
                Dati dimostrativi — non provengono da un&apos;analisi reale.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* COME FUNZIONA */}
      <section id="come-funziona" className="border-b border-line px-5 py-[52px] sm:px-8 sm:py-[72px]">
        <div className="mx-auto max-w-[1120px]">
          <div className="mb-8 max-w-[640px] animate-fadeUp">
            <div className="mb-3.5 flex items-center gap-2.5">
              <span className="block h-px w-[26px] bg-accentBlue" />
              <span className="text-xs font-semibold uppercase tracking-wider text-accentBlue">Come funziona</span>
            </div>
            <h2 className="text-balance font-display text-[clamp(28px,4vw,38px)] font-semibold">Tre passaggi, senza complicazioni.</h2>
          </div>
          <div className="grid grid-cols-1 gap-7 sm:grid-cols-3 sm:gap-9">
            {[
              { n: "01", title: "Inserisci il sito", text: "Indica l'indirizzo del sito, il tipo di attività e il tuo obiettivo principale." },
              {
                n: "02",
                title: "DigitalCheck analizza",
                text: "Il sistema esamina SEO, aspetti tecnici, mobile, contenuti e capacità di conversione.",
              },
              { n: "03", title: "Scopri cosa migliorare", text: "Ricevi un Digital Score e indicazioni pratiche, spiegate in linguaggio semplice." },
            ].map((step, i) => (
              <div key={step.n} className="animate-fadeUp" style={{ animationDelay: `${50 + i * 80}ms` }}>
                <div className="relative mb-4 h-px w-full bg-line">
                  <span className="absolute left-0 top-[-1px] h-[3px] w-[22px] rounded-sm bg-accentBlue" />
                </div>
                <span className="font-mono text-[13px] font-medium text-accentBlue">{step.n}</span>
                <h3 className="mt-2.5 text-[19px] font-semibold">{step.title}</h3>
                <p className="mt-2 text-[14.5px] leading-relaxed text-ink-soft">{step.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* DIGITAL SCORE */}
      <section id="digital-score" className="relative border-b border-line px-5 py-[52px] sm:px-8 sm:py-[72px]">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10"
          style={{
            backgroundImage: "radial-gradient(#D7D2C6 1px, transparent 1px)",
            backgroundSize: "24px 24px",
            maskImage: "radial-gradient(640px 420px at 50% 0%, #000, transparent 78%)",
            WebkitMaskImage: "radial-gradient(640px 420px at 50% 0%, #000, transparent 78%)",
          }}
        />
        <div className="relative mx-auto grid max-w-[1120px] grid-cols-1 items-start gap-11 lg:grid-cols-2">
          <div className="animate-fadeUp">
            <div className="mb-3.5 flex items-center gap-2.5">
              <span className="block h-px w-[26px] bg-accentBlue" />
              <span className="text-xs font-semibold uppercase tracking-wider text-accentBlue">Digital Score</span>
            </div>
            <h2 className="text-balance font-display text-[clamp(28px,4vw,38px)] font-semibold">Il tuo sito, in un unico numero.</h2>
            <p className="mt-3.5 max-w-[48ch] text-[16.5px] leading-relaxed text-ink-soft">
              Un punteggio da 0 a 100 che riassume lo stato del sito, calcolato con pesi diversi per categoria a seconda del tipo di
              attività — non una semplice media.
            </p>
            <div className="mt-7 grid grid-cols-2 gap-2.5 sm:grid-cols-5">
              {BAND_LEGEND.map((b) => (
                <div key={b.range} className="rounded-md border border-line bg-white p-3">
                  <p className="font-mono text-[15px] font-medium" style={{ color: BAND_HEX[b.band] }}>
                    {b.range}
                  </p>
                  <p className="mt-0.5 text-[11.5px] text-ink-faint">{BAND_LABEL[b.band]}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="flex animate-fadeUp flex-col items-center gap-6 pt-1.5 [animation-delay:140ms]">
            <DigitalScoreGauge score={overallScore} size={190} strokeWidth={13} />
            <div className="flex w-full max-w-[360px] flex-col gap-3.5">
              {CATEGORIES.map((c) => (
                <div key={c.key} className="grid grid-cols-[150px_1fr_34px] items-center gap-3 max-[420px]:grid-cols-[96px_1fr_30px]">
                  <span className="text-sm font-medium">{c.name}</span>
                  <AnimatedBar value={c.score} className="h-1.5" />
                  <span className="text-right font-mono text-[13px] tabular-nums text-ink-faint">{c.score}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* LE 8 ANALISI */}
      <section id="analisi" className="border-b border-line px-5 py-[52px] sm:px-8 sm:py-[72px]">
        <div className="mx-auto max-w-[1120px]">
          <div className="mb-8 max-w-[640px] animate-fadeUp">
            <div className="mb-3.5 flex items-center gap-2.5">
              <span className="block h-px w-[26px] bg-accentBlue" />
              <span className="text-xs font-semibold uppercase tracking-wider text-accentBlue">Le 8 analisi</span>
            </div>
            <h2 className="text-balance font-display text-[clamp(28px,4vw,38px)] font-semibold">Ogni aspetto del sito, sotto controllo.</h2>
            <p className="mt-3 text-[16.5px] leading-relaxed text-ink-soft">
              Nessun giudizio generico: una valutazione strutturata su otto categorie indipendenti, GEO incluso.
            </p>
          </div>
          <div className="animate-fadeUp overflow-hidden rounded-[14px] border border-line bg-white shadow-sm [animation-delay:140ms]">
            {CATEGORIES.map((c) => (
              <div
                key={c.key}
                className="grid grid-cols-[34px_1fr_auto] items-center gap-3 border-b border-line px-4 py-3.5 transition-colors last:border-b-0 hover:bg-paper sm:grid-cols-[38px_1fr_auto] sm:gap-4 sm:px-5 sm:py-4"
              >
                <div className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-md bg-accentBlue-soft text-accentBlue [&_svg]:h-[17px] [&_svg]:w-[17px]">
                  {c.icon}
                </div>
                <div className="min-w-0">
                  <h3 className="text-[14.5px] font-semibold">{c.name}</h3>
                  <p className="mt-0.5 text-[12.5px] leading-snug text-ink-soft">{c.desc}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <AnimatedBar value={c.score} className="hidden h-[5px] w-14 sm:block" />
                  <span className="w-[26px] text-right font-mono text-[12.5px] tabular-nums text-ink-faint">{c.score}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* DAL DATO ALL'AZIONE */}
      <section className="border-b border-line bg-white px-5 py-[52px] sm:px-8 sm:py-[72px]">
        <div className="mx-auto max-w-[1120px]">
          <div className="mb-8 max-w-[640px] animate-fadeUp">
            <div className="mb-3.5 flex items-center gap-2.5">
              <span className="block h-px w-[26px] bg-accentBlue" />
              <span className="text-xs font-semibold uppercase tracking-wider text-accentBlue">Dal dato all&apos;azione</span>
            </div>
            <h2 className="text-balance font-display text-[clamp(28px,4vw,38px)] font-semibold">Non un voto. Un percorso.</h2>
            <p className="mt-3 text-[16.5px] leading-relaxed text-ink-soft">
              DigitalCheck non si ferma al punteggio: interpreta i dati raccolti e li trasforma in indicazioni comprensibili e operative,
              in ordine di priorità.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-4">
            {[
              { n: "01", title: "Rileva", text: "Individua il problema con dati tecnici verificabili." },
              { n: "02", title: "Interpreta", text: "Spiega perché è importante per la tua attività." },
              { n: "03", title: "Prioritizza", text: "Indica cosa dovrebbe essere risolto prima." },
              { n: "04", title: "Agisci", text: "Fornisce indicazioni pratiche, spiegate in linguaggio semplice." },
            ].map((step, i) => (
              <div
                key={step.n}
                className={`animate-fadeUp border-t border-line px-0 py-5 first:border-t-0 sm:border-l sm:border-t-0 sm:px-5 sm:py-0.5 sm:first:border-l-0 sm:first:pl-0`}
                style={{ animationDelay: `${50 + i * 80}ms` }}
              >
                <span className="font-mono text-[13px] font-medium text-accentBlue">{step.n}</span>
                <h3 className="mt-2 text-[17px] font-semibold">{step.title}</h3>
                <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-soft">{step.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FREE VS PRO */}
      <section id="pricing" className="border-b border-line px-5 py-[52px] sm:px-8 sm:py-[72px]">
        <div className="mx-auto max-w-[1120px]">
          <div className="mb-8 max-w-[640px] animate-fadeUp">
            <div className="mb-3.5 flex items-center gap-2.5">
              <span className="block h-px w-[26px] bg-accentBlue" />
              <span className="text-xs font-semibold uppercase tracking-wider text-accentBlue">Piani</span>
            </div>
            <h2 className="text-balance font-display text-[clamp(28px,4vw,38px)] font-semibold">Scopri DigitalCheck.</h2>
            <p className="mt-3 text-[16.5px] leading-relaxed text-ink-soft">Analizza, monitora e migliora i tuoi siti web.</p>
          </div>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div className="animate-fadeUp rounded-[14px] border border-line bg-white p-7">
              <h3 className="text-xl font-semibold">Free</h3>
              <p className="mt-1 text-[13.5px] text-ink-soft">Per provare concretamente il servizio</p>
              <p className="mt-5 font-display text-[42px] font-semibold">€0</p>
              <ul className="mt-5 flex flex-col gap-2.5">
                {FREE_FEATURES.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-[13.8px] leading-tight text-ink-soft">
                    <span className="text-accent">
                      <CheckIcon />
                    </span>
                    {f}
                  </li>
                ))}
              </ul>
              <ul className="mt-3.5 flex flex-col gap-2.5 border-t border-line pt-3.5">
                {FREE_MISSING.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-[13.8px] leading-tight text-ink-faint">
                    <CrossIcon />
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                href="/register"
                className="mt-6 block rounded-md border border-line-strong px-4 py-2.5 text-center text-sm font-medium text-ink hover:border-accentBlue hover:text-accentBlue"
              >
                Inizia gratis
              </Link>
            </div>

            <div className="relative animate-fadeUp rounded-[14px] border border-accentBlue bg-white p-7 shadow-[0_0_0_1px_theme(colors.accentBlue.DEFAULT),0_8px_24px_-8px_rgba(16,20,28,0.12)] [animation-delay:140ms]">
              <span className="absolute -top-3 right-6 rounded-full bg-accentBlue px-2.5 py-1 text-[11px] font-semibold text-white">
                Consigliato
              </span>
              <h3 className="text-xl font-semibold">DigitalCheck Pro</h3>
              <p className="mt-1 text-[13.5px] text-ink-soft">La piattaforma completa</p>
              <p className="mt-5 font-display text-[42px] font-semibold">
                €6,99 <span className="font-body text-sm font-normal text-ink-soft">/ mese</span>
              </p>
              <ul className="mt-5 flex flex-col gap-2.5">
                {PRO_FEATURES.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-[13.8px] leading-tight text-ink-soft">
                    <span className="text-accent">
                      <CheckIcon />
                    </span>
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                href="/register"
                className="mt-6 block rounded-md bg-accentBlue px-4 py-2.5 text-center text-sm font-medium text-white hover:bg-accentBlue-deep"
              >
                Passa a Pro →
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="border-b border-line px-5 py-[52px] sm:px-8 sm:py-[72px]">
        <div className="mx-auto max-w-[1120px]">
          <div className="mb-8 max-w-[640px] animate-fadeUp">
            <div className="mb-3.5 flex items-center gap-2.5">
              <span className="block h-px w-[26px] bg-accentBlue" />
              <span className="text-xs font-semibold uppercase tracking-wider text-accentBlue">FAQ</span>
            </div>
            <h2 className="text-balance font-display text-[clamp(28px,4vw,38px)] font-semibold">Domande frequenti.</h2>
          </div>
          <div className="flex max-w-[720px] animate-fadeUp flex-col [animation-delay:140ms]">
            {FAQ.map((item, i) => (
              <details key={item.q} className="group border-b border-line py-1.5" open={i === 0}>
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 text-base font-medium marker:content-none [&::-webkit-details-marker]:hidden">
                  {item.q}
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    className="h-[18px] w-[18px] shrink-0 text-ink-faint transition-transform duration-200 group-open:rotate-45"
                  >
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                </summary>
                <p className="max-w-[64ch] px-0.5 pb-[18px] text-[14.5px] leading-relaxed text-ink-soft">{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* CTA FINALE */}
      <section className="relative overflow-hidden px-5 py-16 text-center sm:px-8 sm:py-20">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10"
          style={{ backgroundImage: "radial-gradient(680px 320px at 50% 0%, #EAF1FE, transparent 72%)" }}
        />
        <h2 className="mx-auto max-w-[20ch] text-balance animate-fadeUp font-display text-[clamp(28px,4.6vw,42px)] font-semibold">
          Scopri cosa sta realmente funzionando nel tuo sito.
        </h2>
        <p className="mt-3.5 animate-fadeUp text-[16.5px] text-ink-soft [animation-delay:50ms]">Analizzalo con DigitalCheck.</p>
        <Link
          href="/register"
          className="mt-7 inline-flex animate-fadeUp items-center justify-center rounded-md bg-accentBlue px-6 py-3.5 text-[15.5px] font-medium text-white transition-colors hover:bg-accentBlue-deep [animation-delay:140ms]"
        >
          Analizza il tuo sito →
        </Link>
      </section>

      {/* FOOTER */}
      <footer className="px-5 py-11 sm:px-8">
        <div className="mx-auto max-w-[1120px]">
          <div className="grid grid-cols-1 gap-9 sm:grid-cols-[1.4fr_1fr_1fr_1fr]">
            <div>
              <div className="mb-2.5 flex items-center gap-2.5">
                <img src="/logo-transparent.png" alt="" className="h-[26px] w-auto" />
                <span className="flex flex-col leading-tight">
                  <span className="font-display text-lg font-semibold">DigitalCheck</span>
                  <span className="text-[10px] text-ink-faint">powered by Imperium Digital</span>
                </span>
              </div>
              <p className="max-w-[34ch] text-[13px] leading-relaxed text-ink-faint">
                Analisi tecnica, SEO e di conversione per capire davvero come sta andando il tuo sito.
              </p>
            </div>
            <div>
              <h4 className="mb-3.5 text-xs font-semibold uppercase tracking-wider text-ink-faint">Prodotto</h4>
              <ul className="flex flex-col gap-2.5 text-[13.8px] text-ink-soft">
                <li>
                  <a href="#come-funziona" className="hover:text-ink">
                    Come funziona
                  </a>
                </li>
                <li>
                  <a href="#digital-score" className="hover:text-ink">
                    Digital Score
                  </a>
                </li>
                <li>
                  <a href="#pricing" className="hover:text-ink">
                    Piano Pro
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="mb-3.5 text-xs font-semibold uppercase tracking-wider text-ink-faint">Risorse</h4>
              <ul className="flex flex-col gap-2.5 text-[13.8px] text-ink-soft">
                <li>
                  <a href="#analisi" className="hover:text-ink">
                    Le 8 analisi
                  </a>
                </li>
                <li>
                  <a href="#faq" className="hover:text-ink">
                    FAQ
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="mb-3.5 text-xs font-semibold uppercase tracking-wider text-ink-faint">Legal</h4>
              <ul className="flex flex-col gap-2.5 text-[13.8px] text-ink-soft">
                <li>
                  <Link href="/privacy" className="hover:text-ink">
                    Privacy Policy
                  </Link>
                </li>
                <li>
                  <Link href="/termini" className="hover:text-ink">
                    Termini di Servizio
                  </Link>
                </li>
              </ul>
            </div>
          </div>
          <div className="mt-11 flex flex-wrap items-center justify-between gap-x-[18px] gap-y-2.5 border-t border-line pt-[22px] text-xs text-ink-faint">
            <span>© {new Date().getFullYear()} Imperium Digital</span>
            <span>Tutti i dati mostrati provengono da analisi tecniche reali.</span>
          </div>
        </div>
      </footer>
    </main>
  );
}
