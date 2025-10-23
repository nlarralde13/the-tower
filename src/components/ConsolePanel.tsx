"use client";

import { useEffect, useRef, useState } from "react";
import { getSnapshot, describeCurrentRoom, moveDir } from "@/game/engine";
import { parseCommand } from "@/game/commands";

type Line = { ts: number; text: string };

export default function ConsolePanel({ maxLines = 5 }: { maxLines?: number }) {
  const [history, setHistory] = useState<Line[]>([]);
  const [value, setValue] = useState("");
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const LINE_H = 20; // px (roughly text-sm line-height)

  // Seed initial lines when mounted
  useEffect(() => {
    const snap = getSnapshot?.();
    const init: Line[] = [];

    if (snap?.log?.length) init.push(...snap.log);
    if (snap) {
      init.push({ ts: Date.now(), text: describeCurrentRoom() });
    } else {
      init.push({
        ts: Date.now(),
        text:
          "You awaken to the sound of scaffolding. (Engine warming up — try 'look' in a second.)",
      });
    }
    init.push({
      ts: Date.now(),
      text: "Commands: look | move <left/right/up/down> | help",
    });

    setHistory(init);
  }, []);

  // Auto-scroll to bottom on changes
  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
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
      push("Try: look | move left | move right | up | down");
      return;
    }

    if (!snap) {
      if (parsed.type === "look") {
        push("The room coyly refuses to be perceived. Give it a heartbeat.");
      } else {
        push("The Tower clears its throat. (Run not started yet.)");
      }
      return;
    }

    if (parsed.type === "look") {
      push(describeCurrentRoom());
      return;
    }
    if (parsed.type === "move") {
      const res = moveDir(parsed.dir);
      push(res);
      return;
    }
    push("The Tower blinks slowly, unamused. (Unknown command)");
  }

  return (
    <div className="flex flex-col">
      <div
        ref={scrollRef}
        className="rounded-md border border-zinc-800 bg-zinc-950/70 backdrop-blur px-3 py-2 overflow-auto"
        style={{ height: `${LINE_H * maxLines + 8}px` }} // 5 lines + a smidge of padding
      >
        {history.map((l, i) => (
          <p key={i} className="text-sm text-zinc-200 leading-5 whitespace-pre-wrap">
            {l.text}
          </p>
        ))}
      </div>

      <form onSubmit={onSubmit} className="mt-2 flex gap-2">
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Type a command… e.g., look / move left"
          className="flex-1 rounded-md bg-zinc-900 border border-zinc-700 px-3 py-2 text-sm outline-none focus:border-zinc-400"
        />
        <button
          type="submit"
          className="rounded-md bg-zinc-200 px-4 py-2 text-zinc-900 text-sm font-medium hover:bg-white"
        >
          Enter
        </button>
      </form>
    </div>
  );
}
