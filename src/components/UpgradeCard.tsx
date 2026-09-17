import Link from "next/link";

interface UpgradeCardProps {
  title: string;
  description: string;
  ctaLabel?: string;
  ctaHref?: string;
  onCtaClick?: () => void;
  compact?: boolean;
}

/**
 * Blocco di upsell riutilizzabile: comunica cosa sblocca il piano Pro
 * senza toni aggressivi (niente popup, countdown o scarsita' finta —
 * vedi brief sezione 26). Usato per report troncati, Gestionale,
 * Assistente AI e ovunque una funzione sia riservata a Pro.
 */
export function UpgradeCard({ title, description, ctaLabel = "Passa a Pro", ctaHref, onCtaClick, compact }: UpgradeCardProps) {
  return (
    <div
      className={`rounded-lg border border-dashed border-accent/50 bg-accent-soft/30 ${compact ? "p-4" : "p-6"} text-left`}
    >
      <p className="font-display text-lg">{title}</p>
      <p className="mt-1.5 text-sm text-ink-soft">{description}</p>
      {onCtaClick ? (
        <button
          onClick={onCtaClick}
          className="mt-4 inline-block rounded-md bg-accent px-4 py-2 text-sm font-medium text-paper hover:bg-accent-deep"
        >
          {ctaLabel} — 6,99 €/mese
        </button>
      ) : (
        <Link
          href={ctaHref ?? "/register"}
          className="mt-4 inline-block rounded-md bg-accent px-4 py-2 text-sm font-medium text-paper hover:bg-accent-deep"
        >
          {ctaLabel}
        </Link>
      )}
    </div>
  );
}
