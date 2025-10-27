"use client";

import { useEffect, useRef, useState } from "react";
import { getSnapshot, describeCurrentRoom, moveDir } from "@/game/engine";
import { parseCommand } from "@/game/commands";

type Line = { ts: number; text: string };

export default function ConsolePanel({ maxLines = 5 }: { maxLines?: number }) {
  const [history, setHistory] = useState<Line[]>([]);
  const [value, setValue] = useState("");
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const LINE_H = 22; // px

  useEffect(() => {
    const snap = getSnapshot?.();
    const init: Line[] = [];

    if (snap?.log?.length) init.push(...snap.log);
    init.push({
      ts: Date.now(),
      text: snap
        ? "You arrive at Floor 1. Try 'look'."
        : "You awaken to the sound of scaffolding. (Engine warming up — try 'look' in a second.)",
    });
    init.push({
      ts: Date.now(),
      text: "Commands: look | move <left/right/up/down> | help",
    });

    setHistory(init);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [history]);

  function push(text: string) {
    setHistory((h) => [...h, { ts: Date.now(), text }]);
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const input = value.trim();
    if (!input) return;
    push("> " + input);
    setValue("");

    const snap = getSnapshot?.();
    const parsed = parseCommand(input);

    if (parsed.type === "help") {
      push("Try: look | move left/right/up/down");
      return;
    }
    if (!snap) {
      push("The Tower clears its throat. (Run not started yet.)");
      return;
    }

    if (parsed.type === "look") {
      push(describeCurrentRoom());
      return;
    }
    if (parsed.type === "move") {
      push(moveDir(parsed.dir));
      return;
    }
    push("The Tower blinks slowly, unamused. (Unknown command)");
  }

  return (
    <div className="tower-console-panel">
      <div
        ref={scrollRef}
        className="tower-console-log"
        style={{ height: `${LINE_H * maxLines + 8}px` }}
      >
        {history.map((l, i) => (
          <p key={i} className="tower-console-line">
            {l.text}
          </p>
        ))}
      </div>

      <form onSubmit={onSubmit} className="tower-console-form">
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Type a command… e.g., look / move left"
          className="tower-input"
        />
        <button type="submit" className="tower-btn">
          Enter
        </button>
      </form>
    </div>
  );
}
