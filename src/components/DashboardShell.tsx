"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { ProBadge } from "./StatusBadge";

interface DashboardUser {
  email: string;
  plan: "FREE" | "PRO";
  isAdmin: boolean;
}

const NAV_ITEMS = [
  { href: "/dashboard", label: "Overview", pro: false },
  { href: "/dashboard/analyze", label: "Analizza sito", pro: false },
  { href: "/dashboard/gestionale", label: "Gestionale", pro: true },
  { href: "/dashboard/assistant", label: "AI Assistant", pro: true },
  { href: "/dashboard/reports", label: "Report", pro: false },
  { href: "/dashboard/settings", label: "Impostazioni", pro: false },
];

// public/logo-transparent.png: monogramma senza sfondo, gia' ritagliato
// attorno al disegno (260x159 px).
const LOGO_ASPECT = 260 / 159;

function LogoMark({ height }: { height: number }) {
  return (
    <Image
      src="/logo-transparent.png"
      alt=""
      width={Math.round(height * LOGO_ASPECT)}
      height={height}
      priority
      className="shrink-0"
    />
  );
}

function NavLinks({ user, pathname, onNavigate }: { user: DashboardUser; pathname: string; onNavigate?: () => void }) {
  return (
    <nav className="space-y-1">
      {NAV_ITEMS.map((item) => {
        const active = item.href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={`flex min-h-[44px] items-center justify-between rounded-md px-3 py-2 text-sm ${
              active ? "bg-accent-soft font-medium text-accent-deep" : "text-ink-soft hover:bg-line/50 hover:text-ink"
            }`}
          >
            {item.label}
            {item.pro && user.plan === "FREE" && <ProBadge />}
          </Link>
        );
      })}
      {user.isAdmin && (
        <Link
          href="/admin"
          onClick={onNavigate}
          aria-current={pathname.startsWith("/admin") ? "page" : undefined}
          className={`flex min-h-[44px] items-center rounded-md px-3 py-2 text-sm ${
            pathname.startsWith("/admin") ? "bg-accent-soft font-medium text-accent-deep" : "text-ink-soft hover:bg-line/50 hover:text-ink"
          }`}
        >
          Amministrazione
        </Link>
      )}
    </nav>
  );
}

export function DashboardShell({ user, children }: { user: DashboardUser; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  return (
    <div className="app-touch min-h-screen bg-paper">
      {/* Sotto lg la sidebar diventa un'intestazione sticky con menu: cosi'
          resta raggiungibile durante lo scroll e, se piu' alto dello
          schermo (es. telefono in landscape), scorre al suo interno. */}
      <div className="sticky top-0 z-40 lg:hidden">
        <header className="flex items-center justify-between border-b border-line bg-white px-4 py-2">
          <Link href="/dashboard" className="flex min-h-[44px] items-center gap-2.5">
            <LogoMark height={40} />
            <span className="font-display text-lg">DigitalCheck</span>
          </Link>
          <button
            onClick={() => setMobileOpen((v) => !v)}
            aria-label={mobileOpen ? "Chiudi il menu" : "Apri il menu"}
            aria-expanded={mobileOpen}
            aria-controls="dashboard-mobile-menu"
            className="min-h-[44px] min-w-[44px] rounded-md border border-line px-4 py-1.5 text-sm"
          >
            Menu
          </button>
        </header>

        {mobileOpen && (
          <div
            id="dashboard-mobile-menu"
            className="max-h-[calc(100dvh-3.75rem)] overflow-y-auto border-b border-line bg-white px-4 py-3 shadow-md"
          >
            <NavLinks user={user} pathname={pathname} onNavigate={() => setMobileOpen(false)} />
            <button
              onClick={handleLogout}
              className="mt-2 min-h-[44px] w-full rounded-md border border-line px-3 py-2 text-left text-sm text-ink-soft"
            >
              Esci
            </button>
          </div>
        )}
      </div>

      <div className="mx-auto flex max-w-6xl">
        <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col overflow-y-auto border-r border-line bg-white px-4 py-6 lg:flex">
          <Link href="/dashboard" className="flex flex-col gap-1 px-3">
            <span className="flex items-center gap-2.5">
              <LogoMark height={36} />
              <span className="font-display text-xl">DigitalCheck</span>
            </span>
            <span className="text-[11px] text-ink-soft">powered by Imperium Digital</span>
          </Link>

          <div className="mt-6 flex-1">
            <NavLinks user={user} pathname={pathname} />
          </div>

          <div className="space-y-2 border-t border-line pt-4">
            <div className="flex items-center justify-between px-3">
              <span className="rounded-full bg-accent-soft px-3 py-1 text-xs text-accent-deep">
                Piano {user.plan === "PRO" ? "Pro" : "Free"}
              </span>
            </div>
            <p className="truncate px-3 text-xs text-ink-soft">{user.email}</p>
            <button
              onClick={handleLogout}
              className="min-h-[44px] w-full rounded-md px-3 py-2 text-left text-sm text-ink-soft hover:bg-line/50 hover:text-ink"
            >
              Esci
            </button>
          </div>
        </aside>

        {/* pb-24: lascia libero il fondo pagina dalla bolla della chat flottante. */}
        <main className="min-w-0 flex-1 px-4 pb-24 pt-8 sm:px-8">{children}</main>
      </div>
    </div>
  );
}
