import { formatUSD, formatPercent } from "@/lib/format";
import type { CompanyPL } from "@/lib/calc";

const REVENUE_TYPE_LABELS: Record<string, string> = {
  HOURLY: "Hourly Revenue",
  FIXED_PROJECT: "Project Revenue",
  RETAINER: "Retainer Revenue",
  MILESTONE: "Milestone Revenue",
  RECURRING: "Recurring Revenue",
  ONE_TIME_CONSULTING: "One-Time Consulting",
  OTHER: "Other Revenue",
};

function Row({ label, value, bold, indent }: { label: string; value: string; bold?: boolean; indent?: boolean }) {
  return (
    <div className={`flex justify-between py-1 ${bold ? "font-semibold border-t border-border mt-1 pt-2" : ""} ${indent ? "pl-4 text-muted-foreground" : ""}`}>
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

export function PnlStatement({ pl, label }: { pl: CompanyPL; label: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-6 text-sm max-w-xl print:border-0 print:shadow-none">
      <div className="mb-4">
        <h3 className="text-base font-semibold">Nexify InfoSystems — Management P&amp;L</h3>
        <p className="text-muted-foreground">{label}</p>
      </div>

      <div className="space-y-0.5">
        <p className="font-semibold text-xs uppercase tracking-wide text-muted-foreground mt-2">Revenue</p>
        {Object.entries(pl.revenueByType).map(([type, amt]) => (
          <Row key={type} label={REVENUE_TYPE_LABELS[type] ?? type} value={formatUSD(amt)} indent />
        ))}
        <Row label="Total Revenue" value={formatUSD(pl.totalRevenue)} bold />

        <p className="font-semibold text-xs uppercase tracking-wide text-muted-foreground mt-4">Direct Costs</p>
        <Row label="Employee Costs" value={formatUSD(pl.employeeCosts)} indent />
        <Row label="Contractor Costs" value={formatUSD(pl.contractorCosts)} indent />
        <Row label="Direct Project Expenses" value={formatUSD(pl.directProjectExpenses)} indent />
        <Row label="Total Direct Costs" value={formatUSD(pl.totalDirectCosts)} bold />

        <Row label="Gross Profit" value={formatUSD(pl.grossProfit)} bold />
        <Row label="Gross Margin" value={formatPercent(pl.grossMarginPct)} indent />

        <p className="font-semibold text-xs uppercase tracking-wide text-muted-foreground mt-4">Operating Expenses</p>
        {Object.entries(pl.opexByCategory).map(([cat, amt]) => (
          <Row key={cat} label={cat} value={formatUSD(amt)} indent />
        ))}
        <Row label="Total Operating Expenses" value={formatUSD(pl.totalOpex)} bold />

        <Row label="Operating Profit" value={formatUSD(pl.operatingProfit)} bold />

        <p className="font-semibold text-xs uppercase tracking-wide text-muted-foreground mt-4">Other Costs</p>
        <Row label="Interest, Financial &amp; Other" value={formatUSD(pl.otherCosts)} indent />

        <Row label="Net Profit" value={formatUSD(pl.netProfit)} bold />
        <Row label="Net Margin" value={formatPercent(pl.netMarginPct)} indent />
      </div>
    </div>
  );
}
