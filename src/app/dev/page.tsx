"use client";

import { useEffect, useMemo, useState } from "react";
import { validateRuleset } from "@/utils/validateRuleset";
import type { Ruleset, FloorGrid, RoomType, FloorConfig } from "@/types/tower";
import { mulberry32, type RNG } from "@/engine/rng";
import { generateFloor } from "@/engine/generateFloor";

type Issue = { level: "error" | "warn"; message: string };
type Report = { ok: boolean; issues: Issue[] };

const CARD_STYLE: React.CSSProperties = {
  marginTop: 16,
  padding: 16,
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 12,
  background: "rgba(255,255,255,0.03)",
};

const INPUT_STYLE: React.CSSProperties = {
  flex: 1,
  padding: "8px 10px",
  borderRadius: 8,
  border: "1px solid rgba(255,255,255,0.1)",
  background: "rgba(0,0,0,0.2)",
  color: "inherit",
};

const BUTTON_STYLE: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.15)",
  background: "rgba(255,255,255,0.12)",
  cursor: "pointer",
};

const COLOR_MAP: Record<RoomType, string> = {
  entry:   "#5eead4", // teal
  exit:    "#22d3ee", // cyan
  boss:    "#ef4444", // red
  combat:  "#a78bfa", // violet
  trap:    "#f59e0b", // amber
  loot:    "#10b981", // green
  out:     "#eab308", // yellow
  special: "#f472b6", // pink
  empty:   "#1f2937", // slate
};

