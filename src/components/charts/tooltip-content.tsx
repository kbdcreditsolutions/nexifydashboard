"use client";

import { formatUSD } from "@/lib/format";

export function CurrencyTooltip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-border bg-popover px-3 py-2 shadow-sm text-xs">
      {label && <div className="font-medium text-popover-foreground mb-1">{label}</div>}
      {payload.map((p, i) => (
        <div key={`${p.name}-${i}`} className="flex items-center gap-2 justify-between">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
            {p.name}
          </span>
          <span className="font-medium tabular-nums text-popover-foreground">{formatUSD(p.value)}</span>
        </div>
      ))}
    </div>
  );
}
