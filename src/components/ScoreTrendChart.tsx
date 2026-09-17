interface TrendPoint {
  date: string;
  score: number | null;
}

const ACCENT = "#1F6F64";
const GRID = "#E3E0D8";
const INK_SOFT = "#3A3F47";

/**
 * Andamento nel tempo di un singolo punteggio: linea sottile, un solo
 * hue (il punteggio e' una grandezza, non una categoria), pochi punti
 * etichettati direttamente invece di un numero su ogni punto, tooltip
 * nativo su ogni marker.
 */
export function ScoreTrendChart({ points, label }: { points: TrendPoint[]; label: string }) {
  const valid = points.filter((p): p is { date: string; score: number } => p.score != null);
  if (valid.length === 0) {
    return <p className="text-sm text-ink-soft">Nessun dato storico ancora disponibile per questo grafico.</p>;
  }
  if (valid.length === 1) {
    const only = valid[0];
    return (
      <p className="text-sm text-ink-soft">
        Una sola analisi disponibile finora ({only?.score}/100): il grafico dell&apos;andamento comparira' dopo la
        prossima analisi.
      </p>
    );
  }

  const width = 600;
  const height = 200;
  const padX = 20;
  const padY = 20;
  const plotW = width - padX * 2;
  const plotH = height - padY * 2;

  const xStep = plotW / (valid.length - 1);
  const coords = valid.map((p, i) => ({
    x: padX + i * xStep,
    y: padY + plotH - (p.score / 100) * plotH,
    score: p.score,
    date: p.date,
  }));

  const pathD = coords.map((c, i) => `${i === 0 ? "M" : "L"} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`).join(" ");
  const firstCoord = coords[0];
  const lastCoord = coords[coords.length - 1];

  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" role="img" aria-label={`Andamento ${label}`}>
        {[0, 25, 50, 75, 100].map((v) => {
          const y = padY + plotH - (v / 100) * plotH;
          return (
            <line key={v} x1={padX} y1={y} x2={width - padX} y2={y} stroke={GRID} strokeWidth={1} />
          );
        })}
        <path d={pathD} fill="none" stroke={ACCENT} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        {coords.map((c, i) => (
          <g key={i}>
            <circle cx={c.x} cy={c.y} r={4} fill={ACCENT}>
              <title>
                {new Date(c.date).toLocaleDateString("it-IT")}: {c.score}/100
              </title>
            </circle>
            {(i === 0 || i === coords.length - 1) && (
              <text x={c.x} y={c.y - 10} textAnchor={i === 0 ? "start" : "end"} fontSize={11} fill={INK_SOFT}>
                {c.score}
              </text>
            )}
          </g>
        ))}
      </svg>
      <div className="mt-1 flex justify-between text-xs text-ink-soft">
        <span>{firstCoord && new Date(firstCoord.date).toLocaleDateString("it-IT")}</span>
        <span>{lastCoord && new Date(lastCoord.date).toLocaleDateString("it-IT")}</span>
      </div>
    </div>
  );
}
