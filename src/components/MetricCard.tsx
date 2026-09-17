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
    <div className="rounded-lg border border-line bg-white p-4">
      <p className="text-sm text-ink-soft">{label}</p>
      <p className="font-display text-2xl">{value}</p>
      {hint && <p className="mt-1 text-xs text-ink-soft">{hint}</p>}
    </div>
  );
}
