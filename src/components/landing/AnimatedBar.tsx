"use client";

import { useEffect, useState } from "react";
import { scoreColorHex } from "./band";

/** Barra di punteggio che si anima da 0 al valore finale al montaggio, colorata per fascia. */
export function AnimatedBar({ value, className = "h-1.5" }: { value: number; className?: string }) {
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setWidth(value)));
    return () => cancelAnimationFrame(id);
  }, [value]);

  return (
    <span className={`block w-full overflow-hidden rounded-full bg-paper ${className}`}>
      <span
        className="block h-full rounded-full transition-[width] duration-1000 ease-out motion-reduce:transition-none"
        style={{ width: `${width}%`, backgroundColor: scoreColorHex(value) }}
      />
    </span>
  );
}
