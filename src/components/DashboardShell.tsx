"use client";

import { useState } from "react";
import Link from "next/link";
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
            className={`flex items-center justify-between rounded-md px-3 py-2 text-sm ${
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
          className={`flex items-center rounded-md px-3 py-2 text-sm ${
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
    <div className="min-h-screen bg-paper">
      <header className="flex items-center justify-between border-b border-line bg-white px-4 py-3 sm:hidden">
        <Link href="/dashboard" className="flex items-baseline gap-1.5">
          <span className="font-display text-lg">DigitalCheck</span>
        </Link>
        <button
          onClick={() => setMobileOpen((v) => !v)}
          aria-label="Apri il menu"
          className="rounded-md border border-line px-3 py-1.5 text-sm"
        >
          Menu
        </button>
      </header>

      {mobileOpen && (
        <div className="border-b border-line bg-white px-4 py-3 sm:hidden">
          <NavLinks user={user} pathname={pathname} onNavigate={() => setMobileOpen(false)} />
          <button onClick={handleLogout} className="mt-2 w-full rounded-md border border-line px-3 py-2 text-left text-sm text-ink-soft">
            Esci
          </button>
        </div>
      )}

      <div className="mx-auto flex max-w-6xl">
        <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-line bg-white px-4 py-6 sm:flex">
          <Link href="/dashboard" className="flex flex-col gap-0.5 px-3">
            <span className="font-display text-xl">DigitalCheck</span>
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
              className="w-full rounded-md px-3 py-2 text-left text-sm text-ink-soft hover:bg-line/50 hover:text-ink"
            >
              Esci
            </button>
          </div>
        </aside>

        <main className="min-w-0 flex-1 px-4 py-8 sm:px-8">{children}</main>
      </div>
    </div>
  );
}
