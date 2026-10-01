"use client";

import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatUSDCompact } from "@/lib/format";
import { CurrencyTooltip } from "./tooltip-content";

export interface ProfitPoint {
  label: string;
  grossProfit: number;
  netProfit: number;
}

export function ProfitTrendChart({ data }: { data: ProfitPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
        <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickFormatter={(v) => formatUSDCompact(v)} width={56} />
        <Tooltip content={<CurrencyTooltip />} />
        <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" iconSize={8} />
        <Line type="monotone" dataKey="grossProfit" name="Gross Profit" stroke="var(--chart-1)" strokeWidth={2} dot={{ r: 3 }} />
        <Line type="monotone" dataKey="netProfit" name="Net Profit" stroke="var(--chart-3)" strokeWidth={2} dot={{ r: 3 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}
