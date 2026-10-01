import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { canViewFinancials } from "@/lib/rbac";
import { PeriodSelector } from "@/components/period-selector";
import { KpiCard } from "@/components/kpi-card";
import { ChartCard } from "@/components/charts/chart-card";
import { CashFlowChart } from "@/components/charts/cash-flow-chart";
import { CashTransactionDialog } from "@/components/cash-flow/cash-transaction-dialog";
import { actualCashBalance, cashFlowForRange, cashFlowForecast } from "@/lib/calc";
import { resolvePeriod, lastNMonths, type PeriodKey } from "@/lib/dates";
import { getSettings } from "@/lib/settings";
import { formatUSD, formatDate } from "@/lib/format";
import { Banknote, ArrowDownToLine, ArrowUpFromLine, AlertTriangle } from "lucide-react";

export default async function CashFlowPage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const session = await auth();
  if (!session?.user || !canViewFinancials(session.user.role)) redirect("/dashboard");

  const { period } = await searchParams;
  const range = resolvePeriod((period as PeriodKey) ?? "current_month");

  const [currentCash, periodFlow, forecast, settings, recentTxns] = await Promise.all([
    actualCashBalance(),
    cashFlowForRange(range),
    cashFlowForecast([30, 60, 90]),
    getSettings(),
    prisma.cashTransaction.findMany({ orderBy: { date: "desc" }, take: 20 }),
  ]);

  const months = lastNMonths(6);
  const historical = await Promise.all(months.map((m) => cashFlowForRange({ start: m.start, end: m.end, label: m.label })));
  const historicalChart = months.map((m, i) => ({ label: m.label, inflows: historical[i].inflows, outflows: historical[i].outflows, closingCash: historical[i].closingCash }));
  const forecastChart = forecast.map((f) => ({ label: `+${f.days}d (Proj.)`, inflows: f.expectedInflows, outflows: f.expectedOutflows, closingCash: f.projectedCash }));
  const chartData = [...historicalChart, ...forecastChart];

  const cashMinThreshold = Number(settings.cashMinThreshold);
  const belowThreshold = currentCash < cashMinThreshold;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Cash Flow</h2>
          <p className="text-sm text-muted-foreground">Actual cash position and 30/60/90-day projection</p>
        </div>
        <div className="flex items-center gap-2">
          <PeriodSelector />
          <CashTransactionDialog />
        </div>
      </div>

      {belowThreshold && (
        <div className="rounded-lg border border-negative/30 bg-negative/10 px-3.5 py-2.5 text-sm text-red-800 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4" />
          Cash balance ({formatUSD(currentCash)}) is below the configured minimum threshold of {formatUSD(cashMinThreshold)}
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard label="Current Cash" value={formatUSD(currentCash)} icon={Banknote} />
        <KpiCard label={`Inflows — ${range.label}`} value={formatUSD(periodFlow.inflows)} icon={ArrowDownToLine} />
        <KpiCard label={`Outflows — ${range.label}`} value={formatUSD(periodFlow.outflows)} icon={ArrowUpFromLine} />
        <KpiCard label="Closing Cash" value={formatUSD(periodFlow.closingCash)} icon={Banknote} />
      </div>

      <section className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {forecast.map((f) => (
          <div key={f.days} className="rounded-lg border border-border bg-card p-4 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{f.days}-Day Projection</p>
            <dl className="space-y-1 text-sm">
              <div className="flex justify-between"><dt className="text-muted-foreground">Current Cash</dt><dd className="tabular-nums">{formatUSD(f.currentCash)}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Expected Inflows</dt><dd className="tabular-nums text-positive">+{formatUSD(f.expectedInflows)}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Expected Outflows</dt><dd className="tabular-nums text-negative">-{formatUSD(f.expectedOutflows)}</dd></div>
              <div className="flex justify-between font-semibold border-t border-border pt-1.5"><dt>Projected Cash</dt><dd className="tabular-nums">{formatUSD(f.projectedCash)}</dd></div>
            </dl>
          </div>
        ))}
      </section>

      <ChartCard title="Cash Flow — Actual &amp; Projected" sub="Last 6 months actual, then 30/60/90-day projection">
        <CashFlowChart data={chartData} />
      </ChartCard>

      <section className="rounded-lg border border-border bg-card p-4">
        <h3 className="text-sm font-semibold mb-3">Recent Transactions</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-xs text-muted-foreground">
              <th className="text-left py-1.5">Date</th>
              <th className="text-left py-1.5">Category</th>
              <th className="text-left py-1.5">Direction</th>
              <th className="text-left py-1.5">Type</th>
              <th className="text-right py-1.5">Amount</th>
            </tr>
          </thead>
          <tbody>
            {recentTxns.map((t) => (
              <tr key={t.id} className="border-b border-border last:border-0">
                <td className="py-1.5">{formatDate(t.date)}</td>
                <td className="py-1.5">{t.category}</td>
                <td className="py-1.5">{t.direction === "INFLOW" ? "Inflow" : "Outflow"}</td>
                <td className="py-1.5 text-xs text-muted-foreground">{t.certainty}</td>
                <td className={`py-1.5 text-right tabular-nums ${t.direction === "INFLOW" ? "text-positive" : "text-negative"}`}>
                  {t.direction === "INFLOW" ? "+" : "-"}{formatUSD(t.amount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
