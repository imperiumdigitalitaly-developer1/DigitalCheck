export function MetricCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="min-w-0 rounded-[14px] border border-line bg-white p-4">
      <p className="text-sm text-ink-soft">{label}</p>
      <p className="break-words font-display text-2xl">{value}</p>
      {hint && <p className="mt-1 text-xs text-ink-soft">{hint}</p>}
    </div>
  );
}
