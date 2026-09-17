import Link from "next/link";

export function LegalPageShell({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: React.ReactNode;
}) {
  return (
    <main>
      <nav className="flex items-center justify-between border-b border-line px-6 py-4">
        <Link href="/" className="flex items-baseline gap-2">
          <span className="font-display text-lg">DigitalCheck</span>
          <span className="text-xs text-ink-soft">powered by Imperium Digital</span>
        </Link>
        <Link href="/" className="text-sm text-ink-soft hover:text-ink">
          ← Torna al sito
        </Link>
      </nav>

      <section className="border-b border-line bg-paper px-6 py-16">
        <div className="mx-auto max-w-prose">
          <h1 className="font-display text-4xl leading-tight">{title}</h1>
          <p className="mt-3 text-sm text-ink-soft">Ultimo aggiornamento: {updated}</p>

          <div className="prose-legal mt-10 space-y-8">{children}</div>
        </div>
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

export function LegalSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="font-display text-xl">{title}</h2>
      <div className="mt-3 space-y-3 text-ink-soft [&_a]:text-accent [&_a]:underline [&_a]:underline-offset-2 [&_a:hover]:text-accent-deep [&_li]:leading-relaxed [&_p]:leading-relaxed [&_strong]:text-ink [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-5">
        {children}
      </div>
    </section>
  );
}


export function DefaultNote({ children }: { children: React.ReactNode }) {
  return <span className="text-sm italic text-ink-soft/80">{children}</span>;
}
