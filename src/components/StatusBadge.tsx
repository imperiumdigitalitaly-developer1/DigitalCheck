export function ProBadge() {
  return (
    <span className="rounded-full border border-accent/40 bg-accent-soft px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent-deep">
      Pro
    </span>
  );
}

export function StatusBadge({ status }: { status: "connected" | "not_connected" | "not_configured" }) {
  const config = {
    connected: { label: "Connesso", className: "bg-score-strong/10 text-score-strong border-score-strong/30" },
    not_connected: { label: "Connessione richiesta", className: "bg-line text-ink-soft border-line" },
    not_configured: { label: "Non configurato", className: "bg-line text-ink-soft border-line" },
  }[status];

  return (
    <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${config.className}`}>
      {config.label}
    </span>
  );
}
