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

const NAV_ITEMS: { href: string; label: string; pro: boolean; icon: JSX.Element }[] = [
  {
    href: "/dashboard",
    label: "Overview",
    pro: false,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <rect x="4" y="4" width="7" height="7" rx="1.4" />
        <rect x="13" y="4" width="7" height="7" rx="1.4" />
        <rect x="4" y="13" width="7" height="7" rx="1.4" />
        <rect x="13" y="13" width="7" height="7" rx="1.4" />
      </svg>
    ),
  },
  {
    href: "/dashboard/analyze",
    label: "Analizza sito",
    pro: false,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
        <circle cx="10" cy="10" r="6" />
        <line x1="14.6" y1="14.6" x2="20" y2="20" />
      </svg>
    ),
  },
  {
    href: "/dashboard/gestionale",
    label: "Gestionale",
    pro: true,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
        <line x1="5" y1="20" x2="5" y2="12" />
        <line x1="12" y1="20" x2="12" y2="6" />
        <line x1="19" y1="20" x2="19" y2="15" />
      </svg>
    ),
  },
  {
    href: "/dashboard/assistant",
    label: "AI Assistant",
    pro: true,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
        <path d="M12 3l1.8 6.2L20 11l-6.2 1.8L12 19l-1.8-6.2L4 11l6.2-1.8z" />
      </svg>
    ),
  },
  {
    href: "/dashboard/reports",
    label: "Report",
    pro: false,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
        <rect x="5.5" y="3.5" width="13" height="17" rx="1.6" />
        <line x1="8.3" y1="8.5" x2="15.7" y2="8.5" />
        <line x1="8.3" y1="12" x2="15.7" y2="12" />
        <line x1="8.3" y1="15.5" x2="12.5" y2="15.5" />
      </svg>
    ),
  },
  {
    href: "/dashboard/settings",
    label: "Impostazioni",
    pro: false,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M12 3.8v2.1M12 18.1v2.1M20.2 12h-2.1M5.9 12H3.8M17.5 6.5l-1.5 1.5M8 16l-1.5 1.5M17.5 17.5L16 16M8 8L6.5 6.5" />
      </svg>
    ),
  },
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
    <nav className="space-y-0.5">
      {NAV_ITEMS.map((item) => {
        const active = item.href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={`flex min-h-[44px] items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
              active ? "bg-accent-soft font-medium text-accent-deep" : "text-ink-soft hover:bg-line/50 hover:text-ink"
            }`}
          >
            <span className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center [&_svg]:h-full [&_svg]:w-full ${active ? "text-accent" : "text-ink-faint"}`}>
              {item.icon}
            </span>
            <span className="min-w-0 flex-1 truncate">{item.label}</span>
            {item.pro && user.plan === "FREE" && <ProBadge />}
          </Link>
        );
      })}
      {user.isAdmin && (
        <Link
          href="/admin"
          onClick={onNavigate}
          aria-current={pathname.startsWith("/admin") ? "page" : undefined}
          className={`flex min-h-[44px] items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
            pathname.startsWith("/admin") ? "bg-accent-soft font-medium text-accent-deep" : "text-ink-soft hover:bg-line/50 hover:text-ink"
          }`}
        >
          <span className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center [&_svg]:h-full [&_svg]:w-full ${pathname.startsWith("/admin") ? "text-accent" : "text-ink-faint"}`}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3.5l6.5 2.6v5c0 4.3-2.7 7.6-6.5 9-3.8-1.4-6.5-4.7-6.5-9v-5z" />
              <path d="M9.3 12l1.9 1.9 3.5-3.9" />
            </svg>
          </span>
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
        <header className="flex items-center justify-between border-b border-line bg-paper/90 px-4 py-2 backdrop-blur-md backdrop-saturate-150">
          <Link href="/dashboard" className="flex min-h-[44px] items-center gap-2.5">
            <LogoMark height={30} />
            <span className="font-body text-[16px] font-semibold tracking-tight text-ink">DigitalCheck</span>
          </Link>
          <button
            onClick={() => setMobileOpen((v) => !v)}
            aria-label={mobileOpen ? "Chiudi il menu" : "Apri il menu"}
            aria-expanded={mobileOpen}
            aria-controls="dashboard-mobile-menu"
            className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg hover:bg-white"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" className="h-[22px] w-[22px]">
              {mobileOpen ? (
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
        </header>

        {mobileOpen && (
          <div
            id="dashboard-mobile-menu"
            className="max-h-[calc(100dvh-3.75rem)] overflow-y-auto border-b border-line bg-white px-4 py-3 shadow-md"
          >
            <NavLinks user={user} pathname={pathname} onNavigate={() => setMobileOpen(false)} />
            <button
              onClick={handleLogout}
              className="mt-2 min-h-[44px] w-full rounded-lg border border-line px-3 py-2 text-left text-sm text-ink-soft"
            >
              Esci
            </button>
          </div>
        )}
      </div>

      <div className="mx-auto flex max-w-6xl">
        <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col overflow-y-auto border-r border-line bg-white px-4 py-6 lg:flex">
          <Link href="/dashboard" className="flex flex-col gap-0.5 px-3">
            <span className="flex items-center gap-2.5">
              <LogoMark height={30} />
              <span className="font-body text-[17px] font-semibold tracking-tight text-ink">DigitalCheck</span>
            </span>
            <span className="text-[11px] text-ink-faint">powered by Imperium Digital</span>
          </Link>

          <div className="mt-7 flex-1">
            <NavLinks user={user} pathname={pathname} />
          </div>

          <div className="space-y-2.5 border-t border-line pt-4">
            <div className="flex items-center justify-between px-3">
              <span className="rounded-full bg-accent-soft px-3 py-1 text-xs font-medium text-accent-deep">
                Piano {user.plan === "PRO" ? "Pro" : "Free"}
              </span>
            </div>
            <p className="truncate px-3 text-xs text-ink-faint">{user.email}</p>
            <button
              onClick={handleLogout}
              className="min-h-[44px] w-full rounded-lg px-3 py-2 text-left text-sm text-ink-soft transition-colors hover:bg-line/50 hover:text-ink"
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
