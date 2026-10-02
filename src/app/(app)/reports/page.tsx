import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { auth } from "@/auth";
import { canViewFinancials } from "@/lib/rbac";
import { PeriodSelector } from "@/components/period-selector";
import { PnlStatement } from "@/components/reports/pnl-statement";
import { PrintButton } from "@/components/reports/print-button";
import { UtilizationReportTable, type UtilRow } from "@/components/reports/utilization-report-table";
import { companyPLForRange, employeeEconomicsForRange } from "@/lib/calc";
import { resolvePeriod, type PeriodKey } from "@/lib/dates";

const OTHER_REPORTS = [
  { title: "Revenue Report", desc: "All billed revenue, filterable by client, project, employee, and date", href: "/revenue" },
  { title: "Expense Report", desc: "All expenses by category, vendor, client, and project allocation", href: "/expenses" },
  { title: "Cash Flow Report", desc: "Actual cash flow and 30/60/90-day forecast", href: "/cash-flow" },
  { title: "Employee Profitability", desc: "Revenue, cost, contribution, and margin by employee", href: "/profitability" },
  { title: "Client Profitability", desc: "Revenue, cost, contribution, and margin by client", href: "/profitability" },
  { title: "Project Profitability", desc: "Revenue, cost, contribution, and margin by project", href: "/profitability" },
  { title: "Invoice Report", desc: "All invoices with status, totals, and balances", href: "/invoices" },
  { title: "Accounts Receivable", desc: "Outstanding client balances and aging", href: "/receivables" },
  { title: "Accounts Payable", desc: "Outstanding vendor balances and due dates", href: "/payables" },
  { title: "Timesheet Report", desc: "All logged time by employee, client, and project", href: "/timesheets" },
];

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const session = await auth();
  if (!session?.user || !canViewFinancials(session.user.role)) redirect("/dashboard");

  const { period } = await searchParams;
  const periodKey = (period as PeriodKey) ?? "current_month";
  const range = resolvePeriod(periodKey);

  const [pl, econ] = await Promise.all([companyPLForRange(range), employeeEconomicsForRange(range)]);

  const utilRows: UtilRow[] = econ.map((e) => ({
    id: e.employeeId,
    name: e.name,
    department: e.department,
    availableHours: e.availableHours,
    billableHours: e.billableHours,
    nonBillableHours: e.nonBillableHours,
    utilization: e.utilization,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between print:hidden">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Reports</h2>
          <p className="text-sm text-muted-foreground">Monthly P&amp;L, utilization, and links to every exportable report</p>
        </div>
        <PeriodSelector />
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between print:hidden">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Monthly P&amp;L</h3>
          <PrintButton />
        </div>
        <PnlStatement pl={pl} label={range.label} />
      </section>

      <section className="space-y-3 print:hidden">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Utilization Report</h3>
        <UtilizationReportTable rows={utilRows} />
      </section>

      <section className="space-y-3 print:hidden">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">All Reports</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {OTHER_REPORTS.map((r) => (
            <Link key={r.title} href={r.href} prefetch={false} className="flex items-center justify-between rounded-lg border border-border bg-card p-3.5 hover:border-foreground/20 transition-colors">
              <div>
                <p className="text-sm font-medium">{r.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{r.desc}</p>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
