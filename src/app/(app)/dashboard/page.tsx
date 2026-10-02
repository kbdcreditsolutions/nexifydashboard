import Link from "next/link";
import {
  DollarSign,
  TrendingDown,
  TrendingUp,
  Percent,
  Landmark,
  Wallet,
  Building2,
  FolderKanban,
  Users,
  Clock,
  Gauge,
  Banknote,
} from "lucide-react";
import { KpiCard } from "@/components/kpi-card";
import { PeriodSelector } from "@/components/period-selector";
import { ChartCard } from "@/components/charts/chart-card";
import { RevenueExpenseChart } from "@/components/charts/revenue-expense-chart";
import { ProfitTrendChart } from "@/components/charts/profit-trend-chart";
import { HorizontalBarChart } from "@/components/charts/horizontal-bar-chart";
import { ARAgingChart } from "@/components/charts/ar-aging-chart";
import { CashFlowChart } from "@/components/charts/cash-flow-chart";
import { UtilizationChart } from "@/components/charts/utilization-chart";
import {
  dashboardKpisForRange,
  companyPLForRange,
  clientFinancialsForRange,
  expenseBreakdownForRange,
  accountsReceivableAging,
  cashFlowForRange,
  cashFlowForecast,
  employeeEconomicsForRange,
} from "@/lib/calc";
import { resolvePeriod, comparisonRangeFor, lastNMonths, type PeriodKey } from "@/lib/dates";
import { formatUSD, formatUSDCompact, formatPercent, formatChange, formatHours } from "@/lib/format";
import { auth } from "@/auth";
import { canViewFinancials } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { computeAlerts } from "@/lib/alerts";
import { AlertTriangle } from "lucide-react";

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const { period } = await searchParams;
  const periodKey = (period as PeriodKey) ?? "current_month";
  const range = resolvePeriod(periodKey);
  const prevRange = comparisonRangeFor(periodKey, range);

  const session = await auth();
  const showFinancials = canViewFinancials(session?.user.role ?? "");

  const [kpis, prevKpis, revenuesByClient, expenseBreakdown, ar, cashRange, cashForecast, utilEcon, serviceRevenue, alerts] = await Promise.all([
    dashboardKpisForRange(range),
    dashboardKpisForRange(prevRange),
    clientFinancialsForRange(range),
    expenseBreakdownForRange(range),
    accountsReceivableAging(),
    cashFlowForRange(range),
    cashFlowForecast([30, 60, 90]),
    employeeEconomicsForRange(range),
    prisma.revenue.groupBy({ by: ["serviceId"], where: { date: { gte: range.start, lte: range.end } }, _sum: { amount: true } }),
    showFinancials ? computeAlerts() : Promise.resolve([]),
  ]);
  const topAlerts = alerts.filter((a) => a.severity !== "INFO").slice(0, 5);

  const months = lastNMonths(6);
  const [monthlyPL, services] = await Promise.all([
    Promise.all(months.map((m) => companyPLForRange({ start: m.start, end: m.end, label: m.label }))),
    prisma.service.findMany(),
  ]);

  const revenueExpenseData = months.map((m, i) => ({ label: m.label, revenue: monthlyPL[i].totalRevenue, expenses: monthlyPL[i].totalDirectCosts + monthlyPL[i].totalOpex + monthlyPL[i].otherCosts }));
  const profitTrendData = months.map((m, i) => ({ label: m.label, grossProfit: monthlyPL[i].grossProfit, netProfit: monthlyPL[i].netProfit }));

  const topClients = [...revenuesByClient]
    .sort((a, b) => b.totalRevenue - a.totalRevenue)
    .slice(0, 6)
    .map((c) => ({ name: c.name, value: c.totalRevenue }));

  const serviceNameById = new Map(services.map((s) => [s.id, s.name]));
  const revenueByServiceData = serviceRevenue
    .map((r) => ({ name: r.serviceId ? serviceNameById.get(r.serviceId) ?? "Other" : "Other", value: Number(r._sum.amount ?? 0) }))
    .filter((r) => r.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);

  const expenseChartData = [...expenseBreakdown].sort((a, b) => b.amount - a.amount).slice(0, 8).map((e) => ({ name: e.category, value: e.amount }));

  const cashFlowChartData = [
    { label: "Actual", inflows: cashRange.inflows, outflows: cashRange.outflows, closingCash: cashRange.closingCash },
    ...cashForecast.map((f) => ({ label: `+${f.days}d`, inflows: f.expectedInflows, outflows: f.expectedOutflows, closingCash: f.projectedCash, projected: true })),
  ];

  const utilizationData = [...utilEcon]
    .sort((a, b) => b.billableHours - a.billableHours)
    .slice(0, 10)
    .map((e) => ({ name: e.name, billable: Math.round(e.billableHours), nonBillable: Math.round(e.nonBillableHours) }));

  const periodLabel = range.label;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Executive Dashboard</h2>
          <p className="text-sm text-muted-foreground">Nexify InfoSystems &middot; {periodLabel}</p>
        </div>
        <PeriodSelector />
      </div>

      {topAlerts.length > 0 && (
        <section className="rounded-lg border border-warning/30 bg-warning/5 p-3.5 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-sm font-medium text-amber-800">
              <AlertTriangle className="h-4 w-4" /> Needs Attention
            </span>
            <Link href="/alerts" prefetch={false} className="text-xs text-amber-800 underline underline-offset-2">View all {alerts.length}</Link>
          </div>
          <ul className="text-sm text-amber-800 space-y-1">
            {topAlerts.map((a, i) => (
              <li key={i}>
                {a.href ? <Link href={a.href} prefetch={false} className="hover:underline">{a.message}</Link> : a.message}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Financial KPIs */}
      {showFinancials && (
        <section className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Financial Health</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3">
            <KpiCard label="Total Revenue" value={formatUSD(kpis.totalRevenue)} change={formatChange(kpis.totalRevenue, prevKpis.totalRevenue)} icon={DollarSign} href="/revenue" />
            <KpiCard label="Total Expenses" value={formatUSD(kpis.totalExpenses)} change={formatChange(kpis.totalExpenses, prevKpis.totalExpenses)} changeGoodDirection="down" icon={TrendingDown} href="/expenses" />
            <KpiCard label="Gross Profit" value={formatUSD(kpis.grossProfit)} change={formatChange(kpis.grossProfit, prevKpis.grossProfit)} icon={TrendingUp} href="/profitability" />
            <KpiCard label="Net Profit" value={formatUSD(kpis.netProfit)} change={formatChange(kpis.netProfit, prevKpis.netProfit)} icon={TrendingUp} href="/profitability" />
            <KpiCard label="Net Margin" value={formatPercent(kpis.netMarginPct)} sub={`Gross ${formatPercent(kpis.grossMarginPct)}`} icon={Percent} href="/profitability" />
            <KpiCard label="Outstanding Receivables" value={formatUSD(kpis.outstandingReceivables)} icon={Landmark} href="/receivables" />
            <KpiCard label="Cash Balance" value={formatUSD(kpis.cashBalance)} icon={Banknote} href="/cash-flow" />
            <KpiCard label="Monthly Burn" value={formatUSD(kpis.monthlyBurn)} icon={TrendingDown} href="/cash-flow" />
            <KpiCard label="Accounts Payable" value={formatUSD(kpis.accountsPayable)} icon={Wallet} href="/payables" />
          </div>
        </section>
      )}

      {/* Operational KPIs */}
      <section className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Operations</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
          <KpiCard label="Active Clients" value={String(kpis.activeClients)} icon={Building2} href="/clients" />
          <KpiCard label="Active Projects" value={String(kpis.activeProjects)} icon={FolderKanban} href="/projects" />
          <KpiCard label="Active Employees" value={String(kpis.activeEmployees)} icon={Users} href="/employees" />
          <KpiCard label="Billable Hours" value={formatHours(kpis.billableHours, 0)} icon={Clock} href="/timesheets" />
          <KpiCard label="Utilization" value={formatPercent(kpis.utilizationPct)} icon={Gauge} href="/employees" />
          {showFinancials && <KpiCard label="Revenue / Employee" value={formatUSDCompact(kpis.revenuePerEmployee)} icon={DollarSign} href="/employees" />}
        </div>
      </section>

      {showFinancials && (
        <>
          <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ChartCard title="Revenue vs Expenses" sub="Last 6 months">
              <RevenueExpenseChart data={revenueExpenseData} />
            </ChartCard>
            <ChartCard title="Profit Trend" sub="Gross and net profit, last 6 months">
              <ProfitTrendChart data={profitTrendData} />
            </ChartCard>
          </section>

          <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ChartCard title="Revenue by Client" sub={`Top clients — ${periodLabel}`}>
              <HorizontalBarChart data={topClients} seriesName="Revenue" />
            </ChartCard>
            <ChartCard title="Revenue by Service" sub={`By service line — ${periodLabel}`}>
              <HorizontalBarChart data={revenueByServiceData} seriesName="Revenue" />
            </ChartCard>
          </section>

          <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ChartCard title="Expense Breakdown" sub={`By category — ${periodLabel}`}>
              <HorizontalBarChart data={expenseChartData} seriesName="Expense" singleHue />
            </ChartCard>
            <ChartCard title="Client Receivables" sub="Outstanding invoice aging, as of today">
              <ARAgingChart summary={ar.summary} />
            </ChartCard>
          </section>

          <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ChartCard title="Cash Flow" sub="Actual this period + 30/60/90-day projection">
              <CashFlowChart data={cashFlowChartData} />
            </ChartCard>
            <ChartCard title="Employee Utilization" sub={`Billable vs non-billable hours — ${periodLabel}`}>
              <UtilizationChart data={utilizationData} />
            </ChartCard>
          </section>
        </>
      )}

      <p className="text-xs text-muted-foreground text-right">
        Need the underlying records?{" "}
        {showFinancials && (
          <>
            <Link href="/revenue" prefetch={false} className="underline underline-offset-2">View Revenue</Link> &middot;{" "}
          </>
        )}
        <Link href="/timesheets" prefetch={false} className="underline underline-offset-2">View Timesheets</Link>
      </p>
    </div>
  );
}
