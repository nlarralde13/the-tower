// app/settings/page.tsx
"use client";

import { useEffect, useState } from "react";

function usePersistedFlag(key: string, def = false) {
  const [v, setV] = useState(def);
  useEffect(() => {
    const raw = localStorage.getItem(key);
    setV(raw === "1");
  }, [key]);
  useEffect(() => {
    localStorage.setItem(key, v ? "1" : "0");
  }, [key, v]);
  return [v, setV] as const;
}

export default function SettingsPage() {
  const [crt, setCRT] = usePersistedFlag("pref:crt");
  const [hc, setHC] = usePersistedFlag("pref:hc");
  const [bigText, setBigText] = usePersistedFlag("pref:textlg");

  useEffect(() => {
    const root = document.documentElement;
    if (crt) root.setAttribute("data-crt", "on");
    else root.removeAttribute("data-crt");

    root.toggleAttribute("data-hc", hc);
    root.toggleAttribute("data-bigtext", bigText);
  }, [crt, hc, bigText]);

  return (
    <main style={{ padding: "16px 20px", maxWidth: 720, margin: "0 auto" }}>
      <h1>Settings</h1>
      <div style={{ display: "grid", gap: 16, marginTop: 12 }}>
        <label style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <input type="checkbox" checked={crt} onChange={(e) => setCRT(e.target.checked)} /> CRT filter
        </label>
        <label style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <input type="checkbox" checked={hc} onChange={(e) => setHC(e.target.checked)} /> High contrast
        </label>
        <label style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <input type="checkbox" checked={bigText} onChange={(e) => setBigText(e.target.checked)} /> Larger text
        </label>
      </div>
    </main>
  );
}
