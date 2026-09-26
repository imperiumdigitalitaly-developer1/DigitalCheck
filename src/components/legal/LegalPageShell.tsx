import Link from "next/link";
import Image from "next/image";

export function LegalPageShell({
  title,
  eyebrow = "Legal",
  updated,
  children,
}: {
  title: string;
  eyebrow?: string;
  updated?: string;
  children: React.ReactNode;
}) {
  return (
    <main>
      <header className="sticky top-0 z-50 border-b border-line bg-paper/90 backdrop-blur-md backdrop-saturate-150">
        <div className="mx-auto flex min-h-[58px] max-w-[1120px] flex-wrap items-center justify-between gap-x-4 gap-y-2 px-5 py-2 sm:px-8">
          <Link href="/" className="flex min-w-0 items-center gap-2.5" aria-label="DigitalCheck">
            <Image src="/logo-transparent.png" alt="" width={52} height={32} className="h-[26px] w-auto shrink-0" />
            <span className="flex min-w-0 flex-col overflow-hidden leading-tight">
              <span className="truncate font-body text-[16px] font-semibold tracking-tight text-ink">DigitalCheck</span>
              <span className="truncate text-[10px] text-ink-faint">powered by Imperium Digital</span>
            </span>
          </Link>
          <Link href="/" className="text-sm font-medium text-ink-soft hover:text-ink">
            ← Torna al sito
          </Link>
        </div>
      </header>

      <section className="border-b border-line bg-paper px-5 py-14 sm:px-8 sm:py-20">
        <div className="mx-auto max-w-prose">
          <div className="mb-3.5 flex items-center gap-2.5">
            <span className="block h-px w-[26px] bg-accent" />
            <span className="text-xs font-semibold uppercase tracking-wider text-accent">{eyebrow}</span>
          </div>
          <h1 className="text-balance font-display text-[34px] font-semibold leading-[1.1] tracking-tight sm:text-[44px]">{title}</h1>
          {updated && <p className="mt-3 text-sm text-ink-faint">Ultimo aggiornamento: {updated}</p>}

          <div className="prose-legal mt-10 space-y-8">{children}</div>
        </div>
      </section>

      <footer className="px-5 py-10 text-center sm:px-8">
        <div className="flex items-center justify-center gap-2.5">
          <Image src="/logo-transparent.png" alt="" width={44} height={27} className="h-[22px] w-auto" />
          <span className="flex flex-col items-start leading-tight">
            <span className="font-display text-base font-semibold">DigitalCheck</span>
            <span className="text-[10px] text-ink-faint">powered by Imperium Digital</span>
          </span>
        </div>
        <nav className="mt-4 flex items-center justify-center gap-4 text-xs text-ink-soft">
          <Link href="/chi-siamo" className="hover:text-ink">
            Chi siamo
          </Link>
          <span aria-hidden="true">·</span>
          <Link href="/privacy" className="hover:text-ink">
            Privacy Policy
          </Link>
          <span aria-hidden="true">·</span>
          <Link href="/termini" className="hover:text-ink">
            Termini di Servizio
          </Link>
        </nav>
        <p className="mt-2 text-xs text-ink-faint">
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
