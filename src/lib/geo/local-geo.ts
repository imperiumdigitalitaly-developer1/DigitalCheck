import type { BusinessType, CrawlResult } from "@/types";
import type { EntityData, GeoIssue } from "./geo-types";
import { stripHtmlToText } from "./text-utils";

const AREA_SERVED_PATTERN = /zona|area\s+servit|raggiungiamo|copriamo\s+la\s+zona|nei\s+dintorni|provincia\s+di/i;

/**
 * Le attivita' gestite da DigitalCheck (brief business types) sono per
 * natura legate a una sede o area fisica, tranne "other" (categoria
 * generica, che puo' includere anche attivita' puramente online) — brief
 * GEO sezione 9: "Se il sito non e' locale, questa categoria deve essere
 * marcata come Non applicabile".
 */
export function isLocalApplicable(businessType: BusinessType): boolean {
  return businessType !== "other";
}

export function scoreLocalGeo(
  crawl: CrawlResult,
  businessType: BusinessType,
  entities: EntityData,
  issues: GeoIssue[]
): { score: number; notes?: string } {
  let score = 100;
  const notes: string[] = [];

  if (!entities.localBusinessSchemaPresent) {
    score -= 25;
    issues.push({
      category: "local_geo",
      title: "Nessun dato strutturato LocalBusiness",
      description: "Non e' stato rilevato markup JSON-LD di tipo LocalBusiness (o sottotipo, es. Restaurant, LodgingBusiness) per un'attivita' che opera localmente.",
      whyItMatters: "LocalBusiness e' il modo standard con cui un'attivita' locale dichiara indirizzo, telefono e orari a sistemi automatici.",
      recommendation: `Aggiungi un markup LocalBusiness (o il sottotipo piu' specifico per un'attivita' di tipo "${businessType}").`,
      severity: "high",
    });
  } else {
    notes.push("Markup LocalBusiness rilevato.");
  }

  if (!entities.contact.addressPresent) {
    score -= 20;
    issues.push({
      category: "local_geo",
      title: "Nessun indirizzo rilevato nel testo del sito",
      description: "Non e' stato rilevato un pattern di indirizzo (via/piazza/corso) nelle pagine analizzate.",
      whyItMatters: "Per un'attivita' locale, l'indirizzo e' un'informazione centrale per rispondere a 'dove si trova'.",
      recommendation: "Indica l'indirizzo completo in una posizione facilmente individuabile (es. footer o pagina contatti).",
      severity: "high",
    });
  }

  if (entities.contact.addressPresent && !entities.contact.phonePresent) {
    score -= 10;
    notes.push("Indirizzo rilevato ma nessun numero di telefono associato nelle vicinanze del testo.");
  }

  if (!entities.googleBusinessProfileLinkPresent) {
    score -= 10;
    issues.push({
      category: "local_geo",
      title: "Nessun collegamento al profilo Google Business rilevato",
      description: "Non e' stato trovato un link verso Google Maps/Google Business Profile.",
      whyItMatters: "Il profilo Google Business e' una delle fonti che i sistemi di ricerca locale e generativa incrociano piu' spesso per le attivita' locali.",
      recommendation: "Se l'attivita' ha un profilo Google Business attivo, aggiungi un link ad esso nel sito (es. nella pagina contatti).",
      severity: "medium",
    });
  }

  const text = crawl.pages.map((p) => stripHtmlToText(p.html)).join(" ");
  if (!AREA_SERVED_PATTERN.test(text)) {
    score -= 8;
  } else {
    notes.push("Rilevati riferimenti espliciti all'area geografica servita.");
  }

  return { score: Math.max(0, Math.min(100, score)), notes: notes.length > 0 ? notes.join(" ") : undefined };
}
