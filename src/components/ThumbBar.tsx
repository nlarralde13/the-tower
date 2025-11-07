"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import styles from "./ThumbBar.module.css";

type Direction = "north" | "south" | "west" | "east";

type ThumbBarProps = {
  onMove: (dir: Direction) => void;
  onInspect?: () => void;
  onAttack?: () => void;
  onSkill?: () => void;
  onItem?: () => void;
  onDefend?: () => void;
  onFlee?: () => void;
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
  onInspect,
  onAttack,
  onSkill,
  onItem,
  onDefend,
  onFlee,
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
  const [confirmingFlee, setConfirmingFlee] = useState(false);
  const fleeTimerRef = useRef<number | null>(null);

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

  const handleInspect = useCallback(() => {
    if (disabled) return;
    onInspect?.();
  }, [disabled, onInspect]);

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

  const resetFleeConfirm = useCallback(() => {
    if (fleeTimerRef.current) {
      window.clearTimeout(fleeTimerRef.current);
      fleeTimerRef.current = null;
    }
    setConfirmingFlee(false);
  }, []);

  const executeFlee = useCallback(() => {
    if (disabled || !onFlee) return;
    resetFleeConfirm();
    onFlee();
  }, [disabled, onFlee, resetFleeConfirm]);

  const handleFleeRequest = useCallback(() => {
    if (disabled || !onFlee) return;
    if (!confirmingFlee) {
      setConfirmingFlee(true);
      if (fleeTimerRef.current) window.clearTimeout(fleeTimerRef.current);
      fleeTimerRef.current = window.setTimeout(() => {
        setConfirmingFlee(false);
        fleeTimerRef.current = null;
      }, 3500);
      return;
    }
  }, [disabled, onFlee, confirmingFlee]);

  useEffect(() => {
    if (!confirmingFlee) return () => {};
    return () => {
      if (fleeTimerRef.current) {
        window.clearTimeout(fleeTimerRef.current);
        fleeTimerRef.current = null;
      }
    };
  }, [confirmingFlee]);

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
        <div className={styles.headerActions}>
          <MiniActionButton
            label="Inspect"
            ariaLabel="Inspect surroundings"
            onClick={handleInspect}
            disabled={disabled || !onInspect}
          />
          <div className={styles.fleeWrapper}>
            <MiniActionButton
              label="Flee"
              ariaLabel="Flee the encounter"
              onClick={handleFleeRequest}
              disabled={disabled || !onFlee}
              danger
            />
            {confirmingFlee && (
              <div className={styles.fleeConfirm} role="status" aria-live="polite">
                <span className={styles.fleeConfirmLabel}>End run and return to town?</span>
                <div className={styles.fleeConfirmActions}>
                  <button type="button" onClick={executeFlee} className={styles.confirmButton} disabled={disabled || !onFlee}>
                    Yes
                  </button>
                  <button type="button" onClick={resetFleeConfirm} className={styles.cancelButton}>
                    No
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

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
          ) : null}
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

function MiniActionButton({
  label,
  ariaLabel,
  onClick,
  disabled,
  danger,
}: {
  label: string;
  ariaLabel: string;
  onClick?: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      className={`${styles.miniButton} ${danger ? styles.miniButtonDanger : ""}`}
      aria-label={ariaLabel}
      onClick={() => {
        if (disabled) return;
        onClick?.();
      }}
      disabled={disabled}
    >
      {label}
    </button>
  );
}
