"use client";

import { LEGEND } from "@/ui/legendConfig";

export default function Legend({ className = "" }: { className?: string }) {
  return (
    <aside
      className={"p-3 text-zinc-200 select-none " + className}
      aria-label="Legend"
    >
      {/* Kill default bullets/padding so only our color dots show */}
      <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {LEGEND.map((entry) => {
          const color = entry.color ?? "#888888";
          const size = 14; // dot size in px

          return (
            <li
              key={entry.label}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 8,
              }}
            >
              {/* Color dot */}
              <span
                style={{
                  display: "inline-block",
                  width: size,
                  height: size,
                  borderRadius: "9999px",
                  backgroundColor: color, // <- the dot is exactly this color
                  boxShadow: `0 0 6px ${color}55`,
                }}
                title={entry.label}
              />
              {/* Label */}
              <span>{entry.label}</span>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
