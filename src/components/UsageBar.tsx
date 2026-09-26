export function UsageBar({ label, used, max }: { label: string; used: number; max: number }) {
  const pct = max > 0 ? Math.min(100, Math.round((used / max) * 100)) : 0;
  const atLimit = used >= max;

  return (
    <div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-ink-soft">{label}</span>
        <span className={atLimit ? "font-medium text-severity-high" : "font-medium text-ink"}>
          {used} / {max}
        </span>
      </div>
      <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-line">
        <div
          className={`h-full rounded-full ${atLimit ? "bg-severity-high" : "bg-accent"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {atLimit && (
        <p className="mt-1.5 text-xs text-severity-high">
          Limite raggiunto. Sara&apos; nuovamente disponibile al prossimo rinnovo.
        </p>
      )}
    </div>
  );
}
