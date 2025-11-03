"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import clsx from "clsx";
import styles from "./SlideDrawer.module.css";

type DrawerSide = "left" | "right" | "bottom";

type SlideDrawerProps = {
  id: string;
  side: DrawerSide;
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  labelledBy?: string;
  className?: string;
  variant?: "default" | "journal";
};

export default function SlideDrawer({
  id,
  side,
  open,
  onClose,
  children,
  labelledBy,
  className,
  variant = "default",
}: SlideDrawerProps) {
  const [mounted, setMounted] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open || !panelRef.current) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const focusable = panelRef.current.querySelector<HTMLElement>(
      "button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])"
    );
    focusable?.focus();
    return () => previouslyFocused?.focus();
  }, [open]);

  if (!mounted) return null;

  const rootClasses = clsx(styles.root, open && styles.open, className);
  const panelClasses = clsx(styles.panel, {
    [styles.panelLeft]: side === "left",
    [styles.panelRight]: side === "right",
    [styles.panelBottom]: side === "bottom",
    [styles.panelBottomJournal]: side === "bottom" && variant === "journal",
  });

  const backdropClasses = clsx(styles.backdrop, !open && styles.backdropHidden);

  return createPortal(
    <div className={rootClasses} role="presentation">
      <div
        className={backdropClasses}
        aria-hidden="true"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        id={id}
        className={panelClasses}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
      >
        {children}
      </div>
    </div>,
    document.body
  );
}
