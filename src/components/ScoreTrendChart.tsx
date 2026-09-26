"use client";

import { useEffect, useRef, useState } from "react";

interface TrendPoint {
  date: string;
  score: number | null;
}

const ACCENT = "#1F6F64";
const GRID = "#E3E0D8";
const INK_SOFT = "#3A3F47";

const HEIGHT = 200;
const PAD_X = 24;
const PAD_Y = 24;
const MIN_WIDTH = 240;
// Oltre questo numero di punti solo primo e ultimo hanno il valore scritto
// sul grafico: piu' etichette si sovrapporrebbero.
const MAX_LABELLED_POINTS = 8;

const formatDate = (date: string) => new Date(date).toLocaleDateString("it-IT");

/**
 * Andamento nel tempo di un singolo punteggio: linea sottile, un solo
 * hue (il punteggio e' una grandezza, non una categoria). Il disegno usa la
 * larghezza reale del contenitore invece di un viewBox scalato, cosi' le
 * etichette restano leggibili (12px) anche su mobile. Il dettaglio di ogni
 * punto non dipende dal tooltip al passaggio del mouse: toccando (o
 * raggiungendo con la tastiera) un punto, data e valore compaiono sotto il
 * grafico.
 */
export function ScoreTrendChart({ points, label }: { points: TrendPoint[]; label: string }) {
  const valid = points.filter((p): p is { date: string; score: number } => p.score != null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(600);
  const [selected, setSelected] = useState<number | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setWidth(Math.max(MIN_WIDTH, Math.round(el.clientWidth)));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [valid.length]);

  if (valid.length === 0) {
    return <p className="text-sm text-ink-soft">Nessun dato storico ancora disponibile per questo grafico.</p>;
  }
  if (valid.length === 1) {
    const only = valid[0];
    return (
      <p className="text-sm text-ink-soft">
        Una sola analisi disponibile finora ({only?.score}/100): il grafico dell&apos;andamento comparira&apos; dopo la
        prossima analisi.
      </p>
    );
  }

  const plotW = width - PAD_X * 2;
  const plotH = HEIGHT - PAD_Y * 2;
  const xStep = plotW / (valid.length - 1);
  const coords = valid.map((p, i) => ({
    x: PAD_X + i * xStep,
    y: PAD_Y + plotH - (p.score / 100) * plotH,
    score: p.score,
    date: p.date,
  }));

  const pathD = coords.map((c, i) => `${i === 0 ? "M" : "L"} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`).join(" ");
  const firstCoord = coords[0];
  const lastCoord = coords[coords.length - 1];
  const labelAll = coords.length <= MAX_LABELLED_POINTS;
  const activeIndex = selected ?? coords.length - 1;
  const active = coords[activeIndex];

  return (
    <div ref={containerRef}>
      <svg width={width} height={HEIGHT} className="block max-w-full" role="group" aria-label={`Andamento ${label}`}>
        {[0, 25, 50, 75, 100].map((v) => {
          const y = PAD_Y + plotH - (v / 100) * plotH;
          return <line key={v} x1={PAD_X} y1={y} x2={width - PAD_X} y2={y} stroke={GRID} strokeWidth={1} />;
        })}
        <path d={pathD} fill="none" stroke={ACCENT} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        {coords.map((c, i) => {
          const isActive = i === activeIndex;
          const showLabel = labelAll || i === 0 || i === coords.length - 1;
          return (
            <g
              key={i}
              tabIndex={0}
              role="button"
              aria-label={`${formatDate(c.date)}: ${c.score} su 100`}
              onClick={() => setSelected(i)}
              onFocus={() => setSelected(i)}
              className="cursor-pointer outline-none [&:focus-visible>circle:first-child]:stroke-ink"
            >
              {/* Area di tocco allargata (~44px) attorno al punto. */}
              <circle cx={c.x} cy={c.y} r={22} fill="transparent" />
              <circle cx={c.x} cy={c.y} r={isActive ? 6 : 4} fill={ACCENT} stroke="#fff" strokeWidth={isActive ? 2 : 0}>
                <title>
                  {formatDate(c.date)}: {c.score}/100
                </title>
              </circle>
              {showLabel && (
                <text
                  x={c.x}
                  y={c.y - 12}
                  textAnchor={i === 0 ? "start" : i === coords.length - 1 ? "end" : "middle"}
                  fontSize={12}
                  fontWeight={isActive ? 600 : 400}
                  fill={INK_SOFT}
                >
                  {c.score}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <div className="mt-1 flex justify-between text-xs text-ink-soft">
        <span>{firstCoord && formatDate(firstCoord.date)}</span>
        <span>{lastCoord && formatDate(lastCoord.date)}</span>
      </div>
      {active && (
        <p className="mt-2 text-sm text-ink-soft" aria-live="polite">
          {formatDate(active.date)}: <span className="font-medium text-ink">{active.score}/100</span>
        </p>
      )}
    </div>
  );
}
