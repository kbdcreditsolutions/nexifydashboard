import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { canApproveExpenses } from "@/lib/rbac";
import { ExpenseFormDialog } from "@/components/expenses/expense-form-dialog";
import { ExpensesTable, type ExpenseRow } from "@/components/expenses/expenses-table";
import { PeriodSelector } from "@/components/period-selector";
import { KpiCard } from "@/components/kpi-card";
import { resolvePeriod, type PeriodKey } from "@/lib/dates";
import { formatUSD } from "@/lib/format";
import { Receipt, Clock } from "lucide-react";

export default async function ExpensesPage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const { period } = await searchParams;
  const range = resolvePeriod((period as PeriodKey) ?? "current_month");
  const session = await auth();
  const canApprove = canApproveExpenses(session?.user.role ?? "");

  const [expenses, categories, vendors, clients, projects, employees] = await Promise.all([
    prisma.expense.findMany({
      where: { date: { gte: range.start, lte: range.end } },
      include: { category: true, vendor: true, client: true, project: true },
      orderBy: { date: "desc" },
    }),
    prisma.expenseCategory.findMany({ orderBy: { name: "asc" } }),
    prisma.vendor.findMany({ orderBy: { name: "asc" } }),
    prisma.client.findMany({ where: { deletedAt: null }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.project.findMany({ where: { deletedAt: null }, select: { id: true, name: true, clientId: true } }),
    prisma.employee.findMany({ where: { deletedAt: null }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  const rows: ExpenseRow[] = expenses.map((e) => ({
    id: e.id,
    expenseCode: e.expenseCode,
    date: e.date.toISOString(),
    category: e.category.name,
    group: e.category.group,
    vendor: e.vendor?.name ?? "—",
    amount: Number(e.amount),
    paidBy: e.paidBy === "COMPANY" ? "Company" : "Employee",
    clientName: e.client?.name ?? "—",
    projectName: e.project?.name ?? "—",
    recurring: e.recurring,
    approvalStatus: e.approvalStatus,
  }));

  const total = rows.filter((r) => r.approvalStatus === "APPROVED").reduce((s, r) => s + r.amount, 0);
  const pendingCount = rows.filter((r) => r.approvalStatus === "PENDING").length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Expenses</h2>
          <p className="text-sm text-muted-foreground">Centralized expense tracking across all categories</p>
        </div>
        <div className="flex items-center gap-2">
          <PeriodSelector />
          <ExpenseFormDialog categories={categories} vendors={vendors} clients={clients} projects={projects} employees={employees} />
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard label={`Approved Total — ${range.label}`} value={formatUSD(total)} icon={Receipt} />
        <KpiCard label="Pending Approval" value={String(pendingCount)} icon={Clock} />
      </div>
      <ExpensesTable rows={rows} canApprove={canApprove} />
    </div>
  );
}
