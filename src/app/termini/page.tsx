import type { Metadata } from "next";
import { LegalPageShell, LegalSection, DefaultNote } from "@/components/legal/LegalPageShell";

export const metadata: Metadata = {
  title: "Termini di Servizio",
  description: "Termini e condizioni di utilizzo della piattaforma DigitalCheck.",
  alternates: { canonical: "/termini" },
};

export default function TerminiPage() {
  return (
    <LegalPageShell title="Termini di Servizio" updated="17 settembre 2026">
      <p className="text-ink-soft">
        I presenti Termini di Servizio (&quot;Termini&quot;) regolano l&apos;utilizzo della
        piattaforma DigitalCheck, gestita da Imperium Digital. Creando un account o utilizzando
        il servizio, accetti integralmente questi Termini.
      </p>

      <LegalSection title="1. Chi siamo">
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

      <LegalSection title="2. Descrizione del servizio">
        <p>
          DigitalCheck è una piattaforma SaaS che analizza siti web sotto il profilo di
          performance, SEO, accessibilità e best practices tecniche. Il servizio elabora i dati
          tecnici raccolti (anche tramite l&apos;API Google PageSpeed Insights) e genera
          interpretazioni e suggerimenti operativi tramite intelligenza artificiale (Google
          Gemini API), restituiti all&apos;utente in forma di report.
        </p>
      </LegalSection>

      <LegalSection title="3. Piani Free e Pro">
        <ul>
          <li>
            <strong>Piano Free</strong> — accesso gratuito alle funzionalità base di analisi, con
            quote di utilizzo limitate.
          </li>
          <li>
            <strong>Piano Pro</strong> — abbonamento a pagamento ricorrente di 6,99€/mese, che
            sblocca funzionalità aggiuntive (tra cui il modulo Gestionale con collegamento a
            Google Analytics e Search Console) e quote di utilizzo più ampie.
          </li>
        </ul>
        <p>
          Le funzionalità e le quote specifiche di ciascun piano sono indicate all&apos;interno
          della piattaforma e possono essere aggiornate nel tempo, con comunicazione agli utenti
          in caso di modifiche sostanziali.
        </p>
      </LegalSection>

      <LegalSection title="4. Sottoscrizione e pagamento">
        <p>
          Il pagamento dell&apos;abbonamento Pro avviene tramite Stripe, con addebito ricorrente
          mensile sul metodo di pagamento indicato dall&apos;utente. DigitalCheck non memorizza né
          ha accesso ai dati della carta di pagamento: questi vengono gestiti esclusivamente da
          Stripe secondo i relativi standard di sicurezza.
        </p>
      </LegalSection>

      <LegalSection title="5. Cancellazione e rimborsi">
        <p>
          L&apos;abbonamento Pro può essere cancellato in qualsiasi momento dalle impostazioni
          dell&apos;account. La cancellazione ha effetto alla fine del periodo di fatturazione già
          pagato; non sono previsti rimborsi proporzionali (pro-rata) per il periodo residuo,
          salvo diversa indicazione esplicita.
        </p>
        <p>
          <DefaultNote>
            Questa è una politica di default ragionevole; va confermata dal Titolare prima del
            lancio in produzione con pagamenti reali.
          </DefaultNote>
        </p>
      </LegalSection>

      <LegalSection title="6. Limiti di utilizzo">
        <p>
          Ogni piano è soggetto a quote di utilizzo (ad es. numero di analisi al mese), indicate
          all&apos;interno della piattaforma. Il superamento delle quote può comportare la
          sospensione temporanea di alcune funzionalità fino al rinnovo del periodo di
          fatturazione o all&apos;upgrade del piano.
        </p>
      </LegalSection>

      <LegalSection title="7. Uso accettabile">
        <p>Utilizzando DigitalCheck ti impegni a:</p>
        <ul>
          <li>Analizzare esclusivamente siti web che sei autorizzato ad analizzare (ad es. siti di tua proprietà o per i quali hai ottenuto il consenso del titolare).</li>
          <li>Non utilizzare la piattaforma per attività di scraping massivo, abuso automatizzato del servizio o tentativi di aggirare le quote di utilizzo.</li>
          <li>Non utilizzare il servizio per finalità illecite o lesive di diritti di terzi.</li>
        </ul>
        <p>
          Imperium Digital si riserva il diritto di sospendere o chiudere account che violano
          queste condizioni (vedi sezione 10).
        </p>
      </LegalSection>

      <LegalSection title="8. Disponibilità del servizio">
        <p>
          DigitalCheck viene fornito &quot;così com&apos;è&quot; (as-is), senza garanzie di
          disponibilità continua (SLA), in particolare per il piano Free. Ci impegniamo a
          mantenere il servizio funzionante ed efficiente, ma non garantiamo l&apos;assenza di
          interruzioni, errori o malfunzionamenti, anche legati alla disponibilità dei servizi
          terzi da cui DigitalCheck dipende (es. Vercel, Neon, Google API, Stripe).
        </p>
      </LegalSection>

      <LegalSection title="9. Proprietà intellettuale">
        <p>
          I marchi, il logo, il design e il codice della piattaforma DigitalCheck sono di
          proprietà di Imperium Digital e non possono essere riprodotti senza autorizzazione.
        </p>
        <p>
          I report, le analisi e le interpretazioni generate dalla piattaforma (inclusi i
          suggerimenti prodotti tramite intelligenza artificiale) relativi ai siti analizzati
          dall&apos;utente sono di uso esclusivo dell&apos;utente stesso, che può liberamente
          utilizzarli, condividerli o pubblicarli per la propria attività. Imperium Digital non
          rivendica alcun diritto sui contenuti dei siti web analizzati.
        </p>
      </LegalSection>

      <LegalSection title="10. Sospensione e chiusura dell'account">
        <p>
          Imperium Digital può sospendere o chiudere un account in caso di violazione dei presenti
          Termini, uso fraudolento o abusivo del servizio, o mancato pagamento dell&apos;abbonamento
          Pro. L&apos;utente può in qualsiasi momento richiedere la chiusura del proprio account
          scrivendo a <a href="mailto:imperiumdigitalitaly@gmail.com">imperiumdigitalitaly@gmail.com</a>.
        </p>
      </LegalSection>

      <LegalSection title="11. Limitazione di responsabilità">
        <p>
          Nei limiti consentiti dalla legge applicabile, Imperium Digital non è responsabile per
          danni indiretti, perdita di dati o mancato guadagno derivanti dall&apos;utilizzo o
          dall&apos;impossibilità di utilizzare il servizio. Le analisi e i suggerimenti forniti
          da DigitalCheck (incluse le interpretazioni generate tramite intelligenza artificiale)
          hanno finalità informativa e non costituiscono garanzia di risultati specifici (ad es.
          miglioramento del posizionamento SEO o delle performance del sito).
        </p>
      </LegalSection>

      <LegalSection title="12. Modifiche ai Termini">
        <p>
          Questi Termini possono essere aggiornati nel tempo. In caso di modifiche sostanziali,
          gli utenti verranno informati tramite comunicazione sulla piattaforma o via email. La
          data di ultimo aggiornamento è indicata in cima alla pagina.
        </p>
      </LegalSection>

      <LegalSection title="13. Legge applicabile e foro competente">
        <p>
          I presenti Termini sono regolati dalla legge italiana, salvo i casi in cui la legge
          preveda inderogabilmente una disciplina diversa (ad es. per i consumatori, il foro di
          residenza del consumatore).
        </p>
        <p className="text-sm">
          Foro competente: dati societari in fase di definizione — aggiornamento a breve.
        </p>
      </LegalSection>

      <LegalSection title="14. Contatti">
        <p>
          Per domande relative a questi Termini, scrivi a{" "}
          <a href="mailto:imperiumdigitalitaly@gmail.com">imperiumdigitalitaly@gmail.com</a>.
        </p>
      </LegalSection>
    </LegalPageShell>
  );
}
