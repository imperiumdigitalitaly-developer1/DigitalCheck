import Link from "next/link";
import Image from "next/image";

/** Cornice condivisa per login/registrazione/reset password: stessa card e sfondo della landing. */
export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-paper px-6 py-14">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-90"
        style={{
          backgroundImage:
            "radial-gradient(560px 320px at 50% -8%, #EAF1FE, transparent 70%), radial-gradient(#D7D2C6 1px, transparent 1px)",
          backgroundSize: "auto, 24px 24px",
        }}
      />
      <div className="w-full max-w-[400px]">
        <Link href="/" className="mb-7 flex items-center justify-center gap-2.5">
          <Image src="/logo-transparent.png" alt="" width={40} height={24} priority className="h-6 w-auto" />
          <span className="flex flex-col leading-tight">
            <span className="font-body text-[15px] font-semibold tracking-tight text-ink">DigitalCheck</span>
            <span className="text-[10px] text-ink-faint">powered by Imperium Digital</span>
          </span>
        </Link>
        <div className="rounded-[14px] border border-line bg-white p-7 shadow-[0_24px_60px_-16px_rgba(16,20,28,0.12),0_8px_20px_-8px_rgba(16,20,28,0.06)] sm:p-9">
          {children}
        </div>
      </div>
    </main>
  );
}
