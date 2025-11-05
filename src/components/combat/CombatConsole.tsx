"use client";
import { useEffect, useMemo, useRef, useState } from "react";

type Entity = {
  id: string;
  name: string;
  hp: number; hpMax: number;
  mp?: number; mpMax?: number;
  st?: number; stMax?: number;
  status?: string[];
  isPlayer?: boolean;
  position?: { x?: number; y?: number }; // for floaters rough placement
};

type EncounterVM = {
  turnOwnerId: string;
  order: string[];        // initiative order, ids
  entities: Record<string, Entity>;
  enemies: string[];
  party: string[];
};

type Skill = { id: string; name: string; tag?: "single"|"multi"|"cleave"|"self" };
type Item  = { id: string; name: string; tag?: "single"|"multi"|"self" };

type Props = {
  vm: EncounterVM;
  skills: Skill[];
  items: Item[];

  // hooks into your engine:
  onAct: (action: { type: "Attack"|"Skill"|"Item"|"Defend"|"Flee"; id?: string; targets?: string[] }) => void;

  // optional: stream of resolution lines (we tap for crit floaters/log)
  lastResolution?: { text: string; targetId?: string; crit?: boolean; dmg?: number };
};

export default function CombatConsole({ vm, skills, items, onAct, lastResolution }: Props) {
  /* ─────────────────────────── menus ─────────────────────────── */
  type Menu = "root" | "skills" | "items" | "targets";
  const [menu, setMenu] = useState<Menu>("root");

  // selection state
  const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null);
  const [selectedItem,  setSelectedItem]  = useState<Item  | null>(null);
  const [targetIds, setTargetIds] = useState<string[]>([]);

  const enemies = vm.enemies.map(id => vm.entities[id]).filter(Boolean);
  const party   = vm.party.map(id => vm.entities[id]).filter(Boolean);

  // helpers
  const reset = () => { setMenu("root"); setSelectedSkill(null); setSelectedItem(null); setTargetIds([]); };

  /* ───────────────────────── turn strip & hud ───────────────────────── */
  useEffect(() => {
    // Populate HUD panels
    const left = document.getElementById("hud-left");
    const right = document.getElementById("hud-right");
    if (!left || !right) return;

    left.innerHTML = party.map(renderEntityRow).join("");
    right.innerHTML = enemies.map(renderEntityRow).join("");

    function renderEntityRow(e: Entity) {
      const pct = (n:number,m:number)=> Math.max(0,Math.min(100, Math.round((n/m)*100)));
      return `
      <div class="entity-row">
        <div class="entity-name">${e.name}</div>
        <div class="meters">
          <div class="meter hp"><i style="width:${pct(e.hp,e.hpMax)}%"></i></div>
          ${e.mpMax ? `<div class="meter mp"><i style="width:${pct(e.mp||0,e.mpMax)}%"></i></div>` : ""}
          ${e.stMax ? `<div class="meter st"><i style="width:${pct(e.st||0,e.stMax)}%"></i></div>` : ""}
        </div>
        <div class="entity-status">
          ${(e.status||[]).slice(0,5).map(s=>`<span class="status-chip">${s}</span>`).join("")}
        </div>
      </div>`;
    }
  }, [vm, enemies, party]);

  useEffect(() => {
    // Turn order strip
    const strip = document.querySelector(".turn-strip") || (() => {
      const host = document.getElementById("scene-overlay");
      if (!host) return null;
      const el = document.createElement("div");
      el.className = "turn-strip";
      host.appendChild(el);
      return el;
    })();
    if (!strip) return;

    strip.innerHTML = vm.order.map(id => {
      const e = vm.entities[id];
      const current = id === vm.turnOwnerId ? ` aria-current="true"` : "";
      const label = e?.isPlayer ? `🛡 ${e.name}` : `⚔️ ${e?.name ?? id}`;
      return `<div class="turn-chip"${current}>${label}</div>`;
    }).join("");
  }, [vm]);

  /* ───────────────────────── compact log & floaters ───────────────────────── */
  const logHostRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // ensure compact log host exists
    const host = document.getElementById("scene-overlay");
    if (!host) return;
    let log = host.querySelector(".compact-log") as HTMLDivElement | null;
    if (!log) {
      log = document.createElement("div");
      log.className = "compact-log";
      host.appendChild(log);
    }
    logHostRef.current = log;
  }, []);

  useEffect(() => {
    if (!lastResolution || !logHostRef.current) return;

    const line = document.createElement("div");
    line.textContent = lastResolution.text;
    logHostRef.current.appendChild(line);
    // keep last 5
    const nodes = logHostRef.current.querySelectorAll("div");
    if (nodes.length > 5) nodes[0].remove();

    // crit/damage floater
    if (lastResolution.dmg && lastResolution.targetId) {
      const host = document.getElementById("scene-overlay");
      if (!host) return;
      const f = document.createElement("div");
      f.className = "floater" + (lastResolution.crit ? " floater--crit" : "");
      f.textContent = lastResolution.crit ? `★ ${lastResolution.dmg}` : `${lastResolution.dmg}`;
      // simple placement: center; could map by entity position later
      f.style.left = "50%"; f.style.top = "55%";
      host.appendChild(f);
      setTimeout(() => f.remove(), 800);
    }
  }, [lastResolution]);

  /* ───────────────────────── JRPG menus ───────────────────────── */
  const mainCmd = (type: "Attack"|"Defend"|"Flee"|"Skill"|"Item") => {
    if (type === "Skill") { setMenu("skills"); return; }
    if (type === "Item")  { setMenu("items");  return; }
    if (type === "Attack") { setMenu("targets"); return; }
    // Defend/Flee fire immediately
    onAct({ type });
    reset();
  };

  const chooseSkill = (s: Skill) => { setSelectedSkill(s); setMenu("targets"); };
  const chooseItem  = (i: Item)  => { setSelectedItem(i);  setMenu("targets"); };

  const toggleTarget = (id: string) => {
    // single vs multi/cleave
    const tag = (selectedSkill?.tag || selectedItem?.tag || "single");
    if (tag === "single") {
      setTargetIds([id]);
    } else {
      setTargetIds(prev => prev.includes(id) ? prev.filter(x=>x!==id) : [...prev, id]);
    }
  };

  const confirmTargets = () => {
    if (selectedSkill) { onAct({ type: "Skill", id: selectedSkill.id, targets: targetIds }); }
    else if (selectedItem) { onAct({ type: "Item", id: selectedItem.id, targets: targetIds }); }
    else { onAct({ type: "Attack", targets: targetIds }); }
    reset();
  };

  /* ───────────────────────── render ───────────────────────── */
  return (
    <>
      {/* controller pad */}
      <div className="cmd-row" role="group" aria-label="Commands">
        <button className="btn cmd btn--primary" onClick={()=>mainCmd("Attack")}>Attack</button>
        <button className="btn cmd" onClick={()=>mainCmd("Skill")}>Skills</button>
        <button className="btn cmd" onClick={()=>mainCmd("Item")}>Items</button>
        <button className="btn cmd" onClick={()=>mainCmd("Defend")}>Defend</button>
        <button className="btn cmd" onClick={()=>mainCmd("Flee")}>Flee</button>
      </div>

      {/* submenus */}
      {menu === "skills" && (
        <div className="submenu" role="menu" aria-label="Skills">
          {skills.map(s=>(
            <button key={s.id} className="btn" onClick={()=>chooseSkill(s)}>
              {s.name}
            </button>
          ))}
          <button className="btn" onClick={reset}>Back</button>
        </div>
      )}

      {menu === "items" && (
        <div className="submenu" role="menu" aria-label="Items">
          {items.map(i=>(
            <button key={i.id} className="btn" onClick={()=>chooseItem(i)}>
              {i.name}
            </button>
          ))}
          <button className="btn" onClick={reset}>Back</button>
        </div>
      )}

      {menu === "targets" && (
        <div className="submenu" aria-label="Targets">
          <div className="targets">
            {enemies.map(e=>(
              <button
                key={e.id}
                className="btn target-chip"
                aria-selected={targetIds.includes(e.id)}
                onClick={()=>toggleTarget(e.id)}
              >
                {e.name}
              </button>
            ))}
          </div>
          <div className="targets">
            {/* allow self/ally targeting when tag indicates */}
            { (selectedSkill?.tag === "self") && party.map(p=>(
              <button key={p.id} className="btn target-chip"
                aria-selected={targetIds.includes(p.id)}
                onClick={()=>toggleTarget(p.id)}
              >{p.name}</button>
            ))}
          </div>
          <div className="cmd-row" style={{gridTemplateColumns:"1fr 1fr"}}>
            <button className="btn" onClick={confirmTargets} disabled={targetIds.length===0}>Confirm</button>
            <button className="btn" onClick={reset}>Back</button>
          </div>
        </div>
      )}
    </>
  );
}
