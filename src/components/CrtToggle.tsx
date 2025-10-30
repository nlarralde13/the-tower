"use client";
import { useEffect, useState } from "react";

export default function CrtToggle() {
  const [on, setOn] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem("crt") ?? "on";
    const enable = saved !== "off";
    setOn(enable);
    document.documentElement.classList.toggle("crt", enable);
  }, []);

  function toggle() {
    const next = !on;
    setOn(next);
    document.documentElement.classList.toggle("crt", next);
    localStorage.setItem("crt", next ? "on" : "off");
  }

  return (
    <button className="topbar__button" onClick={toggle} title="Toggle CRT mode">
      {on ? "CRT: On" : "CRT: Off"}
    </button>
  );
}

