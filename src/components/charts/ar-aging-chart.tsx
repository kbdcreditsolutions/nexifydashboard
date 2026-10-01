"use client";

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatUSDCompact } from "@/lib/format";
import { CurrencyTooltip } from "./tooltip-content";
import type { ARBucket } from "@/lib/calc";

const BUCKET_COLORS: Record<string, string> = {
  Current: "var(--positive)",
  "1-30 Days": "var(--chart-1)",
  "31-60 Days": "var(--warning)",
  "61-90 Days": "var(--serious)",
  "90+ Days": "var(--negative)",
};

export function ARAgingChart({ summary }: { summary: ARBucket }) {
  const data = [
    { name: "Current", value: summary.current },
    { name: "1-30 Days", value: summary.d1_30 },
    { name: "31-60 Days", value: summary.d31_60 },
    { name: "61-90 Days", value: summary.d61_90 },
    { name: "90+ Days", value: summary.d90plus },
  ];
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
        <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
        <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickFormatter={(v) => formatUSDCompact(v)} width={56} />
        <Tooltip content={<CurrencyTooltip />} cursor={{ fill: "var(--accent)" }} />
        <Bar dataKey="value" name="Outstanding" radius={[3, 3, 0, 0]} maxBarSize={56}>
          {data.map((d) => (
            <Cell key={d.name} fill={BUCKET_COLORS[d.name]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
