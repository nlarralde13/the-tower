"use client";

import { useEffect, useMemo, useState } from "react";
import { validateRuleset } from "@/utils/validateRuleset";
import type { Ruleset, FloorGrid, RoomType, FloorConfig, FloorSeed } from "@/types/tower";
import { mulberry32, type RNG } from "@/engine/rng";
import { generateFloor, generateFloorFromSeed } from "@/engine/generateFloor";
import { useRunStore } from "@/store/runStore";

type Issue = { level: "error" | "warn"; message: string };
type Report = { ok: boolean; issues: Issue[] };

type RatioKey = "combat" | "trap" | "loot" | "out" | "special" | "boss" | "empty";

const RATIO_LABELS: Record<RatioKey, string> = {
  combat: "Combat",
  trap: "Trap",
  loot: "Treasure",
  out: "Out",
  special: "Special",
  boss: "Boss",
  empty: "Empty",
};

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
  entry: "#5eead4",
  exit: "#22d3ee",
  boss: "#ef4444",
  combat: "#a78bfa",
  trap: "#f59e0b",
  loot: "#10b981",
  out: "#eab308",
  special: "#f472b6",
  empty: "#1f2937",
  blocked: "#0b0b0b",
};

export default function DevPage() {
  // Validator
  const [report, setReport] = useState<Report | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [rulesetPath, setRulesetPath] = useState("/data/rulesetTemplate.json");

  // Generation
  const [ruleset, setRuleset] = useState<Ruleset | null>(null);
  const [floorIdx, setFloorIdx] = useState(1);
  const [seed, setSeed] = useState<string>("123456");
  const [grid, setGrid] = useState<FloorGrid | null>(null);
  const [busyGen, setBusyGen] = useState(false);
  const devSetRun = useRunStore((s) => s._devSetRunFromSeed);

  // Live tuning knobs
  const [minEmpty, setMinEmpty] = useState(0.6);
  const [pathBias, setPathBias] = useState(0.75);
  const [openFrac, setOpenFrac] = useState(0.55);
  const [wiggle, setWiggle] = useState(0.35);
  const [riverWidth, setRiverWidth] = useState(1);
  const [roomRatios, setRoomRatios] = useState<Record<RatioKey, number>>({
    combat: 0.3,
    trap: 0.2,
    loot: 0.2,
    out: 0.15,
    special: 0.15,
    boss: 0,
    empty: 0.2,
  });

  useEffect(() => {
    (async () => {
      setIsRunning(true);
      const val = await validateRuleset(rulesetPath);
      setReport({ ok: val.ok, issues: val.issues });
      setIsRunning(false);
      try {
        const res = await fetch(rulesetPath);
        if (res.ok) setRuleset((await res.json()) as Ruleset);
      } catch {
        // ignore fetch errors in dev tools
      }
    })();
  }, [rulesetPath]);

  useEffect(() => {
    if (!ruleset) return;
    const cfg = ruleset.floors?.[String(floorIdx)];
    if (!cfg) return;
    const base: Record<RatioKey, number> = {
      combat: cfg.room_ratios.combat ?? 0,
      trap: cfg.room_ratios.trap ?? 0,
      loot: cfg.room_ratios.loot ?? 0,
      out: cfg.room_ratios.out ?? 0,
      special: cfg.room_ratios.special ?? 0,
      boss: (cfg.room_ratios as any).boss ?? 0,
      empty: cfg.room_ratios.empty ?? 0,
    };
    const sum = Object.values(base).reduce((a, b) => a + (b || 0), 0);
    const timer = setTimeout(() => {
      if (sum <= 0) {
        setRoomRatios({
          combat: 0.3,
          trap: 0.2,
          loot: 0.2,
          out: 0.15,
          special: 0.15,
          boss: 0,
          empty: 0.2,
        });
      } else {
        setRoomRatios(base);
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [ruleset, floorIdx]);

  const ratioSum = useMemo(() => Object.values(roomRatios).reduce((acc, v) => acc + (v || 0), 0), [roomRatios]);

  const normalizedRatios = useMemo(() => {
    if (ratioSum <= 0) {
      return {
        combat: 0,
        trap: 0,
        loot: 0,
        out: 0,
        special: 0,
        boss: 0,
        empty: 0,
      } satisfies Record<RatioKey, number>;
    }
    const out: Record<RatioKey, number> = {
      combat: 0,
      trap: 0,
      loot: 0,
      out: 0,
      special: 0,
      boss: 0,
      empty: 0,
    };
    (Object.keys(out) as RatioKey[]).forEach((key) => {
      out[key] = Math.max(0, roomRatios[key]) / ratioSum;
    });
    return out;
  }, [ratioSum, roomRatios]);

  const legend = useMemo(
    () => (Object.keys(COLOR_MAP) as RoomType[]).map((k) => ({ key: k, color: COLOR_MAP[k] })),
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
    const ratiosOverride = ratioSum > 0 ? roomRatios : undefined;
    const f = generateFloor(rng, floorIdx, cfg, isFinal, {
      minEmptyFraction: minEmpty,
      pathEmptyBias: pathBias,
      openFraction: openFrac,
      wiggle,
      riverWidth,
      roomRatiosOverride: ratiosOverride,
    });
    setGrid(f);
    setBusyGen(false);
  }

  function exportSeed() {
    if (!ruleset) return;
    const s = parseInt(seed || "0", 10);
    const floorKey = String(floorIdx);
    const cfg: FloorConfig | undefined = ruleset.floors?.[floorKey];
    if (!cfg) return;
    const isFinal =
      floorIdx === ruleset.floor_count &&
      !!ruleset.floors?.[floorKey]?.boss_room &&
      !!ruleset.rules?.exit_requires_boss_clear;

    const seedObj: FloorSeed = {
      floor: floorIdx,
      seed: Number.isFinite(s) ? s : 0,
      isFinalBossFloor: isFinal,
      options: {
        minEmptyFraction: minEmpty,
        pathEmptyBias: pathBias,
        openFraction: openFrac,
        wiggle,
        riverWidth,
      },
      roomRatios: {
        combat: roomRatios.combat ?? 0,
        trap: roomRatios.trap ?? 0,
        loot: roomRatios.loot ?? 0,
        out: roomRatios.out ?? 0,
        special: roomRatios.special ?? 0,
        boss: roomRatios.boss ?? 0,
        empty: roomRatios.empty ?? 0,
      },
    };
    const blob = new Blob([JSON.stringify(seedObj, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `floor-seed-f${floorIdx}-s${seed}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function importSeed() {
    if (!ruleset) return;
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text) as FloorSeed;
        if (!data || typeof data.floor !== "number" || typeof data.seed !== "number") {
          alert("Invalid seed file: missing floor/seed");
          return;
        }
        const floorKey = String(data.floor);
        const cfg: FloorConfig | undefined = ruleset.floors?.[floorKey];
        if (!cfg) {
          alert(`No floor config found for floor ${data.floor}`);
          return;
        }
        // Reflect into UI controls where possible
        setFloorIdx(data.floor);
        setSeed(String(data.seed));
        if (data.options) {
          if (typeof data.options.minEmptyFraction === "number") setMinEmpty(data.options.minEmptyFraction);
          if (typeof data.options.pathEmptyBias === "number") setPathBias(data.options.pathEmptyBias);
          if (typeof data.options.openFraction === "number") setOpenFrac(data.options.openFraction);
          if (typeof data.options.wiggle === "number") setWiggle(data.options.wiggle);
          if (typeof data.options.riverWidth === "number") setRiverWidth(data.options.riverWidth);
        }
        if (data.roomRatios) {
          setRoomRatios((prev) => ({
            ...prev,
            combat: data.roomRatios.combat ?? prev.combat,
            trap: data.roomRatios.trap ?? prev.trap,
            loot: data.roomRatios.loot ?? prev.loot,
            out: data.roomRatios.out ?? prev.out,
            special: data.roomRatios.special ?? prev.special,
            boss: (data.roomRatios as any).boss ?? prev.boss,
            empty: data.roomRatios.empty ?? prev.empty,
          }));
        }
        setBusyGen(true);
        const grid = generateFloorFromSeed(data, cfg);
        setGrid(grid);
        setBusyGen(false);
      } catch (e) {
        console.error(e);
        alert("Failed to import seed JSON");
      }
    };
    input.click();
  }

  return (
    <div style={{ padding: 16, maxWidth: 980, margin: "0 auto" }}>
      <h1 style={{ marginBottom: 8 }}>Developer Tools</h1>
      <p style={{ marginTop: 0, opacity: 0.8 }}>
        Local checks and previews for <strong>The Tower</strong>.
      </p>

      {/* Card 1: Validator */}
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
            style={{
              ...BUTTON_STYLE,
              background: isRunning ? "rgba(255,255,255,0.08)" : BUTTON_STYLE.background,
            }}
            aria-busy={isRunning}
          >
            {isRunning ? "Running…" : "Run Validator"}
          </button>
        </div>

        {report && (
          <>
            <div style={{ margin: "8px 0 12px", fontSize: 14, opacity: 0.85 }}>
              Result: <strong style={{ color: report.ok ? "limegreen" : "salmon" }}>{report.ok ? "Valid" : "Invalid"}</strong>
              {" "}— {report.issues.filter((i) => i.level === "error").length} errors,
              {" "}
              {report.issues.filter((i) => i.level === "warn").length} warnings
            </div>
            <IssuesTable issues={report.issues} />
          </>
        )}
        {!report && !isRunning && <p style={{ opacity: 0.8 }}>No report yet. Click “Run Validator.”</p>}
      </section>

      {/* Card 2: Floor Generator + River Controls */}
      <section style={CARD_STYLE}>
        <header style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>Floor Generator Preview</h2>
          <span style={{ fontSize: 12, opacity: 0.8 }}>8×8 grid · seeded · river corridor</span>
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
          <button
            onClick={() => {
              // 32-bit unsigned random integer
              const s = Math.floor(Math.random() * 0xffffffff);
              setSeed(String(s));
            }}
            style={{ ...BUTTON_STYLE }}
            title="Randomize seed"
          >
            Random Seed
          </button>

          <label htmlFor="floor" style={{ fontSize: 14, opacity: 0.85, minWidth: 80, marginLeft: 8 }}>
            Floor
          </label>
          <select
            id="floor"
            value={floorIdx}
            onChange={(e) => setFloorIdx(parseInt(e.target.value, 10))}
            style={{ ...INPUT_STYLE, maxWidth: 120, padding: "8px 10px", appearance: "none", cursor: "pointer" }}
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
          <button
            onClick={exportSeed}
            disabled={!ruleset}
            style={{ ...BUTTON_STYLE }}
            title="Download a JSON file capturing the current generation knobs"
          >
            Export Seed JSON
          </button>
          <button
            onClick={importSeed}
            disabled={!ruleset}
            style={{ ...BUTTON_STYLE }}
            title="Load a JSON seed and generate immediately"
          >
            Import Seed JSON
          </button>
          <button
            onClick={async () => {
              if (!devSetRun) return;
              const n = parseInt(String(seed), 10);
              if (Number.isNaN(n)) return alert("Enter a numeric seed to warp.");
              await devSetRun(floorIdx, n >>> 0);
              // Navigate to play
              window.location.href = "/play?overlay=1";
            }}
            style={{ ...BUTTON_STYLE }}
            title="Warp into /play using current Floor/Seed"
          >
            Warp → /play
          </button>
        </div>

        {/* River layout knobs */}
        <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", marginBottom: 12 }}>
          <div>
            <label htmlFor="riverWidth" style={{ display: "block", fontSize: 13, opacity: 0.85, marginBottom: 6 }}>
              River Thickness (tiles beyond path): {riverWidth}
            </label>
            <input
              id="riverWidth"
              type="range"
              min={0}
              max={3}
              step={1}
              value={riverWidth}
              onChange={(e) => setRiverWidth(parseInt(e.target.value, 10))}
              style={{ width: "100%" }}
            />
          </div>
          <div>
            <label htmlFor="openFrac" style={{ display: "block", fontSize: 13, opacity: 0.85, marginBottom: 6 }}>
              Open Fraction: {Math.round(openFrac * 100)}%
            </label>
            <input
              id="openFrac"
              type="range"
              min={0.35}
              max={0.85}
              step={0.05}
              value={openFrac}
              onChange={(e) => setOpenFrac(parseFloat(e.target.value))}
              style={{ width: "100%" }}
            />
          </div>
          <div>
            <label htmlFor="wiggle" style={{ display: "block", fontSize: 13, opacity: 0.85, marginBottom: 6 }}>
              River Wiggle: {Math.round(wiggle * 100)}%
            </label>
            <input
              id="wiggle"
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={wiggle}
              onChange={(e) => setWiggle(parseFloat(e.target.value))}
              style={{ width: "100%" }}
            />
          </div>
        </div>

        {/* Density knobs */}
        <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", marginBottom: 12 }}>
          <div>
            <label htmlFor="minEmpty" style={{ display: "block", fontSize: 13, opacity: 0.85, marginBottom: 6 }}>
              Min Empty Fraction: {Math.round(minEmpty * 100)}%
            </label>
            <input
              id="minEmpty"
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={minEmpty}
              onChange={(e) => setMinEmpty(parseFloat(e.target.value))}
              style={{ width: "100%" }}
            />
          </div>
          <div>
            <label htmlFor="pathBias" style={{ display: "block", fontSize: 13, opacity: 0.85, marginBottom: 6 }}>
              Corridor Empty Bias: {Math.round(pathBias * 100)}%
            </label>
            <input
              id="pathBias"
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={pathBias}
              onChange={(e) => setPathBias(parseFloat(e.target.value))}
              style={{ width: "100%" }}
            />
          </div>
        </div>

        {/* Room ratios */}
        <div style={{ marginBottom: 12 }}>
          <header style={{ marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
            <h3 style={{ margin: 0, fontSize: 16 }}>Room Density Weights</h3>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <small style={{ opacity: 0.7 }}>Normalized total: {Math.round(ratioSum > 0 ? 100 : 0)}%</small>
              <button
                onClick={() => {
                  // Dirichlet-like random weights across all ratio keys
                  const keys = Object.keys(RATIO_LABELS) as RatioKey[];
                  const draws = keys.map(() => -Math.log(Math.max(Number.EPSILON, Math.random())));
                  const total = draws.reduce((a, b) => a + b, 0) || 1;
                  const next: Record<RatioKey, number> = {} as any;
                  keys.forEach((k, i) => {
                    next[k] = draws[i] / total;
                  });
                  setRoomRatios(next);
                }}
                style={{ ...BUTTON_STYLE }}
                title="Randomize density weights"
              >
                Random Weights
              </button>
            </div>
          </header>
          <p style={{ marginTop: 0, marginBottom: 12, fontSize: 13, opacity: 0.8 }}>
            Adjust relative weights per room type. Values are automatically normalized when generating a floor.
          </p>
          <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
            {(Object.keys(RATIO_LABELS) as RatioKey[]).map((key) => (
              <RatioControl
                key={key}
                label={RATIO_LABELS[key]}
                value={roomRatios[key] ?? 0}
                normalized={normalizedRatios[key] ?? 0}
                onChange={(next) =>
                  setRoomRatios((prev) => ({
                    ...prev,
                    [key]: Number.isFinite(next) && next >= 0 ? next : 0,
                  }))
                }
              />
            ))}
          </div>
        </div>

        {!ruleset && <p style={{ opacity: 0.8 }}>Load or fix the ruleset above to enable generation.</p>}

        {grid && (
          <div style={{ display: "grid", gap: 12 }}>
            <GridPreview grid={grid} />
            <Legend legend={legend} />
            <div style={{ fontSize: 13, opacity: 0.85 }}>
              <strong>Entry</strong>: ({grid.entry.x},{grid.entry.y}) · <strong>Exit</strong>: ({grid.exit.x},{grid.exit.y})
              {grid.boss ? (
                <>
                  {" "}· <strong>Boss</strong>: ({grid.boss.x},{grid.boss.y})
                </>
              ) : null}
            </div>
          </div>
        )}

        {!grid && ruleset && (
          <p style={{ opacity: 0.8 }}>
            Choose seed/floor, tweak the river + density knobs, and <em>Generate</em> to preview.
          </p>
        )}
      </section>
    </div>
  );
}

/* ---------- UI helpers ---------- */
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
      style={{ borderRadius: 8, overflow: "hidden", border: "1px solid rgba(255,255,255,0.1)" }}
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
          <div style={{ color: i.level === "error" ? "salmon" : "khaki" }}>{i.level.toUpperCase()}</div>
          <div style={{ whiteSpace: "pre-wrap" }}>{i.message}</div>
        </div>
      ))}
    </div>
  );
}

function GridPreview({ grid }: { grid: FloorGrid }) {
  const size = 30;
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
            style={{ width: 14, height: 14, borderRadius: 4, background: l.color, display: "inline-block" }}
          />
          <span style={{ fontSize: 13, opacity: 0.85 }}>{l.key}</span>
        </div>
      ))}
    </div>
  );
}

function RatioControl({
  label,
  value,
  normalized,
  onChange,
}: {
  label: string;
  value: number;
  normalized: number;
  onChange: (next: number) => void;
}) {
  const percent = Math.round((normalized || 0) * 100);
  const weight = Number.isFinite(value) ? value : 0;
  return (
    <div>
      <label style={{ display: "block", fontSize: 13, opacity: 0.85, marginBottom: 6 }}>
        {label} — {percent}% (w={weight.toFixed(2)})
      </label>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={weight}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          style={{ flex: 1 }}
        />
        <input
          type="number"
          min={0}
          step={0.05}
          value={weight}
          onChange={(e) => {
            const raw = parseFloat(e.target.value);
            onChange(Number.isFinite(raw) && raw >= 0 ? raw : 0);
          }}
          style={{
            width: 70,
            padding: "6px 8px",
            borderRadius: 6,
            border: "1px solid rgba(255,255,255,0.12)",
            background: "rgba(0,0,0,0.25)",
            color: "inherit",
          }}
        />
      </div>
    </div>
  );
}
