"use client";

import { Bar, CartesianGrid, Legend, Line, ComposedChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatUSDCompact } from "@/lib/format";
import { CurrencyTooltip } from "./tooltip-content";

export interface CashFlowPoint {
  label: string;
  inflows: number;
  outflows: number;
  closingCash: number;
  projected?: boolean;
}

export function CashFlowChart({ data }: { data: CashFlowPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <ComposedChart data={data} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
        <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickFormatter={(v) => formatUSDCompact(v)} width={56} />
        <Tooltip content={<CurrencyTooltip />} cursor={{ fill: "var(--accent)" }} />
        <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" iconSize={8} />
        <Bar dataKey="inflows" name="Inflows" fill="var(--chart-3)" radius={[3, 3, 0, 0]} maxBarSize={22} />
        <Bar dataKey="outflows" name="Outflows" fill="var(--chart-2)" radius={[3, 3, 0, 0]} maxBarSize={22} />
        <Line type="monotone" dataKey="closingCash" name="Closing Cash" stroke="var(--chart-1)" strokeWidth={2} dot={{ r: 3 }} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