export default function DevPage() {
  // ----- Validator state -----
  const [report, setReport] = useState<Report | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [rulesetPath, setRulesetPath] = useState("/data/rulesetTemplate.json");

  // ----- Floor generator state -----
  const [ruleset, setRuleset] = useState<Ruleset | null>(null);
  const [floorIdx, setFloorIdx] = useState(1);
  const [seed, setSeed] = useState<string>("123456");
  const [grid, setGrid] = useState<FloorGrid | null>(null);
  const [busyGen, setBusyGen] = useState(false);

  // Load ruleset once (also runs validator automatically)
  useEffect(() => {
    (async () => {
      setIsRunning(true);
      const val = await validateRuleset(rulesetPath);
      setReport({ ok: val.ok, issues: val.issues });
      setIsRunning(false);

      try {
        const res = await fetch(rulesetPath);
        if (res.ok) {
          const json = (await res.json()) as Ruleset;
          setRuleset(json);
        }
      } catch (e) {
        // ignore — validator already reported failures
      }
    })();
  }, [rulesetPath]);

  const legend = useMemo(
    () =>
      (Object.keys(COLOR_MAP) as RoomType[]).map((k) => ({
        key: k,
        color: COLOR_MAP[k],
      })),
    []
  );

  async function runValidator() {
    setIsRunning(true);
    const res = await validateRuleset(rulesetPath);
    setReport({ ok: res.ok, issues: res.issues });
    setIsRunning(false);
  }

  function generate() {
    if (!ruleset) return;
    const s = parseInt(seed || "0", 10);
    const rng: RNG = mulberry32(Number.isFinite(s) ? s : 0);

    const floorKey = String(floorIdx);
    const cfg: FloorConfig | undefined = ruleset.floors?.[floorKey];
    if (!cfg) return;

    const isFinal =
      floorIdx === ruleset.floor_count &&
      !!ruleset.floors?.[floorKey]?.boss_room &&
      !!ruleset.rules?.exit_requires_boss_clear;

    setBusyGen(true);
    const f = generateFloor(rng, floorIdx, cfg, isFinal);
    setGrid(f);
    setBusyGen(false);
  }

  return (
    <div style={{ padding: 16, maxWidth: 980, margin: "0 auto" }}>
      <h1 style={{ marginBottom: 8 }}>Developer Tools</h1>
      <p style={{ marginTop: 0, opacity: 0.8 }}>
        Local checks and previews for <strong>The Tower</strong>.
      </p>

      {/* ===== Card 1: Ruleset Validator ===== */}
      <section style={CARD_STYLE}>
        <header style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>Ruleset Validator</h2>
          {report && <Badge ok={report.ok} />}
        </header>

        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12 }}>
          <label htmlFor="ruleset-path" style={{ fontSize: 14, opacity: 0.85, minWidth: 120 }}>
            Ruleset path
          </label>
          <input
            id="ruleset-path"
            value={rulesetPath}
            onChange={(e) => setRulesetPath(e.target.value)}
            style={INPUT_STYLE}
            spellCheck={false}
          />
          <button
            onClick={runValidator}
            disabled={isRunning}
            style={{ ...BUTTON_STYLE, background: isRunning ? "rgba(255,255,255,0.08)" : BUTTON_STYLE.background }}
            aria-busy={isRunning}
          >
            {isRunning ? "Running…" : "Run Validator"}
          </button>
        </div>

        {report && (
          <>
            <div style={{ margin: "8px 0 12px", fontSize: 14, opacity: 0.85 }}>
              Result:{" "}
              <strong style={{ color: report.ok ? "limegreen" : "salmon" }}>
                {report.ok ? "Valid" : "Invalid"}
              </strong>{" "}
              — {report.issues.filter((i) => i.level === "error").length} errors,{" "}
              {report.issues.filter((i) => i.level === "warn").length} warnings
            </div>
            <IssuesTable issues={report.issues} />
          </>
        )}
        {!report && !isRunning && <p style={{ opacity: 0.8 }}>No report yet. Click “Run Validator.”</p>}
      </section>

      {/* ===== Card 2: Floor Generator & Preview ===== */}
      <section style={CARD_STYLE}>
        <header style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>Floor Generator Preview</h2>
          <span style={{ fontSize: 12, opacity: 0.8 }}>
            8×8 grid · seeded · boss-adjacent exit on final floor
          </span>
        </header>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
          <label htmlFor="seed" style={{ fontSize: 14, opacity: 0.85, minWidth: 80 }}>
            Seed
          </label>
          <input
            id="seed"
            value={seed}
            onChange={(e) => setSeed(e.target.value)}
            style={{ ...INPUT_STYLE, maxWidth: 200 }}
            spellCheck={false}
          />

          <label htmlFor="floor" style={{ fontSize: 14, opacity: 0.85, minWidth: 80, marginLeft: 8 }}>
            Floor
          </label>
          <select
            id="floor"
            value={floorIdx}
            onChange={(e) => setFloorIdx(parseInt(e.target.value, 10))}
            style={{
              ...INPUT_STYLE,
              maxWidth: 120,
              padding: "8px 10px",
              appearance: "none",
              cursor: "pointer",
            }}
          >
            {Array.from({ length: Math.max(1, ruleset?.floor_count ?? 5) }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>

          <button
            onClick={generate}
            disabled={!ruleset || busyGen}
            style={{
              ...BUTTON_STYLE,
              background: busyGen ? "rgba(255,255,255,0.08)" : BUTTON_STYLE.background,
            }}
            aria-busy={busyGen}
          >
            {busyGen ? "Generating…" : "Generate"}
          </button>
        </div>

        {!ruleset && (
          <p style={{ opacity: 0.8 }}>
            Load or fix the ruleset above to enable generation. The preview uses <code>/data/rulesetTemplate.json</code>.
          </p>
        )}

        {grid && (
          <div style={{ display: "grid", gap: 12 }}>
            <GridPreview grid={grid} />
            <Legend legend={legend} />
            <div style={{ fontSize: 13, opacity: 0.85 }}>
              <strong>Entry</strong>: ({grid.entry.x},{grid.entry.y}) ·{" "}
              <strong>Exit</strong>: ({grid.exit.x},{grid.exit.y})
              {grid.boss ? (
                <>
                  {" "}
                  · <strong>Boss</strong>: ({grid.boss.x},{grid.boss.y})
                </>
              ) : null}
            </div>
          </div>
        )}

        {!grid && ruleset && (
          <p style={{ opacity: 0.8 }}>Set a seed, choose a floor, and click <em>Generate</em> to preview.</p>
        )}
      </section>
    </div>
  );
}

