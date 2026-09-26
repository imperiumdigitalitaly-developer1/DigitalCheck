import type { Metadata } from "next";
import { LegalPageShell, LegalSection, DefaultNote } from "@/components/legal/LegalPageShell";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "Informativa sul trattamento dei dati personali degli utenti di DigitalCheck.",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <LegalPageShell title="Privacy Policy" updated="17 settembre 2026">
      <p className="text-ink-soft">
        La presente informativa descrive come DigitalCheck raccoglie, utilizza e protegge i dati
        personali degli utenti che utilizzano la piattaforma, in conformità al Regolamento (UE)
        2016/679 (&quot;GDPR&quot;) e alla normativa italiana applicabile in materia di protezione
        dei dati personali.
      </p>

      <LegalSection title="1. Titolare del trattamento">
        <p>
          Il Titolare del trattamento dei dati è Imperium Digital, gestore della piattaforma
          DigitalCheck.
        </p>
        <ul>
          <li>
            Email di contatto: <a href="mailto:imperiumdigitalitaly@gmail.com">imperiumdigitalitaly@gmail.com</a>
          </li>
        </ul>
        <p className="text-sm">
          Ragione sociale, sede legale e Partita IVA: dati societari in fase di definizione —
          aggiornamento a breve.
        </p>
      </LegalSection>

      <LegalSection title="2. Finalità e base giuridica del trattamento">
        <p>I dati personali raccolti vengono trattati per le seguenti finalità:</p>
        <ul>
          <li>
            <strong>Erogazione del servizio</strong> — creazione e gestione dell&apos;account,
            esecuzione delle analisi richieste, salvataggio della cronologia e dei report
            (base giuridica: esecuzione di un contratto, art. 6.1.b GDPR).
          </li>
          <li>
            <strong>Gestione dei pagamenti</strong> — attivazione e rinnovo dell&apos;abbonamento
            al piano Pro tramite Stripe (base giuridica: esecuzione di un contratto e obblighi
            legali connessi, art. 6.1.b e 6.1.c GDPR).
          </li>
          <li>
            <strong>Comunicazioni transazionali</strong> — invio di email di conferma
            registrazione, notifiche relative all&apos;account e al servizio (base giuridica:
            esecuzione di un contratto e legittimo interesse, art. 6.1.b e 6.1.f GDPR).
          </li>
          <li>
            <strong>Connessione volontaria con Google Analytics / Search Console</strong> —
            lettura in sola lettura dei dati di traffico e ricerca del sito analizzato, solo se
            l&apos;utente autorizza esplicitamente la connessione tramite OAuth (base giuridica:
            consenso, art. 6.1.a GDPR, revocabile in qualsiasi momento).
          </li>
          <li>
            <strong>Sicurezza e prevenzione abusi</strong> — conservazione di log tecnici per
            individuare usi anomali o non autorizzati della piattaforma (base giuridica:
            legittimo interesse, art. 6.1.f GDPR).
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="3. Dati raccolti">
        <p>DigitalCheck raccoglie e tratta le seguenti categorie di dati:</p>
        <ul>
          <li><strong>Dati account</strong>: indirizzo email e password (memorizzata come hash, mai in chiaro).</li>
          <li><strong>Dati di utilizzo del servizio</strong>: URL dei siti analizzati, risultati delle scansioni (punteggi, problemi rilevati, dati tecnici), cronologia delle analisi, utilizzo e quote del piano sottoscritto.</li>
          <li><strong>Dati di pagamento</strong>: gestiti interamente da Stripe. DigitalCheck non memorizza né ha accesso ai dati della carta di pagamento.</li>
          <li><strong>Dati di connessione Google (opzionali)</strong>: se l&apos;utente collega volontariamente il proprio account Google, DigitalCheck legge in sola lettura i dati di Google Analytics e Google Search Console relativi al sito analizzato (non dati personali dell&apos;account Google dell&apos;utente).</li>
        </ul>
      </LegalSection>

      <LegalSection title="4. Servizi terzi (sub-responsabili del trattamento)">
        <p>
          Per erogare il servizio, DigitalCheck si avvale dei seguenti fornitori terzi, che
          trattano i dati in qualità di responsabili del trattamento (o titolari autonomi per le
          finalità loro proprie, come nel caso di Stripe):
        </p>
        <ul>
          <li><strong>Vercel</strong> — hosting dell&apos;applicazione web.</li>
          <li><strong>Neon (Postgres)</strong> — hosting del database che conserva i dati account e i risultati delle analisi.</li>
          <li><strong>Stripe</strong> — elaborazione dei pagamenti per l&apos;abbonamento Pro. I dati della carta transitano esclusivamente su Stripe e non vengono mai memorizzati da DigitalCheck.</li>
          <li><strong>Resend</strong> — invio delle email transazionali (conferma registrazione, notifiche).</li>
          <li><strong>Google PageSpeed Insights API</strong> — fornisce dati tecnici di performance dei siti analizzati; non riceve dati personali dell&apos;utente.</li>
          <li><strong>Google Gemini API</strong> — elabora i risultati tecnici delle analisi per generare interpretazioni e suggerimenti leggibili.</li>
          <li><strong>Google Analytics API e Google Search Console API</strong> — solo se l&apos;utente collega volontariamente il proprio account Google tramite OAuth, in sola lettura (vedi sezione dedicata più sotto).</li>
        </ul>
      </LegalSection>

      <LegalSection title="5. Connessione con Google Analytics e Search Console">
        <p>
          L&apos;utilizzo e il trasferimento a qualsiasi altra app delle informazioni ricevute
          dalle API di Google da parte di DigitalCheck rispetteranno la Google API Services User
          Data Policy, inclusi i requisiti di Limited Use.
        </p>
        <p>In particolare:</p>
        <ul>
          <li>I dati letti da Google Analytics e Google Search Console sono usati esclusivamente per essere mostrati nella dashboard Gestionale dell&apos;utente che ha autorizzato la connessione.</li>
          <li>Questi dati non vengono condivisi con terzi.</li>
          <li>Questi dati non vengono utilizzati per addestrare modelli di intelligenza artificiale.</li>
          <li>
            L&apos;utente può revocare l&apos;accesso in qualsiasi momento sia dalle impostazioni
            di DigitalCheck, sia direttamente dalle impostazioni di sicurezza del proprio account
            Google.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="6. Diritti dell'utente">
        <p>In qualità di interessato, hai il diritto di:</p>
        <ul>
          <li><strong>Accesso</strong> — ottenere conferma dell&apos;esistenza di un trattamento e conoscere i dati oggetto dello stesso.</li>
          <li><strong>Rettifica</strong> — richiedere la correzione di dati inesatti o incompleti.</li>
          <li><strong>Cancellazione</strong> — richiedere la cancellazione dei propri dati, quando non più necessari o in altri casi previsti dalla legge.</li>
          <li><strong>Portabilità</strong> — ricevere i propri dati in un formato strutturato e leggibile.</li>
          <li><strong>Opposizione</strong> — opporti al trattamento basato su legittimo interesse.</li>
          <li><strong>Revoca del consenso</strong> — revocare in qualsiasi momento il consenso dato (ad es. per la connessione a Google Analytics/Search Console), senza pregiudicare la liceità del trattamento svolto prima della revoca.</li>
        </ul>
        <p>
          Per esercitare questi diritti puoi scrivere a{" "}
          <a href="mailto:imperiumdigitalitaly@gmail.com">imperiumdigitalitaly@gmail.com</a>. Hai
          inoltre il diritto di proporre reclamo al Garante per la protezione dei dati personali.
        </p>
      </LegalSection>

      <LegalSection title="7. Tempi di conservazione">
        <ul>
          <li>Dati dell&apos;account: conservati finché l&apos;utente non richiede la cancellazione dell&apos;account.</li>
          <li>Log tecnici e di sicurezza: conservati per 12 mesi.</li>
          <li>Dati relativi a pagamenti e fatturazione: conservati per il periodo richiesto dagli obblighi fiscali e contabili applicabili, gestiti da Stripe.</li>
          <li>Dati letti da Google Analytics/Search Console: non vengono conservati oltre quanto necessario a mostrarli nella dashboard e vengono rimossi in caso di revoca dell&apos;accesso.</li>
        </ul>
        <p>
          <DefaultNote>
            Questi sono valori di default ragionevoli e possono essere modificati o resi più
            precisi su indicazione del Titolare.
          </DefaultNote>
        </p>
      </LegalSection>

      <LegalSection title="8. Cookie">
        <p>
          DigitalCheck utilizza esclusivamente cookie tecnici e di sessione, necessari per
          consentire l&apos;autenticazione e il corretto funzionamento della piattaforma. Non
          vengono utilizzati cookie di profilazione o di terze parti a scopo pubblicitario.
        </p>
      </LegalSection>

      <LegalSection title="9. Modifiche alla presente informativa">
        <p>
          Questa informativa potrà essere aggiornata nel tempo, ad esempio per adeguamenti
          normativi o cambiamenti nei servizi utilizzati. La data di ultimo aggiornamento è
          indicata in cima alla pagina.
        </p>
      </LegalSection>

      <LegalSection title="10. Contatti">
        <p>
          Per qualsiasi domanda relativa a questa informativa o al trattamento dei tuoi dati
          personali, scrivi a{" "}
          <a href="mailto:imperiumdigitalitaly@gmail.com">imperiumdigitalitaly@gmail.com</a>.
        </p>
      </LegalSection>
    </LegalPageShell>
  );
}
