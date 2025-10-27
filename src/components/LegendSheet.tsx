"use client";

import { useEffect, useRef, useState } from "react";
import Legend from "@/components/Legend";

export default function LegendSheet({ className = "" }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement | null>(null);

  // Close on ESC
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Restore focus to the button when closed
  useEffect(() => {
    if (!open) btnRef.current?.focus();
  }, [open]);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen(true)}
        className={
          "rounded-md px-3 py-1.5 text-sm font-medium " +
          "bg-zinc-800/70 text-zinc-200 hover:bg-zinc-700 " + className
        }
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls="legend-drawer"
      >
        Legend
      </button>

      {/* Overlay + drawer */}
      {open && (
        <div
          className="fixed inset-0 z-50"
          role="dialog"
          aria-modal="true"
          id="legend-drawer"
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setOpen(false)}
          />

          {/* Panel (right drawer on md+, bottom sheet on mobile) */}
          <div
            className={[
              "absolute bg-zinc-900 border border-zinc-800 shadow-xl",
              "w-full rounded-t-2xl bottom-0 left-0 p-4",
              "md:w-[320px] md:h-full md:rounded-none md:top-0 md:right-0 md:left-auto",
            ].join(" ")}
          >
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-semibold">Legend</h2>
              <button
                onClick={() => setOpen(false)}
                className="rounded-md px-2 py-1 text-sm bg-zinc-800/70 text-zinc-200 hover:bg-zinc-700"
                aria-label="Close legend"
              >
                ✕
              </button>
            </div>

            {/* Content */}
            <Legend />
            <p className="mt-3 text-xs text-zinc-400">
              Tip: press <kbd className="px-1 py-0.5 rounded bg-zinc-800 border border-zinc-700">Esc</kbd> to close.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
