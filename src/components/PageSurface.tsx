"use client";

import React from "react";
import clsx from "clsx";

interface PageSurfaceProps {
  /** Image path or gradient to use as the page background */
  backgroundImage?: string;
  /** Optional overlay tint (linear-gradient, rgba, etc.) */
  overlay?: string;
  /** If true, fills the entire viewport (use for login / splash pages) */
  full?: boolean;
  /** Additional classes */
  className?: string;
  children: React.ReactNode;
}

/**
 * PageSurface
 * ----------
 * Unified wrapper for scenes and menus.
 * - Sets --page-background / --page-overlay for CSS to consume
 * - Provides min-height and layout helpers
 * - Plays nicely with global CRT effects and TopBar
 */
export default function PageSurface({
  backgroundImage,
  overlay,
  full = false,
  className,
  children,
}: PageSurfaceProps) {
  const style: React.CSSProperties = {};

  if (backgroundImage) {
    // Pass to CSS as variable so :before can render it
    style["--page-background" as any] = `url(${backgroundImage})`;
  }
  if (overlay) {
    style["--page-overlay" as any] = overlay;
  }

  return (
    <div
      className={clsx("page", full && "page--full", className)}
      style={style}
    >
      {children}
    </div>
  );
}
