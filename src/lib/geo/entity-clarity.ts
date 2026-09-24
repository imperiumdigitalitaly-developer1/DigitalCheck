import type { EntityData, GeoIssue } from "./geo-types";

/**
 * Categoria "Entity & Brand Understanding" (brief GEO sezione 3C).
 * Contestuale per costruzione: non richiede uno schema specifico (es.
 * LocalBusiness) se non e' gia' emerso come pertinente — valuta solo se
 * l'ENTITA' (chi e' questa attivita') e' identificabile in qualche forma,
 * strutturata o testuale (brief: "l'analisi deve essere contestuale").
 */
export function scoreEntityClarity(entities: EntityData, issues: GeoIssue[]): { score: number; notes?: string } {
  let score = 100;
  const notes: string[] = [];

  if (entities.businessNameCandidates.length === 0) {
    score -= 25;
    issues.push({
      category: "entity_clarity",
      title: "Nome dell'attivita' non identificabile con certezza",
      description: "Ne' il tag <title>, ne' il nome del sito (og:site_name), ne' i dati strutturati dichiarano esplicitamente un nome.",
      whyItMatters: "Se un sistema non riesce a identificare con certezza il nome dell'attivita', non puo' associarle correttamente le informazioni che trova.",
      recommendation: "Dichiara il nome dell'attivita' nel <title> della homepage e, idealmente, anche in un tag og:site_name.",
      severity: "high",
    });
  }

  const hasStructuredEntity =
    entities.organizationSchemaPresent || entities.localBusinessSchemaPresent || entities.personSchemaPresent;
  if (!hasStructuredEntity) {
    score -= 20;
    issues.push({
      category: "entity_clarity",
      title: "Nessun dato strutturato descrive l'organizzazione",
      description: "Non e' stato rilevato markup JSON-LD di tipo Organization, LocalBusiness o Person sul sito.",
      whyItMatters:
        "I dati strutturati sono il modo piu' esplicito per dichiarare a un sistema automatico chi sei, cosa fai e come contattarti — senza, il sistema deve dedurlo dal solo testo, con margine di errore maggiore.",
      recommendation:
        "Valuta l'aggiunta di uno schema.org appropriato al tipo di attivita' (es. LocalBusiness per un'attivita' con sede fisica, ProfessionalService per un professionista).",
      severity: "medium",
    });
  } else {
    notes.push("Almeno un tipo di entita' e' dichiarato tramite dati strutturati.");
  }

  if (!entities.contact.phonePresent && !entities.contact.emailPresent) {
    score -= 20;
    issues.push({
      category: "entity_clarity",
      title: "Nessuna informazione di contatto rilevata",
      description: "Non e' stato rilevato ne' un numero di telefono ne' un indirizzo email nel testo del sito.",
      whyItMatters: "Senza un modo di contatto esplicito, un sistema che vuole indirizzare un utente verso l'attivita' non ha informazioni da fornire.",
      recommendation: "Rendi visibile almeno un recapito di contatto (telefono o email) in una pagina facilmente raggiungibile.",
      severity: "high",
    });
  }

  if (entities.sameAsLinks.length === 0) {
    score -= 8;
    notes.push("Nessun collegamento sameAs (es. profili social o altre presenze online ufficiali) dichiarato nei dati strutturati.");
  }

  return { score: Math.max(0, Math.min(100, score)), notes: notes.length > 0 ? notes.join(" ") : undefined };
}
