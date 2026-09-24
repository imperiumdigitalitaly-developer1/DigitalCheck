import * as cheerio from "cheerio";
import type { CrawlResult, SeoFacts } from "@/types";
import type { AnalysisResult } from "../types";
import { buildAnalysisResult, finding, recommendation, stripHtmlToText, sub } from "../helpers";

// Sottopunteggi SEO (brief audit sezione 5): On-page, Technical SEO,
// Indexability, Structured Data, Internal Linking, Content Signals.
const WEIGHTS = {
  onPage: 0.3,
  technicalSeo: 0.2,
  indexability: 0.15,
  structuredData: 0.15,
  internalLinking: 0.1,
  contentSignals: 0.1,
};

function detectNoindex(html: string): boolean {
  const $ = cheerio.load(html);
  const robotsMeta = $('meta[name="robots"]').attr("content") ?? "";
  return /noindex/i.test(robotsMeta);
}

function robotsDisallowsAll(robotsTxt: string | undefined): boolean {
  if (!robotsTxt) return false;
  return /User-agent:\s*\*\s*[\r\n]+\s*Disallow:\s*\/\s*$/im.test(robotsTxt);
}

export function analyzeSeo(facts: SeoFacts, crawl: CrawlResult): AnalysisResult {
  const findings = [];
  const recommendations = [];
  const strengths: string[] = [];
  const home = crawl.pages[0];

  // ---- On-page --------------------------------------------------------
  let onPageScore = 100;
  if (!facts.title) {
    onPageScore -= 25;
    findings.push(
      finding(
        "seo",
        "Titolo della pagina mancante",
        "critical",
        "La homepage non ha un tag <title>: e' il primo elemento mostrato nei risultati di ricerca e nella scheda del browser.",
        "Visibilita' nei risultati di ricerca"
      )
    );
    recommendations.push(
      recommendation(
        "seo",
        "Aggiungi un titolo alla homepage",
        "critical",
        "Senza titolo, Google e i visitatori non capiscono subito di cosa tratta il sito.",
        "Visibilita' nei risultati di ricerca",
        "Aggiungi un titolo unico di 50-60 caratteri che descriva l'attivita' e la localita'."
      )
    );
  } else {
    strengths.push("La homepage ha un titolo definito.");
    if (facts.titleLength < 20 || facts.titleLength > 65) {
      onPageScore -= 8;
      findings.push(
        finding(
          "seo",
          "Lunghezza del titolo non ottimale",
          "low",
          `Il titolo e' lungo ${facts.titleLength} caratteri: troppo corto non sfrutta lo spazio nei risultati, troppo lungo viene troncato da Google.`,
          "Click-through rate nei risultati di ricerca",
          facts.title
        )
      );
      recommendations.push(
        recommendation("seo", "Ottimizza la lunghezza del titolo", "low", "Un titolo fuori range viene troncato o sotto-sfruttato nei risultati di ricerca.", "Click-through rate", "Punta a un titolo tra 50 e 60 caratteri.")
      );
    }
  }

  if (!facts.metaDescription) {
    onPageScore -= 15;
    findings.push(
      finding("seo", "Meta description assente", "high", "Non e' presente una meta description: Google ne genera una automatica, spesso meno efficace.", "Click-through rate nei risultati di ricerca")
    );
    recommendations.push(
      recommendation("seo", "Scrivi una meta description", "high", "Senza meta description, il testo mostrato sotto il titolo nei risultati e' generato automaticamente da Google.", "Click-through rate", "Scrivi 140-160 caratteri che comunichino il valore dell'attivita' con una call to action.")
    );
  } else {
    strengths.push("La homepage ha una meta description.");
  }

  if (facts.h1.length === 0) {
    onPageScore -= 15;
    findings.push(finding("seo", "Nessun H1 in pagina", "high", "L'H1 aiuta utenti e motori di ricerca a capire subito il tema della pagina.", "Chiarezza tematica per i motori di ricerca"));
    recommendations.push(
      recommendation("seo", "Aggiungi un H1", "high", "Senza H1 manca il segnale piu' diretto del tema principale della pagina.", "Chiarezza tematica", "Aggiungi un H1 chiaro, es. nome attivita' + localita' o proposta di valore.")
    );
  } else if (facts.h1.length > 1) {
    onPageScore -= 6;
    findings.push(finding("seo", "Piu' di un H1 nella pagina", "low", `Rilevati ${facts.h1.length} tag H1: puo' confondere la gerarchia dei contenuti.`, "Chiarezza della struttura per i motori di ricerca"));
  }

  const altRatio = facts.images.total > 0 ? facts.images.withAlt / facts.images.total : 1;
  if (facts.images.total > 0 && altRatio < 0.8) {
    const missing = facts.images.total - facts.images.withAlt;
    onPageScore -= Math.min(15, missing * 2);
    findings.push(
      finding("seo", "Immagini senza testo alternativo", "medium", `${missing} immagini su ${facts.images.total} non hanno l'attributo alt: e' anche un segnale usato per l'indicizzazione immagini.`, "Indicizzazione immagini")
    );
  }

  // ---- Technical SEO ----------------------------------------------------
  let technicalSeoScore = 100;
  if (!facts.robotsTxtPresent) {
    technicalSeoScore -= 15;
    findings.push(finding("seo", "robots.txt non trovato", "low", "Il file /robots.txt non e' raggiungibile: non si puo' guidare esplicitamente il comportamento dei crawler.", "Controllo della scansione del sito"));
    recommendations.push(recommendation("seo", "Aggiungi un robots.txt", "low", "Senza robots.txt non hai controllo esplicito su cosa i crawler non devono indicizzare.", "Controllo della scansione", "Aggiungi un file robots.txt, anche minimale, nella root del sito."));
  } else {
    strengths.push("robots.txt presente e raggiungibile.");
  }
  if (!facts.sitemapPresent) {
    technicalSeoScore -= 15;
    findings.push(finding("seo", "sitemap.xml non trovata", "low", "La sitemap aiuta i motori di ricerca a scoprire tutte le pagine del sito.", "Copertura di indicizzazione"));
    recommendations.push(recommendation("seo", "Genera una sitemap.xml", "low", "Senza sitemap, la scoperta di pagine poco collegate tra loro e' piu' lenta.", "Copertura di indicizzazione", "Genera una sitemap.xml e segnalala nel robots.txt."));
  } else {
    strengths.push("sitemap.xml presente.");
  }
  if (!facts.canonical) {
    technicalSeoScore -= 10;
  }
  if (facts.statusCode >= 400) {
    technicalSeoScore -= 40;
    findings.push(finding("seo", "La homepage restituisce un errore", "critical", `Codice di stato HTTP ${facts.statusCode}: sia visitatori che motori di ricerca non riescono ad accedere al sito.`, "Accessibilita' del sito"));
  }
  const redirectHops = home?.redirectCount ?? 0;
  if (redirectHops > 1) {
    technicalSeoScore -= 8;
    findings.push(finding("seo", "Catena di redirect sulla homepage", "low", `La homepage richiede ${redirectHops} redirect prima di rispondere: ogni hop rallenta il crawling e il caricamento.`, "Efficienza di scansione e velocita'"));
  }

  // ---- Indexability -------------------------------------------------
  let indexabilityScore = 100;
  const noindex = home ? detectNoindex(home.html) : false;
  if (noindex) {
    indexabilityScore -= 60;
    findings.push(
      finding("seo", "La homepage e' impostata su noindex", "critical", "Un meta robots 'noindex' impedisce esplicitamente ai motori di ricerca di indicizzare la pagina.", "Presenza nei risultati di ricerca")
    );
    recommendations.push(recommendation("seo", "Rimuovi il noindex dalla homepage", "critical", "Con noindex attivo la homepage non puo' comparire nei risultati di ricerca, indipendentemente da ogni altro fattore SEO.", "Presenza nei risultati di ricerca", "Rimuovi la direttiva noindex dal meta tag robots della homepage, se non e' intenzionale."));
  }
  if (robotsDisallowsAll(crawl.robotsTxt.content)) {
    indexabilityScore -= 40;
    findings.push(finding("seo", "robots.txt blocca l'intera scansione", "critical", "Il robots.txt contiene 'Disallow: /' per tutti gli user-agent: impedisce la scansione dell'intero sito.", "Presenza nei risultati di ricerca"));
  }
  if (!facts.canonical) {
    indexabilityScore -= 10;
  } else {
    try {
      const canonicalUrl = new URL(facts.canonical, facts.url);
      if (canonicalUrl.origin !== new URL(facts.url).origin) {
        indexabilityScore -= 5; // non necessariamente un errore, ma degno di nota
      }
    } catch {
      indexabilityScore -= 10;
      findings.push(finding("seo", "Canonical non valido", "low", "Il tag canonical non contiene un URL valido.", "Consolidamento del segnale di indicizzazione"));
    }
  }

  // ---- Structured Data ------------------------------------------------
  // Non penalizza l'assenza di schema non pertinente (brief sezione 5):
  // punteggio basato su presenza/validita', non su un elenco di schema
  // "obbligatori" per ogni tipo di attivita'.
  let structuredDataScore = 60; // punto di partenza neutro se assente
  if (facts.structuredData.present) {
    structuredDataScore = 85 + Math.min(15, facts.structuredData.types.length * 3);
    strengths.push(`Dati strutturati presenti (${facts.structuredData.types.join(", ")}).`);
  } else {
    findings.push(finding("seo", "Dati strutturati assenti", "medium", "Non e' presente markup JSON-LD (schema.org): aiuta Google a mostrare risultati arricchiti e a capire meglio il tipo di attivita'.", "Idoneita' a rich snippet e comprensione semantica"));
    recommendations.push(recommendation("seo", "Aggiungi dati strutturati JSON-LD", "medium", "Senza schema.org, Google deve inferire il tipo di attivita' e i contenuti solo dal testo.", "Idoneita' a rich snippet", "Aggiungi markup schema.org pertinente (es. LocalBusiness, Restaurant, Product a seconda del tipo di attivita')."));
  }

  // ---- Internal Linking ------------------------------------------------
  // Limite noto: il crawler segue solo i link trovati dalla homepage, quindi
  // non puo' rilevare pagine davvero "orfane" nel sito (brief sezione 34:
  // dichiarato esplicitamente come dato parziale, non un vero site audit).
  let internalLinkingScore = 100;
  const internalLinkingDataAvailability = crawl.pages.length > 1 ? "partial" : "partial";
  if (facts.internalLinks === 0) {
    internalLinkingScore = 20;
    findings.push(finding("seo", "Nessun link interno rilevato in homepage", "high", "La homepage non contiene link verso altre pagine del sito: rende piu' difficile per utenti e crawler raggiungere il resto del sito.", "Distribuzione dell'autorevolezza interna e navigabilita'"));
  } else if (facts.internalLinks < 3) {
    internalLinkingScore = 55;
    findings.push(finding("seo", "Pochi link interni in homepage", "medium", `Solo ${facts.internalLinks} link interni rilevati in homepage.`, "Distribuzione dell'autorevolezza interna"));
  } else {
    strengths.push(`${facts.internalLinks} link interni rilevati in homepage.`);
  }

  // ---- Content Signals --------------------------------------------------
  let contentSignalsScore = 100;
  const homeText = home ? stripHtmlToText(home.html) : "";
  const wordCount = homeText ? homeText.split(/\s+/).filter(Boolean).length : 0;
  if (wordCount < 100) {
    contentSignalsScore -= 30;
    findings.push(finding("seo", "Contenuto testuale molto ridotto in homepage", "medium", `Circa ${wordCount} parole di testo visibile rilevate in homepage: puo' limitare la rilevanza percepita dai motori di ricerca per le query pertinenti.`, "Rilevanza tematica percepita dai motori di ricerca"));
  }
  const titles = crawl.pages.map((p) => cheerio.load(p.html)("title").first().text().trim()).filter(Boolean);
  const uniqueTitles = new Set(titles);
  if (titles.length > 1 && uniqueTitles.size < titles.length) {
    contentSignalsScore -= 20;
    findings.push(finding("seo", "Titoli duplicati tra le pagine analizzate", "medium", "Piu' pagine analizzate condividono lo stesso tag <title>: rende piu' difficile per i motori di ricerca distinguerle.", "Distinzione delle pagine nei risultati di ricerca"));
    recommendations.push(recommendation("seo", "Rendi unici i titoli delle pagine", "medium", "Titoli duplicati confondono l'indicizzazione di pagine diverse come se fossero la stessa.", "Distinzione nei risultati di ricerca", "Scrivi un titolo unico e specifico per ciascuna pagina del sito."));
  }
  if (!facts.openGraph.present) {
    contentSignalsScore -= 5;
  }

  const subScores = [
    sub("on_page", "On-page", onPageScore, WEIGHTS.onPage),
    sub("technical_seo", "Technical SEO", technicalSeoScore, WEIGHTS.technicalSeo),
    sub("indexability", "Indexability", indexabilityScore, WEIGHTS.indexability),
    sub("structured_data", "Structured Data", structuredDataScore, WEIGHTS.structuredData),
    sub("internal_linking", "Internal Linking", internalLinkingScore, WEIGHTS.internalLinking, internalLinkingDataAvailability),
    sub("content_signals", "Content Signals", contentSignalsScore, WEIGHTS.contentSignals),
  ];

  return buildAnalysisResult({
    category: "seo",
    subScores,
    strengths,
    findings,
    recommendations,
    metrics: {
      title_length: facts.titleLength || null,
      meta_description_length: facts.metaDescriptionLength || null,
      h1_count: facts.h1.length,
      internal_links: facts.internalLinks,
      structured_data_types: facts.structuredData.types.join(", ") || null,
      word_count_home: wordCount || null,
    },
    shortSummary:
      onPageScore >= 75 && technicalSeoScore >= 75
        ? "Struttura SEO complessivamente solida, con margini di miglioramento su alcuni dettagli tecnici o di contenuto."
        : "La struttura SEO presenta alcune lacune su elementi fondamentali come titoli, metadati o indicizzabilita'.",
  });
}
