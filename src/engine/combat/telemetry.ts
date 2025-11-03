import type {
  StatusInstance,
  TelemetryBus,
  TelemetryRecord,
} from "@/engine/combat/types";

const push = (bus: TelemetryBus, record: TelemetryRecord) => {
  bus.push(record);
};

export function logAction(
  bus: TelemetryBus,
  payload: Record<string, unknown>
) {
  push(bus, { type: "action", payload });
}

export function logStatusApply(
  bus: TelemetryBus,
  payload: Record<string, unknown>
) {
  push(bus, { type: "status-apply", payload });
}

export function logTick(
  bus: TelemetryBus,
  status: StatusInstance,
  payload: Record<string, unknown>
) {
  push(bus, {
    type: "status-tick",
    payload: { statusId: status.statusId, ...payload },
  });
}

export function logExpire(
  bus: TelemetryBus,
  status: StatusInstance,
  payload: Record<string, unknown> = {}
) {
  push(bus, {
    type: "status-expire",
    payload: { statusId: status.statusId, ...payload },
  });
}

export function logInitiative(
  bus: TelemetryBus,
  payload: { player: number; enemy: number; first: "player" | "enemy" }
) {
  push(bus, {
    type: "initiative",
    payload,
  });
}
