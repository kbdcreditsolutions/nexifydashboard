import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { canViewFinancials } from "@/lib/rbac";
import { PayableFormDialog } from "@/components/payables/payable-form-dialog";
import { PayablesTable, type PayableRow } from "@/components/payables/payables-table";
import { KpiCard } from "@/components/kpi-card";
import { accountsPayableSummary } from "@/lib/calc";
import { formatUSD } from "@/lib/format";
import { Wallet, Calendar, AlertTriangle } from "lucide-react";

export default async function PayablesPage() {
  const session = await auth();
  if (!session?.user || !canViewFinancials(session.user.role)) redirect("/dashboard");

  const [payables, vendors, summary] = await Promise.all([
    prisma.accountsPayable.findMany({ include: { vendor: true }, orderBy: { dueDate: "asc" } }),
    prisma.vendor.findMany({ orderBy: { name: "asc" } }),
    accountsPayableSummary(),
  ]);

  const rows: PayableRow[] = payables.map((p) => ({
    id: p.id,
    vendorName: p.vendor.name,
    invoiceRef: p.invoiceRef ?? "—",
    amount: Number(p.amount),
    dueDate: p.dueDate.toISOString(),
    paidAmount: Number(p.paidAmount),
    balance: Number(p.balance),
    status: p.status,
  }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Accounts Payable</h2>
          <p className="text-sm text-muted-foreground">Money Nexify owes to vendors and contractors</p>
        </div>
        <PayableFormDialog vendors={vendors} />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard label="Total Payable" value={formatUSD(summary.totalPayable)} icon={Wallet} />
        <KpiCard label="Due This Week" value={formatUSD(summary.dueThisWeek)} icon={Calendar} />
        <KpiCard label="Due This Month" value={formatUSD(summary.dueThisMonth)} icon={Calendar} />
        <KpiCard label="Overdue" value={formatUSD(summary.overdue)} icon={AlertTriangle} />
      </div>
      <PayablesTable rows={rows} />
    </div>
  );
}
