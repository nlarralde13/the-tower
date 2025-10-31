// /src/utils/validateRuleset.ts
import type { Ruleset, FloorConfig, RoomRatios } from "@/types/tower";

type ValidationIssue = { level: "error" | "warn"; message: string };
export type ValidationReport = { ok: boolean; issues: ValidationIssue[]; ruleset?: Ruleset };

const RATIO_KEYS: Array<keyof RoomRatios> = ["combat", "trap", "loot", "out", "special", "empty"];
const TOLERANCE = 0.01;

export async function validateRuleset(
  path = "/data/rulesetTemplate.json"
): Promise<ValidationReport> {
  const issues: ValidationIssue[] = [];
  try {
    const res = await fetch(path);
    if (!res.ok) throw new Error(`Failed to load ruleset: ${res.status} ${res.statusText}`);
    const json = (await res.json()) as Ruleset;

    const requiredTop: Array<keyof Ruleset> = ["tower_id", "floor_count", "floors", "rules", "scaling"];
    for (const key of requiredTop) {
      if (!(key in json)) issues.push({ level: "error", message: `Missing top-level key: ${key}` });
    }

    const floorKeys = Object.keys(json.floors ?? {});
    if (floorKeys.length !== json.floor_count) {
      issues.push({
        level: "warn",
        message: `Expected floor_count=${json.floor_count}, but found ${floorKeys.length} floor entries.`,
      });
    }

    for (const k of floorKeys) {
      const f: FloorConfig = json.floors[k];
      if (typeof f?.difficulty !== "number") {
        issues.push({ level: "error", message: `Floor ${k}: "difficulty" missing or not a number.` });
      }
      if (!f?.room_ratios) {
        issues.push({ level: "error", message: `Floor ${k}: missing "room_ratios".` });
      } else {
        const ratios = f.room_ratios as Record<string, unknown>;
        for (const key of RATIO_KEYS) {
          const raw = ratios[key];
          if (raw !== undefined) {
            if (typeof raw !== "number" || Number.isNaN(raw)) {
              issues.push({ level: "error", message: `Floor ${k}: room_ratios.${key} must be a number.` });
            } else if (raw < 0 || raw > 1) {
              issues.push({ level: "error", message: `Floor ${k}: room_ratios.${key} out of range [0..1]: ${raw}` });
            }
          }
        }
        for (const extra of Object.keys(f.room_ratios)) {
          if (!RATIO_KEYS.includes(extra as keyof RoomRatios)) {
            issues.push({ level: "warn", message: `Floor ${k}: unknown room_ratios key "${extra}".` });
          }
        }
        const sum = RATIO_KEYS.reduce((total, key) => {
          const raw = ratios[key];
          return total + (typeof raw === "number" ? raw : 0);
        }, 0);
        if (Math.abs(sum - 1) > TOLERANCE) {
          issues.push({
            level: "warn",
            message: `Floor ${k}: room_ratios sum = ${sum.toFixed(3)} (expected ~1.000 ± ${TOLERANCE}).`,
          });
        }
      }
    }

    const last = String(json.floor_count);
    if (json.rules?.exit_requires_boss_clear) {
      const lastFloor = json.floors?.[last];
      if (!lastFloor?.boss_room) {
        issues.push({
          level: "error",
          message: `Final floor (${last}) must include "boss_room": true when exit_requires_boss_clear is enabled.`,
        });
      }
    }

    const ok = issues.every(i => i.level !== "error");
    logValidationSummary(json.display_name ?? json.tower_id, ok, issues);
    return { ok, issues, ruleset: json };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    const failure: ValidationReport = { ok: false, issues: [{ level: "error", message: msg }] };
    logValidationSummary("ruleset", false, failure.issues);
    return failure;
  }
}

function logValidationSummary(name: string, ok: boolean, issues: ValidationIssue[]) {
  const errors = issues.filter(i => i.level === "error");
  const warns = issues.filter(i => i.level === "warn");
  console.group(`Ruleset validation: ${name}`);
  console[ok ? "log" : "error"](`${ok ? "✅" : "❌"} ${ok ? "Valid" : "Invalid"} — ${errors.length} errors, ${warns.length} warnings.`);
  for (const i of issues) console[i.level === "error" ? "error" : "warn"](`${i.level.toUpperCase()}: ${i.message}`);
  console.groupEnd();
}