/* ---------- UI bits ---------- */

function Badge({ ok }: { ok: boolean }) {
  return (
    <span
      style={{
        fontSize: 12,
        padding: "4px 8px",
        borderRadius: 999,
        background: ok ? "rgba(0,200,0,0.15)" : "rgba(255,80,80,0.15)",
        border: `1px solid ${ok ? "rgba(0,200,0,0.35)" : "rgba(255,80,80,0.35)"}`,
      }}
      aria-label={ok ? "Valid" : "Invalid"}
    >
      {ok ? "Valid" : "Invalid"}
    </span>
  );
}

function IssuesTable({ issues }: { issues: Issue[] }) {
  if (!issues.length) {
    return (
      <div
        style={{
          padding: 12,
          borderRadius: 8,
          background: "rgba(0,0,0,0.2)",
          border: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        <em style={{ opacity: 0.7 }}>No issues. Your ruleset DNA is clean.</em>
      </div>
    );
  }

  return (
    <div
      role="table"
      aria-label="Validation issues"
      style={{
        borderRadius: 8,
        overflow: "hidden",
        border: "1px solid rgba(255,255,255,0.1)",
      }}
    >
      <div
        role="row"
        style={{
          display: "grid",
          gridTemplateColumns: "120px 1fr",
          padding: "10px 12px",
          background: "rgba(255,255,255,0.06)",
          fontWeight: 600,
          fontSize: 14,
        }}
      >
        <div>Level</div>
        <div>Message</div>
      </div>
      {issues.map((i, idx) => (
        <div
          role="row"
          key={idx}
          style={{
            display: "grid",
            gridTemplateColumns: "120px 1fr",
            padding: "10px 12px",
            borderTop: "1px solid rgba(255,255,255,0.08)",
            background: "rgba(255,255,255,0.02)",
          }}
        >
          <div style={{ color: i.level === "error" ? "salmon" : "khaki" }}>
            {i.level.toUpperCase()}
          </div>
          <div style={{ whiteSpace: "pre-wrap" }}>{i.message}</div>
        </div>
      ))}
    </div>
  );
}

function GridPreview({ grid }: { grid: FloorGrid }) {
  const size = 30; // px per cell for preview
  return (
    <div
      role="grid"
      aria-label="Floor grid preview"
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${grid.width}, ${size}px)`,
        gridTemplateRows: `repeat(${grid.height}, ${size}px)`,
        gap: 2,
        background: "rgba(255,255,255,0.06)",
        padding: 2,
        borderRadius: 8,
        width: "fit-content",
      }}
    >
      {grid.cells.map((c, i) => (
        <div
          key={i}
          title={`${c.type} (${c.x},${c.y})`}
          style={{
            width: size,
            height: size,
            background: COLOR_MAP[c.type],
            borderRadius: 4,
            display: "grid",
            placeItems: "center",
            fontSize: 11,
            color: "rgba(0,0,0,0.8)",
            userSelect: "none",
          }}
        >
          {/* tiny labels for special tiles */}
          {c.type === "entry" ? "E" : c.type === "exit" ? "X" : c.type === "boss" ? "B" : ""}
        </div>
      ))}
    </div>
  );
}

function Legend({ legend }: { legend: { key: RoomType; color: string }[] }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 6 }}>
      {legend.map((l) => (
        <div key={l.key} style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            aria-hidden
            style={{
              width: 14,
              height: 14,
              borderRadius: 4,
              background: l.color,
              display: "inline-block",
            }}
          />
          <span style={{ fontSize: 13, opacity: 0.85 }}>{l.key}</span>
        </div>
      ))}
    </div>
  );
}
