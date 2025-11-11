"use client";
import { useState } from "react";

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
  /* --------------------------- menus --------------------------- */
  type Menu = "root" | "skills" | "items" | "targets";
  type TargetMode = "attack" | "skill" | "item" | null;
  const [menu, setMenu] = useState<Menu>("root");

  // selection state
  const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null);
  const [selectedItem,  setSelectedItem]  = useState<Item  | null>(null);
  const [targetIds, setTargetIds] = useState<string[]>([]);
  const [targetMode, setTargetMode] = useState<TargetMode>(null);

  const enemies = vm.enemies.map(id => vm.entities[id]).filter(Boolean);
  const party   = vm.party.map(id => vm.entities[id]).filter(Boolean);

  // helpers
  const reset = () => {
    setMenu("root");
    setSelectedSkill(null);
    setSelectedItem(null);
    setTargetIds([]);
    setTargetMode(null);
  };


  /* ------------------------- JRPG menus ------------------------- */
  const mainCmd = (type: "Attack"|"Defend"|"Flee"|"Skill"|"Item") => {
    if (type === "Skill") { setMenu("skills"); return; }
    if (type === "Item")  { setMenu("items");  return; }
    if (type === "Attack") {
      setSelectedSkill(null);
      setSelectedItem(null);
      setTargetIds([]);
      setTargetMode("attack");
      setMenu("targets");
      return;
    }
    // Defend/Flee fire immediately
    onAct({ type });
    reset();
  };

  const chooseSkill = (s: Skill) => {
    setSelectedSkill(s);
    setSelectedItem(null);
    setTargetMode("skill");
    setMenu("targets");
  };
  const chooseItem  = (i: Item)  => {
    setSelectedItem(i);
    setSelectedSkill(null);
    setTargetMode("item");
    setMenu("targets");
  };

  const toggleTarget = (id: string) => {
    if (targetMode === "attack") {
      onAct({ type: "Attack", targets: [id] });
      reset();
      return;
    }

    // single vs multi/cleave
    const tag = (selectedSkill?.tag || selectedItem?.tag || "single");
    if (tag === "single") {
      setTargetIds([id]);
    } else {
      setTargetIds(prev => prev.includes(id) ? prev.filter(x=>x!==id) : [...prev, id]);
    }
  };

  const confirmTargets = () => {
    if (targetMode === "attack") {
      if (targetIds.length) {
        onAct({ type: "Attack", targets: targetIds });
      }
      reset();
      return;
    }
    if (selectedSkill) { onAct({ type: "Skill", id: selectedSkill.id, targets: targetIds }); }
    else if (selectedItem) { onAct({ type: "Item", id: selectedItem.id, targets: targetIds }); }
    else { onAct({ type: "Attack", targets: targetIds }); }
    reset();
  };

  /* ------------------------- render ------------------------- */
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
          {targetMode !== "attack" ? (
            <div className="cmd-row" style={{gridTemplateColumns:"1fr 1fr"}}>
              <button className="btn" onClick={confirmTargets} disabled={targetIds.length===0}>Confirm</button>
              <button className="btn" onClick={reset}>Back</button>
            </div>
          ) : (
            <div style={{ marginTop: 8, display: "flex", justifyContent: "flex-end" }}>
              <button className="btn btn--ghost" onClick={reset}>Cancel</button>
            </div>
          )}
        </div>
      )}
    </>
  );
}
