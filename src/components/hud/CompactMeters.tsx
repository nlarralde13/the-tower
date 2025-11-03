"use client";

import clsx from "clsx";
import styles from "./CompactMeters.module.css";

export type GaugeValue = {
  label: string;
  icon: string;
  current: number;
  max: number;
  color?: string;
};

export type CompactMeterGroupProps = {
  meters: GaugeValue[];
  className?: string;
};

function pct(current: number, max: number) {
  const safeMax = Math.max(1, max || 0);
  const clamped = Math.max(0, Math.min(current || 0, safeMax));
  return clamped / safeMax;
}

export default function CompactMeterGroup({ meters, className }: CompactMeterGroupProps) {
  return (
    <div className={clsx(styles.root, className)}>
      <div className={styles.group} role="group" aria-label="Character resources">
        {meters.map((meter) => (
          <MeterRow key={meter.label} meter={meter} />
        ))}
      </div>
    </div>
  );
}

function MeterRow({ meter }: { meter: GaugeValue }) {
  const ratio = pct(meter.current, meter.max);
  const percent = Math.round(ratio * 100);
  const value = `${meter.current}/${meter.max}`;

  return (
    <div className={styles.meterRow}>
      <span className={styles.iconCell} aria-hidden>
        {meter.icon}
      </span>
      <div className={styles.meterShell} role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
        <div className={styles.meterHeader}>
          <span className={styles.label}>{meter.label}</span>
        </div>
        <div className={styles.fill} style={{ transform: `scaleX(${ratio})`, ["--meter-color" as const]: meter.color ?? "" }} />
        <div className={styles.value}>{value}</div>
      </div>
    </div>
  );
}
