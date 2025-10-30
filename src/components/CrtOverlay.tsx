"use client";
import { useEffect, useState } from "react";

export default function CrtOverlay() {
  // Avoid SSR hydration mismatch for data-URI noise
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return <div className="crt-noise" aria-hidden />;
}
