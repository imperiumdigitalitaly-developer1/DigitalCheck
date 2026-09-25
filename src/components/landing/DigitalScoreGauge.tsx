"use client";

import { useEffect, useRef, useState } from "react";
import { scoreColorHex } from "./band";

/**
 * Gauge circolare animato per la landing page (dato dimostrativo, mai un
 * punteggio reale): al montaggio disegna l'arco e fa il conteggio da 0 al
 * valore finale. Componente dedicato alla landing — non tocca
 * src/components/ScoreCircle.tsx, usato da dashboard/report/PDF con dati
 * reali, per non introdurre alcun rischio su quelle pagine.
 */
export function DigitalScoreGauge({
  score,
  size = 132,
  strokeWidth = 10,
}: {
  score: number;
  size?: number;
  strokeWidth?: number;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const color = scoreColorHex(score);

  const [progress, setProgress] = useState(0);
  const [display, setDisplay] = useState(0);
  const frameRef = useRef<number>();

  useEffect(() => {
    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) {
      setProgress(score);
      setDisplay(score);
      return;
    }
    let start: number | null = null;
    const duration = 1000;
    const step = (ts: number) => {
      if (start === null) start = ts;
      const p = Math.min((ts - start) / duration, 1);
      setProgress(p * score);
      setDisplay(Math.round(p * score));
      if (p < 1) frameRef.current = requestAnimationFrame(step);
    };
    frameRef.current = requestAnimationFrame(step);
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [score]);

  const offset = circumference * (1 - progress / 100);

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" role="img" aria-label={`Digital Score ${score} su 100`}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#E3E0D8" strokeWidth={strokeWidth} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-[stroke-dashoffset] duration-[1.1s] ease-out motion-reduce:transition-none"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display font-semibold leading-none tabular-nums" style={{ fontSize: size * 0.26, color }}>
          {display}
        </span>
        <span className="mt-0.5 text-[11px] text-ink-faint">/ 100</span>
      </div>
    </div>
  );
}
