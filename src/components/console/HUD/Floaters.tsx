"use client";
import React, { useEffect, useState } from "react";

type Floater = { id: string; text: string; crit?: boolean; x?: number; y?: number; ttl?: number };

type Props = {
  /** Push a new floater by changing this key (e.g., resolution event id) */
  trigger?: { key: string; text: string; crit?: boolean; x?: number; y?: number };
  /** default lifetime ms */
  ttl?: number;
};

export default function Floaters({ trigger, ttl = 800 }: Props) {
  const [active, setActive] = useState<Floater[]>([]);

  useEffect(() => {
    if (!trigger?.key) return;
    const f: Floater = {
      id: trigger.key,
      text: trigger.text,
      crit: trigger.crit,
      x: trigger.x ?? 0.5,
      y: trigger.y ?? 0.55,
      ttl,
    };
    setActive((prev) => [...prev, f]);
    const t = setTimeout(() => setActive((prev) => prev.filter((x) => x.id !== f.id)), ttl);
    return () => clearTimeout(t);
  }, [trigger, ttl]);

  if (!active.length) return null;

  return (
    <>
      {active.map((f) => (
        <div
          key={f.id}
          className={`floater${f.crit ? " floater--crit" : ""}`}
          style={{ left: `${(f.x ?? 0.5) * 100}%`, top: `${(f.y ?? 0.55) * 100}%` }}
        >
          {f.text}
        </div>
      ))}
    </>
  );
}
