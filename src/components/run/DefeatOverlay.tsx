"use client";

type DefeatOverlayProps = {
  onEndRun: () => void;
};

export function DefeatOverlay({ onEndRun }: DefeatOverlayProps) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Defeat summary"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(10,4,18,0.85)",
        backdropFilter: "blur(8px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        zIndex: 40,
      }}
    >
      <div
        style={{
          width: "min(420px, 100%)",
          borderRadius: 20,
          border: "1px solid rgba(244,114,182,0.35)",
          background: "linear-gradient(180deg, rgba(45,9,30,0.95), rgba(18,8,24,0.92))",
          boxShadow: "0 36px 80px rgba(0,0,0,0.55)",
          padding: "28px 32px",
          display: "grid",
          gap: 18,
          textAlign: "center",
          color: "#fdf4ff",
        }}
      >
        <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: 0.4 }}>
          You have been defeated.
        </div>
        <div style={{ fontSize: 15, color: "rgba(255,241,242,0.85)", lineHeight: 1.5 }}>
          A piece of your soul lingers.
        </div>
        <button
          onClick={onEndRun}
          className="btn btn--primary"
          style={{
            minHeight: 48,
            borderRadius: 999,
            fontSize: 15,
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: 0.12,
          }}
          aria-label="End run and return home"
        >
          End Run
        </button>
      </div>
    </div>
  );
}

