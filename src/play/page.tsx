import dynamic from "next/dynamic";

const GameViewport = dynamic(() => import("@/components/GameViewer"), { ssr: false });

export default function Play({ searchParams }: { searchParams: { tower?: string } }) {
  const towerId = searchParams?.tower ?? "tower-1";
  return (
    <main className="mx-auto max-w-6xl p-4 grid grid-cols-[minmax(640px,1fr)_320px] gap-4">
      <section className="aspect-square">
        <GameViewport />
      </section>
      <aside className="space-y-3">
        <div className="rounded-lg border border-zinc-800 p-3">
          <h2 className="font-semibold mb-2">HUD</h2>
          <ul className="text-sm text-zinc-300 space-y-1">
            <li>HP/MP</li>
            <li>Floor</li>
            <li>Inventory</li>
          </ul>
        </div>
        <div className="rounded-lg border border-zinc-800 p-3">
          <h2 className="font-semibold mb-2">Log</h2>
          <p className="text-sm text-zinc-400">You arrive at Floor 1… mind the void.</p>
        </div>
      </aside>
    </main>
  );
}
