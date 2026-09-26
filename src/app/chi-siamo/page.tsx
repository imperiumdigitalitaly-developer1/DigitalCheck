import type { Metadata } from "next";
import { LegalPageShell, LegalSection } from "@/components/legal/LegalPageShell";

export const metadata: Metadata = {
  title: "Chi siamo",
  description:
    "DigitalCheck è un prodotto di Imperium Digital, startup che realizza siti web e app per piccole attività. Scopri chi c'è dietro lo strumento.",
  alternates: { canonical: "/chi-siamo" },
};

export default function ChiSiamoPage() {
  return (
    <LegalPageShell title="Chi siamo" eyebrow="Chi siamo">
      <p className="text-ink-soft">
        DigitalCheck è un prodotto di <strong>Imperium Digital</strong>, una startup che progetta
        e realizza siti web e app per piccole attività — ristoranti, B&amp;B, studi
        professionali, negozi e artigiani che vogliono avere una presenza online solida senza
        doverne conoscere ogni dettaglio tecnico.
      </p>

      <LegalSection title="Perché esiste DigitalCheck">
        <p>
          Lavorando ogni giorno con piccole attività abbiamo visto lo stesso problema ripetersi:
          un sito viene realizzato, pubblicato, e poi nessuno lo controlla più. Nel frattempo
          cambiano gli algoritmi dei motori di ricerca, le aspettative degli utenti su mobile,
          i tempi di caricamento accettabili — e il sito resta fermo.
        </p>
        <p>
          DigitalCheck nasce per colmare esattamente questo vuoto: uno strumento che analizza un
          sito in profondità — SEO, performance, mobile, contenuti, conversione, accessibilità,
          aspetti tecnici e predisposizione ai motori di ricerca generativi (GEO) — e restituisce
          un quadro chiaro di cosa funziona e cosa no, con indicazioni pratiche per migliorarlo,
          non un punteggio fine a se stesso.
        </p>
      </LegalSection>

      <LegalSection title="Cosa facciamo">
        <p>
          Imperium Digital realizza siti web e applicazioni su misura per piccole attività,
          seguendo l&apos;intero percorso: dalla progettazione alla pubblicazione, fino alla
          manutenzione nel tempo. DigitalCheck è nato all&apos;interno di questo lavoro quotidiano,
          come lo strumento che avremmo voluto avere per monitorare i siti dei nostri clienti in
          modo oggettivo — ed è oggi disponibile per chiunque voglia capire davvero come sta
          andando il proprio sito.
        </p>
      </LegalSection>

      <LegalSection title="Come lavoriamo">
        <p>
          Ogni analisi si basa su dati tecnici reali (crawling del sito, dati Google PageSpeed) e
          su un&apos;interpretazione in linguaggio semplice, pensata per essere utile anche a chi
          non lavora nel digitale. Quando un dato non può essere verificato con gli strumenti
          collegati, il report lo dichiara esplicitamente invece di stimarlo come fosse certo.
        </p>
      </LegalSection>

      <LegalSection title="Contatti">
        <p>
          Per domande su DigitalCheck o su Imperium Digital puoi scriverci a{" "}
          <a href="mailto:imperiumdigitalitaly@gmail.com">imperiumdigitalitaly@gmail.com</a>.
        </p>
      </LegalSection>
    </LegalPageShell>
  );
}
