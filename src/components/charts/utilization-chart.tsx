"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatHours } from "@/lib/format";

export interface UtilizationRow {
  name: string;
  billable: number;
  nonBillable: number;
}

function HoursTooltip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-border bg-popover px-3 py-2 shadow-sm text-xs">
      <div className="font-medium text-popover-foreground mb-1">{label}</div>
      {payload.map((p, i) => (
        <div key={`${p.name}-${i}`} className="flex items-center gap-2 justify-between">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
            {p.name}
          </span>
          <span className="font-medium tabular-nums text-popover-foreground">{formatHours(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

export function UtilizationChart({ data }: { data: UtilizationRow[] }) {
  const height = Math.max(200, data.length * 34);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 4, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border)" />
        <XAxis type="number" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickFormatter={(v) => `${v}h`} />
        <YAxis type="category" dataKey="name" tickLine={false} axisLine={false} width={120} tick={{ fontSize: 12, fill: "var(--foreground)" }} />
        <Tooltip content={<HoursTooltip />} cursor={{ fill: "var(--accent)" }} />
        <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" iconSize={8} />
        <Bar dataKey="billable" name="Billable" stackId="h" fill="var(--chart-1)" radius={[0, 0, 0, 0]} maxBarSize={18} />
        <Bar dataKey="nonBillable" name="Non-Billable" stackId="h" fill="var(--border)" radius={[0, 3, 3, 0]} maxBarSize={18} />
      </BarChart>
    </ResponsiveContainer>
  );
}
