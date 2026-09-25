import { STATUS_CLASS, STATUS_LABEL } from "@/lib/analysis/constants";
import type { AnalysisStatus } from "@/lib/analysis/types";

/**
 * Card di sintesi per la dashboard executive (brief audit sezione 14):
 * SOLO nome categoria, punteggio, stato e una breve descrizione generale.
 * Nessun elenco di problemi/consigli/priorita' — quello vive
 * esclusivamente nel PDF Pro (brief sezione 15/39).
 */
export function CategoryScoreCard({
  label,
  score,
  status,
  summary,
}: {
  label: string;
  score: number;
  status: AnalysisStatus;
  summary: string;
}) {
  return (
    <div className="rounded-[14px] border border-line bg-white p-5">
      <div className="flex items-start justify-between gap-2">
        <p className="font-medium text-ink">{label}</p>
        <span className={`shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-medium ${STATUS_CLASS[status]}`}>
          {STATUS_LABEL[status]}
        </span>
      </div>
      <p className="mt-2 font-display text-3xl text-ink">
        {score}
        <span className="text-base font-normal text-ink-soft">/100</span>
      </p>
      {summary && <p className="mt-2 text-sm text-ink-soft">{summary}</p>}
    </div>
  );
}
