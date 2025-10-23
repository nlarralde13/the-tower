"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { TOWERS } from "@/game/rulesets";

export default function Home() {
  const router = useRouter();
  const towers = useMemo(() => TOWERS, []);
  const [towerId, setTowerId] = useState(towers[0].id);

  return (
    <main className="min-h-dvh grid place-items-center p-6">
      <div className="w-full max-w-lg text-center space-y-6">
        <h1 className="text-4xl font-bold tracking-tight">The Tower</h1>
        <p className="text-zinc-300">
          Choose thy doom. Monty-Python-approved, warranty denied.
        </p>

        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 space-y-3">
          <label className="block text-sm text-zinc-400 mb-1">Select a Tower</label>
          <select
            value={towerId}
            onChange={(e) => setTowerId(e.target.value)}
            className="w-full rounded-md bg-zinc-800 border border-zinc-700 px-3 py-2"
          >
            {towers.map(t => (
              <option key={t.id} value={t.id}>
                {t.name} — {t.tagline}
              </option>
            ))}
          </select>

          <button
            onClick={() => router.push(`/play?tower=${encodeURIComponent(towerId)}`)}
            className="mt-2 inline-block rounded-md bg-zinc-200 px-4 py-2 font-medium text-zinc-900 hover:bg-white"
          >
            Start Run
          </button>
        </div>

        <p className="text-xs text-zinc-500">
          Tip: Early towers are 3–7 floors. Later towers climb to 250. Bring a shrubbery.
        </p>
      </div>
    </main>
  );
}
