"use client";
import React, { useEffect, useRef } from "react";

type Props = { lines: string[]; max?: number };

export default function CompactLog({ lines, max = 5 }: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);

  const visible = lines.slice(-max);
  useEffect(() => {
    // keep scrolled to bottom on update (if taller later)
    const el = hostRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [visible.join("|")]);

  if (!visible.length) return null;

  return (
    <div ref={hostRef} className="compact-log" aria-live="polite">
      {visible.map((t, i) => (
        <div key={`${i}-${t}`}>{t}</div>
      ))}
    </div>
  );
}
