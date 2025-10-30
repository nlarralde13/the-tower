// src/components/Screen.tsx
export default function Screen({
  title,
  note,
}: {
  title: string;
  note?: string;
}) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-[520px] flex-col items-center justify-center p-6">
      <h1 className="mb-2 text-2xl font-semibold">{title}</h1>
      {note && <p className="opacity-70">{note}</p>}
    </main>
  );
}
