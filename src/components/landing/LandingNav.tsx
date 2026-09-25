"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";

const NAV_LINKS = [
  { href: "#analisi", label: "Analisi" },
  { href: "#come-funziona", label: "Come funziona" },
  { href: "#pricing", label: "Pro" },
  { href: "#faq", label: "FAQ" },
];

export function LandingNav() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-line bg-paper/90 backdrop-blur-md backdrop-saturate-150">
      <div className="mx-auto flex min-h-[58px] max-w-[1120px] flex-wrap items-center justify-between gap-x-4 gap-y-2 px-5 py-2 sm:px-8">
        <Link href="#top" className="flex min-w-0 items-center gap-2.5" aria-label="DigitalCheck">
          <Image src="/logo-transparent.png" alt="" width={52} height={32} priority className="h-[26px] w-auto shrink-0" />
          <span className="flex min-w-0 flex-col overflow-hidden leading-tight">
            <span className="truncate font-body text-[16px] font-semibold tracking-tight text-ink">DigitalCheck</span>
            <span className="truncate text-[10px] text-ink-faint">powered by Imperium Digital</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-0.5 rounded-full border border-line bg-white/60 p-1 text-[13.8px] font-medium text-ink-soft md:flex">
          {NAV_LINKS.map((link) => (
            <a key={link.href} href={link.href} className="rounded-full px-3.5 py-1.5 transition-colors hover:bg-white hover:text-ink">
              {link.label}
            </a>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <Link href="/login" className="hidden min-h-[40px] items-center px-3 text-sm text-ink-soft hover:text-ink sm:inline-flex">
            Accedi
          </Link>
          <Link
            href="/register"
            className="inline-flex min-h-[40px] items-center whitespace-nowrap rounded-md bg-ink px-4 text-sm font-medium text-paper transition-colors hover:bg-accentBlue"
          >
            Analizza il tuo sito →
          </Link>
          <button
            type="button"
            aria-label="Apri il menu"
            aria-expanded={open}
            aria-controls="landing-mobile-menu"
            onClick={() => setOpen((v) => !v)}
            className="inline-flex rounded-lg p-2 hover:bg-white md:hidden"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" className="h-[22px] w-[22px]">
              {open ? (
                <>
                  <line x1="6" y1="6" x2="18" y2="18" />
                  <line x1="18" y1="6" x2="6" y2="18" />
                </>
              ) : (
                <>
                  <line x1="4" y1="7" x2="20" y2="7" />
                  <line x1="4" y1="12" x2="20" y2="12" />
                  <line x1="4" y1="17" x2="20" y2="17" />
                </>
              )}
            </svg>
          </button>
        </div>
      </div>

      {open && (
        <nav id="landing-mobile-menu" className="border-b border-line bg-paper md:hidden">
          <div className="mx-auto flex max-w-[1120px] flex-col gap-0.5 px-5 pb-4 pt-2">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="border-b border-line py-3 text-[15.5px] font-medium text-ink"
              >
                {link.label}
              </a>
            ))}
            <div className="mt-3 flex gap-2.5">
              <Link
                href="/login"
                onClick={() => setOpen(false)}
                className="flex flex-1 items-center justify-center rounded-md border border-line-strong px-4 py-2.5 text-sm font-medium text-ink"
              >
                Accedi
              </Link>
              <Link
                href="/register"
                onClick={() => setOpen(false)}
                className="flex flex-1 items-center justify-center rounded-md bg-ink px-4 py-2.5 text-sm font-medium text-paper"
              >
                Analizza →
              </Link>
            </div>
          </div>
        </nav>
      )}
    </header>
  );
}
