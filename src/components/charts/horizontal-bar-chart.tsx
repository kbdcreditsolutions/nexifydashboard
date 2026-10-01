"use client";

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatUSDCompact } from "@/lib/format";
import { CurrencyTooltip } from "./tooltip-content";

const PALETTE = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

export interface NamedAmount {
  name: string;
  value: number;
}

export function HorizontalBarChart({ data, seriesName = "Amount", singleHue = false }: { data: NamedAmount[]; seriesName?: string; singleHue?: boolean }) {
  const height = Math.max(180, data.length * 36);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 4, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border)" />
        <XAxis type="number" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickFormatter={(v) => formatUSDCompact(v)} />
        <YAxis type="category" dataKey="name" tickLine={false} axisLine={false} width={140} tick={{ fontSize: 12, fill: "var(--foreground)" }} />
        <Tooltip content={<CurrencyTooltip />} cursor={{ fill: "var(--accent)" }} />
        <Bar dataKey="value" name={seriesName} radius={[0, 3, 3, 0]} maxBarSize={20}>
          {data.map((d, i) => (
            <Cell key={d.name} fill={singleHue ? "var(--chart-1)" : PALETTE[i % PALETTE.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
