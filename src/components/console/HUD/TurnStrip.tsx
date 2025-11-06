"use client";
import React from "react";

type Props = {
  order: string[];
  activeId?: string;
  labelFor: (id: string) => string;
};

export default function TurnStrip({ order, activeId, labelFor }: Props) {
  if (!order?.length) return null;
  return (
    <div className="turn-strip" role="list" aria-label="Turn order">
      {order.map((id) => (
        <div
          key={id}
          role="listitem"
          className="turn-chip"
          aria-current={id === activeId ? "true" : undefined}
          title={labelFor(id)}
        >
          {labelFor(id)}
        </div>
      ))}
    </div>
  );
}
