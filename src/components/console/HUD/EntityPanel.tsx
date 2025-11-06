import { useMemo, useId } from "react";

type PanelSide = "left" | "right";
type StatusTone = "buff" | "debuff" | "neutral";

export interface EntityStatusChip {
  id: string;
  label: string;
  tone?: StatusTone;
}

export interface EntityPanelProps {
  side: PanelSide;
  name: string;
  hp: number;
  hpMax: number;
  mp?: number;
  mpMax?: number;
  sta?: number;
  staMax?: number;
  statuses?: EntityStatusChip[];
  isKO?: boolean;
  regionLabel: string;
}

interface MeterDescriptor {
  label: string;
  variant: "hp" | "mp" | "sta";
  value: number;
  ceiling: number;
}

interface MeterViewModel extends MeterDescriptor {
  displayValue: number;
  displayCeiling: number;
  percent: number;
  ariaLabel: string;
}

const MAX_STATUS_CHIPS = 5;

export default function EntityPanel({
  side,
  name,
  hp,
  hpMax,
  mp,
  mpMax,
  sta,
  staMax,
  statuses = [],
  isKO = hp <= 0,
  regionLabel,
}: EntityPanelProps) {
  const nameId = useId();
  const meters = useMemo(() => {
    const list: MeterDescriptor[] = [
      { label: "HP", variant: "hp", value: hp, ceiling: hpMax },
    ];

    if (typeof mpMax === "number" && mpMax > 0) {
      list.push({
        label: "MP",
        variant: "mp",
        value: mp ?? 0,
        ceiling: mpMax,
      });
    }

    if (typeof staMax === "number" && staMax > 0) {
      list.push({
        label: "STA",
        variant: "sta",
        value: sta ?? 0,
        ceiling: staMax,
      });
    }

    return list.map(toMeterViewModel);
  }, [hp, hpMax, mp, mpMax, sta, staMax]);

  const { visibleStatuses, overflowCount, overflowTitle } = useMemo(() => {
    if (!statuses.length) {
      return {
        visibleStatuses: [] as EntityStatusChip[],
        overflowCount: 0,
        overflowTitle: "",
      };
    }

    const limit = Math.max(1, MAX_STATUS_CHIPS);
    if (statuses.length <= limit) {
      return {
        visibleStatuses: statuses.slice(0, limit),
        overflowCount: 0,
        overflowTitle: "",
      };
    }

    const sliceCount = Math.max(1, limit - 1);
    const visibleStatuses = statuses.slice(0, sliceCount);
    const hiddenStatuses = statuses.slice(sliceCount);
    const title = hiddenStatuses.map((status) => status.label).join(", ");

    return {
      visibleStatuses,
      overflowCount: hiddenStatuses.length,
      overflowTitle: title,
    };
  }, [statuses]);

  return (
    <section
      className={`entity-panel entity-panel--${side}${isKO ? " entity-panel--ko" : ""}`}
      role="region"
      aria-label={regionLabel}
      aria-labelledby={nameId}
    >
      <header className="entity-name" id={nameId}>
        <span>{name}</span>
        {isKO ? (
          <span className="entity-ko-badge" aria-label="Knocked out" title="Knocked out">
            KO
          </span>
        ) : null}
      </header>

      <div className="entity-meters" role="group" aria-label={`${name} resources`}>
        {meters.map((meter) => (
          <div className={`entity-meter entity-meter--${meter.variant}`} key={meter.variant}>
            <span className="entity-meter__label" aria-hidden="true">
              {meter.label}
            </span>
            <div
              className="entity-meter__track"
              role="progressbar"
              aria-valuemin={0}
              aria-valuenow={meter.displayValue}
              aria-valuemax={meter.displayCeiling}
              aria-label={meter.ariaLabel}
            >
              <i style={{ width: `${meter.percent}%` }} />
            </div>
            <span className="entity-meter__value" aria-hidden="true">
              {meter.displayValue}/{meter.displayCeiling}
            </span>
          </div>
        ))}
      </div>

      <div className="entity-statuses">
        {visibleStatuses.length ? (
          <>
            {visibleStatuses.map((status) => (
              <span
                key={status.id}
                className={`status-chip${status.tone ? ` status-chip--${status.tone}` : ""}`}
                aria-label={status.label}
                title={status.label}
              >
                {status.label}
              </span>
            ))}
            {overflowCount > 0 ? (
              <span
                className="status-chip status-chip--overflow"
                aria-label={`${overflowCount} more statuses: ${overflowTitle}`}
                title={overflowTitle}
              >
                +{overflowCount}
              </span>
            ) : null}
          </>
        ) : (
          <span className="status-chip status-chip--empty" aria-label="No active statuses">
            Ready
          </span>
        )}
      </div>
    </section>
  );
}

function toMeterViewModel(descriptor: MeterDescriptor): MeterViewModel {
  const ceiling = Math.max(1, Math.round(descriptor.ceiling ?? 0));
  const value = Math.round(descriptor.value ?? 0);
  const clampedValue = clamp(value, 0, ceiling);
  const percent = Math.round((clampedValue / ceiling) * 100);

  return {
    ...descriptor,
    displayValue: clampedValue,
    displayCeiling: ceiling,
    percent,
    ariaLabel: `${descriptor.label} ${clampedValue} of ${ceiling}`,
  };
}

function clamp(value: number, min: number, max: number) {
  if (Number.isNaN(value)) return min;
  return Math.min(Math.max(value, min), max);
}
