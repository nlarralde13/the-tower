// src/components/Screen.tsx
export default function Screen({
  title,
  note,
}: {
  title: string;
  note?: string;
}) {
  return (
    <div className="screen center">
      <h1 className="screen__title">{title}</h1>
      {note && <p className="screen__note">{note}</p>}
    </div>
  );
}

