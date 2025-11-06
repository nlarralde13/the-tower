"use client";

import { useCallback, useRef } from "react";
import styles from "./ThumbBar.module.css";

type Direction = "north" | "south" | "west" | "east";

type ThumbBarProps = {
  onMove: (dir: Direction) => void;
  onInteract?: () => void;
  onAttack?: () => void;
  onSkill?: () => void;
  onItem?: () => void;
  onDefend?: () => void;
  onBack?: () => void;
  onAscend?: () => void;
  onOpenJournal?: () => void;
  onOpenMap?: () => void;
  onOpenCharacter?: () => void;
  onLookAround?: () => void;
  showAscend?: boolean;
  mode?: "explore" | "combat";
  disabled?: boolean;
  variant?: "fixed" | "overlay";
  className?: string;
  utilityActions?: React.ReactNode;
};

export default function ThumbBar({
  onMove,
  onInteract,
  onAttack,
  onSkill,
  onItem,
  onDefend,
  onBack,
  onAscend,
  showAscend,
  onOpenJournal,
  onOpenMap,
  onOpenCharacter,
  onLookAround,
  mode = "explore",
  disabled = false,
  variant = "fixed",
  className,
  utilityActions,

}: ThumbBarProps) {
  const handleMove = useCallback(
    (dir: Direction) => {
      if (disabled) return;
      onMove(dir);
    },
    [disabled, onMove]
  );

  const handleAscend = useCallback(() => {
    if (disabled) return;
    onAscend?.();
  }, [disabled, onAscend]);

  const handleInteract = useCallback(() => {
    if (disabled) return;
    onInteract?.();
  }, [disabled, onInteract]);

  const handleAttack = useCallback(() => {
    if (disabled) return;
    onAttack?.();
  }, [disabled, onAttack]);

  const handleSkill = useCallback(() => {
    if (disabled) return;
    onSkill?.();
  }, [disabled, onSkill]);

  const handleItem = useCallback(() => {
    if (disabled) return;
    onItem?.();
  }, [disabled, onItem]);

  const handleDefend = useCallback(() => {
    if (disabled) return;
    onDefend?.();
  }, [disabled, onDefend]);

  const handleBack = useCallback(() => {
    if (disabled) return;
    onBack?.();
  }, [disabled, onBack]);

  const handleOpenJournal = useCallback(() => {
    if (disabled) return;
    onOpenJournal?.();
  }, [disabled, onOpenJournal]);

  const handleOpenMap = useCallback(() => {
    if (disabled) return;
    onOpenMap?.();
  }, [disabled, onOpenMap]);

  const handleOpenCharacter = useCallback(() => {
    if (disabled) return;
    onOpenCharacter?.();
  }, [disabled, onOpenCharacter]);

  const handleLookAround = useCallback(() => {
    if (disabled) return;
    onLookAround?.();
  }, [disabled, onLookAround]);

  return (
    <div
      className={[
        styles.container,
        variant === "overlay" ? styles.overlay : "",
        className ?? ""
      ].join(" ")}
      role="group"
      aria-label="Movement and actions"
    >
      {(utilityActions || onOpenJournal || onOpenMap || onOpenCharacter || onLookAround) && (
        <div className={styles.utilityRow} role="group" aria-label="Utility actions">
          {utilityActions ?? (
            <>
              <button className={styles.button} onClick={handleOpenJournal} aria-label="Open journal">Journal</button>
              <button className={styles.button} onClick={handleOpenMap} aria-label="Open map">Map</button>
              <button className={styles.button} onClick={handleOpenCharacter} aria-label="Open character">Inventory</button>
              <button className={styles.button} onClick={handleLookAround} aria-label="Look around">Look Around</button>
            </>
          )}
        </div>
      )}


      <div className={styles.inner}>
        <div className={styles.cluster}>
          {showAscend && (
            <ActionButton
              label="Ascend"
              ariaLabel="Ascend to next floor"
              onClick={handleAscend}
              disabled={disabled}
            />
          )}
          <div className={styles.dpad} aria-label="Movement controls">
            <span />
            <ActionButton label="North" ariaLabel="Move north" onClick={() => handleMove("north")} disabled={disabled} />
            <span />
            <ActionButton label="West" ariaLabel="Move west" onClick={() => handleMove("west")} disabled={disabled} />
            <span aria-hidden className={styles.dpadCenter} />
            <ActionButton label="East" ariaLabel="Move east" onClick={() => handleMove("east")} disabled={disabled} />
            <span />
            <ActionButton label="South" ariaLabel="Move south" onClick={() => handleMove("south")} disabled={disabled} />
            <span />
          </div>
        </div>

        <div className={styles.cluster}>
          {mode === "combat" ? (
            <div className={styles.gridActions} aria-label="Combat actions">
              <ActionButton label="Attack" ariaLabel="Attack" onClick={handleAttack} disabled={disabled} onLongPress={handleAttack} />
              <ActionButton label="Skill" ariaLabel="Use skill" onClick={handleSkill} disabled={disabled} onLongPress={handleSkill} />
              <ActionButton label="Item" ariaLabel="Use item" onClick={handleItem} disabled={disabled} onLongPress={handleItem} />
              <ActionButton label="Defend" ariaLabel="Defend" onClick={handleDefend} disabled={disabled} onLongPress={handleDefend} />
            </div>
          ) : (
            <div className={styles.interact}>
              <ActionButton
                label="Interact"
                ariaLabel="Interact with the room"
                onClick={handleInteract}
                disabled={disabled}
                onLongPress={handleInteract}
              />
            </div>
          )}
          <ActionButton label="Back" ariaLabel="Go back" onClick={handleBack} disabled={disabled} />
        </div>
      </div>
    </div>
  );
}

function ActionButton({
  label,
  ariaLabel,
  onClick,
  onLongPress,
  disabled,

}: {
  label: string;
  ariaLabel: string;
  onClick?: () => void;
  onLongPress?: () => void;
  disabled?: boolean;
}) {
  const timerRef = useRef<number | null>(null);
  const didLongPressRef = useRef(false);

  const clearTimer = () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const handlePointerDown = () => {
    if (disabled || !onLongPress) return;
    didLongPressRef.current = false;
    clearTimer();
    timerRef.current = window.setTimeout(() => {
      didLongPressRef.current = true;
      onLongPress();
      clearTimer();
    }, 500);
  };

  const handlePointerUp = () => {
    clearTimer();
  };

  const handleClick = () => {
    if (disabled) return;
    if (didLongPressRef.current) {
      didLongPressRef.current = false;
      return;
    }
    onClick?.();
  };

  return (
    <button
      type="button"
      className={styles.button}
      aria-label={ariaLabel}
      onClick={handleClick}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      onPointerCancel={handlePointerUp}
      disabled={disabled}
    >
      <span className={styles.labelPrimary}>{label}</span>
    </button>
  );
}
