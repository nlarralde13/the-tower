"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import clsx from "clsx";
import styles from "./SlideDrawer.module.css";

type DrawerSide = "left" | "right" | "bottom";

type SlideDrawerProps = {
  /** Unique id; also used by the toggle trigger attribute: data-drawer-toggle="<id>" */
  id: string;
  side: DrawerSide;

  /** Controlled mode: pass open + onClose (unchanged from your current API) */
  open?: boolean;
  onClose?: () => void;

  /** Uncontrolled toggle mode: if `open` not provided, we manage state internally */
  defaultOpen?: boolean;
  onOpenChange?: (next: boolean) => void;

  children: React.ReactNode;
  labelledBy?: string;
  className?: string;
  variant?: "default" | "journal";

  /** If true (default), clicking the backdrop closes the drawer */
  closeOnBackdrop?: boolean;
};

export default function SlideDrawer({
  id,
  side,
  open,
  onClose,
  defaultOpen = false,
  onOpenChange,
  children,
  labelledBy,
  className,
  variant = "default",
  closeOnBackdrop = true,
}: SlideDrawerProps) {
  const [mounted, setMounted] = useState(false);
  const [uOpen, setUOpen] = useState(defaultOpen);
  const panelRef = useRef<HTMLDivElement | null>(null);

  // Support both controlled and uncontrolled usage transparently
  const isControlled = typeof open === "boolean";
  const isOpen = isControlled ? (open as boolean) : uOpen;

  const setOpen = (next: boolean) => {
    if (isControlled) {
      onOpenChange?.(next);
      if (!next) onClose?.();
    } else {
      setUOpen(next);
      onOpenChange?.(next);
    }
  };

  const toggle = () => setOpen(!isOpen);
  const close = () => setOpen(false);

  useEffect(() => setMounted(true), []);

  // Escape to close
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        close();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen]);

  // Focus management on open
  useEffect(() => {
    if (!isOpen || !panelRef.current) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const focusable = panelRef.current.querySelector<HTMLElement>(
      "button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])"
    );
    focusable?.focus();
    return () => previouslyFocused?.focus();
  }, [isOpen]);

  // Global click-to-toggle: any element with data-drawer-toggle="<id>"
  useEffect(() => {
    const handler = (ev: MouseEvent) => {
      const target = ev.target as HTMLElement | null;
      if (!target) return;
      const el = target.closest<HTMLElement>("[data-drawer-toggle]");
      if (el && el.dataset.drawerToggle === id) {
        ev.preventDefault();
        toggle();
      }
    };
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [id, isOpen]);

  // Optional: basic body scroll lock while a drawer is open
  useEffect(() => {
    if (!isOpen) return;
    const { overflow, paddingRight } = document.body.style;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = "hidden";
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }
    return () => {
      document.body.style.overflow = overflow;
      document.body.style.paddingRight = paddingRight;
    };
  }, [isOpen]);

  if (!mounted) return null;

  const rootClasses = clsx(styles.root, isOpen && styles.open, className);
  const panelClasses = clsx(styles.panel, {
    [styles.panelLeft]: side === "left",
    [styles.panelRight]: side === "right",
    [styles.panelBottom]: side === "bottom",
    [styles.panelBottomJournal]: side === "bottom" && variant === "journal",
  });

  const backdropClasses = clsx(styles.backdrop, !isOpen && styles.backdropHidden);

  return createPortal(
    <div className={rootClasses} role="presentation" aria-hidden={!isOpen}>
      <div
        className={backdropClasses}
        aria-hidden="true"
        onClick={closeOnBackdrop ? close : undefined}
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
