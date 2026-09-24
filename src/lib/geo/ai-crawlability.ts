import type { CrawlResult, SeoFacts } from "@/types";
import type { GeoIssue } from "./geo-types";
import { stripHtmlToText } from "./text-utils";

// User-agent dei principali crawler AI/answer engine noti pubblicamente.
// L'elenco non e' esaustivo e i provider possono cambiarlo: il controllo
// resta un segnale tecnico ("questi user-agent risultano bloccati nel
// robots.txt"), non una garanzia sul comportamento reale dei bot.
const AI_CRAWLER_USER_AGENTS = [
  "GPTBot",
  "ChatGPT-User",
  "OAI-SearchBot",
  "Google-Extended",
  "PerplexityBot",
  "ClaudeBot",
  "anthropic-ai",
  "CCBot",
  "Bytespider",
  "Applebot-Extended",
  "Amazonbot",
];

interface RobotsBlock {
  userAgents: string[];
  disallowAll: boolean;
}

function parseRobotsBlocks(content: string): RobotsBlock[] {
  const lines = content.split(/\r?\n/).map((l) => l.trim());
  const blocks: RobotsBlock[] = [];
  let current: RobotsBlock | null = null;
  let sawRuleSinceLastAgent = false;

  for (const line of lines) {
    if (!line || line.startsWith("#")) continue;
    const [rawKey, ...rest] = line.split(":");
    const key = rawKey?.trim().toLowerCase();
    const value = rest.join(":").trim();
    if (key === "user-agent") {
      if (!current || sawRuleSinceLastAgent) {
        current = { userAgents: [], disallowAll: false };
        blocks.push(current);
        sawRuleSinceLastAgent = false;
      }
      current.userAgents.push(value);
    } else if (key === "disallow" && current) {
      sawRuleSinceLastAgent = true;
      if (value === "/" || value === "") current.disallowAll = current.disallowAll || value === "/";
    } else if (key === "allow" && current) {
      sawRuleSinceLastAgent = true;
    }
  }
  return blocks;
}

function blockedAiCrawlers(robotsContent: string): string[] {
  const blocks = parseRobotsBlocks(robotsContent);
  const blocked = new Set<string>();
  for (const block of blocks) {
    if (!block.disallowAll) continue;
    const wildcard = block.userAgents.some((ua) => ua === "*");
    for (const bot of AI_CRAWLER_USER_AGENTS) {
      const matches = block.userAgents.some((ua) => ua.toLowerCase() === bot.toLowerCase());
      if (matches || wildcard) blocked.add(bot);
    }
  }
  return Array.from(blocked);
}

/**
 * Categoria "AI Crawlability & Accessibility" (brief GEO sezione 3A):
 * verifica se ci sono ostacoli tecnici rilevabili all'accesso del sito da
 * parte di crawler/sistemi automatici — dati gia' raccolti dal crawl
 * esistente (SSRF-safe), nessuna nuova richiesta.
 */
export function scoreAiAccessibility(
  facts: SeoFacts,
  crawl: CrawlResult,
  issues: GeoIssue[]
): { score: number; notes?: string } {
  let score = 100;
  const notes: string[] = [];

  if (facts.statusCode >= 400) {
    score -= 40;
    issues.push({
      category: "ai_accessibility",
      title: "La pagina analizzata restituisce un errore HTTP",
      description: `Codice di stato ${facts.statusCode} rilevato sulla homepage.`,
      whyItMatters: "Se la pagina risponde con un errore, ne' i crawler tradizionali ne' quelli AI possono leggerne il contenuto.",
      recommendation: "Verifica la configurazione del server e assicurati che la pagina risponda con stato 200.",
      severity: "critical",
    });
  }

  if (crawl.robotsTxt.present && crawl.robotsTxt.content) {
    const blocked = blockedAiCrawlers(crawl.robotsTxt.content);
    if (blocked.length > 0) {
      score -= Math.min(35, blocked.length * 12);
      issues.push({
        category: "ai_accessibility",
        title: "robots.txt blocca alcuni crawler AI",
        description: `Il file robots.txt disallowa esplicitamente: ${blocked.join(", ")}.`,
        whyItMatters:
          "Se questi crawler sono bloccati, i relativi motori di risposta generativa non possono accedere ai contenuti del sito per comprenderli o citarli.",
        recommendation:
          "Se l'obiettivo e' essere compreso dai sistemi di ricerca generativa, valuta di rimuovere il blocco per questi user-agent nel robots.txt (la scelta resta comunque tua: alcuni siti bloccano questi bot deliberatamente).",
        severity: "high",
      });
    } else {
      notes.push("Nessun crawler AI noto risulta bloccato nel robots.txt.");
    }
  } else {
    notes.push("robots.txt non trovato: nessuna regola esplicita per i crawler AI (ne' di blocco ne' di apertura).");
  }

  if (!crawl.sitemapXml.present) {
    score -= 8;
    issues.push({
      category: "ai_accessibility",
      title: "sitemap.xml non trovata",
      description: "Il file /sitemap.xml non e' raggiungibile.",
      whyItMatters: "La sitemap aiuta i sistemi automatici a scoprire tutte le pagine rilevanti del sito, non solo quelle collegate dalla homepage.",
      recommendation: "Genera una sitemap.xml e rendila raggiungibile dalla root del sito.",
      severity: "medium",
    });
  }

  if (!facts.canonical) {
    score -= 6;
    notes.push("Nessun tag canonical rilevato sulla homepage.");
  }

  // Euristica "contenuto solo via JavaScript": confronta il testo visibile
  // nell'HTML statico con la dimensione degli script incorporati. Un
  // rapporto molto basso e' un segnale reale (non e' stato eseguito il
  // JavaScript), non una certezza — dichiarato come tale nell'issue.
  const home = crawl.pages[0];
  if (home) {
    const visibleTextLength = stripHtmlToText(home.html.replace(/<script[\s\S]*?<\/script>/gi, " ")).length;
    const scriptMatches = home.html.match(/<script[\s\S]*?<\/script>/gi) ?? [];
    const scriptLength = scriptMatches.join("").length;
    if (scriptLength > 20_000 && visibleTextLength < 400) {
      score -= 20;
      issues.push({
        category: "ai_accessibility",
        title: "Poco contenuto testuale nell'HTML statico",
        description: `Solo ${visibleTextLength} caratteri di testo visibile rilevati a fronte di ${Math.round(
          scriptLength / 1024
        )} KB di script: il contenuto principale potrebbe essere caricato via JavaScript dopo il rendering.`,
        whyItMatters:
          "Molti sistemi di ricerca generativa leggono l'HTML cosi' come arriva dal server, senza eseguire JavaScript: se il contenuto compare solo dopo il rendering lato client, questi sistemi potrebbero non vederlo.",
        recommendation: "Valuta il server-side rendering (o il pre-rendering) almeno per i contenuti informativi principali della pagina.",
        example: "Framework come Next.js (gia' in uso qui) supportano il rendering lato server nativamente.",
        severity: "high",
      });
    }
  }

  return { score: Math.max(0, Math.min(100, score)), notes: notes.length > 0 ? notes.join(" ") : undefined };
}
