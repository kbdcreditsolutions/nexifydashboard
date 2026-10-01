import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { canViewFinancials } from "@/lib/rbac";
import { RevenueFormDialog } from "@/components/revenue/revenue-form-dialog";
import { RevenueTable, type RevenueRow } from "@/components/revenue/revenue-table";
import { PeriodSelector } from "@/components/period-selector";
import { resolvePeriod, type PeriodKey } from "@/lib/dates";
import { KpiCard } from "@/components/kpi-card";
import { formatUSD } from "@/lib/format";
import { DollarSign } from "lucide-react";

export default async function RevenuePage({ searchParams }: { searchParams: Promise<{ period?: string; client?: string; employee?: string }> }) {
  const session = await auth();
  if (!session?.user || !canViewFinancials(session.user.role)) redirect("/dashboard");

  const { period, client: clientFilter, employee: employeeFilter } = await searchParams;
  const range = resolvePeriod((period as PeriodKey) ?? "current_month");

  const [revenues, clients, projects, employees, services] = await Promise.all([
    prisma.revenue.findMany({
      where: {
        date: { gte: range.start, lte: range.end },
        ...(clientFilter ? { clientId: clientFilter } : {}),
        ...(employeeFilter ? { employeeId: employeeFilter } : {}),
      },
      include: { client: true, project: true, employee: true, service: true, invoice: true },
      orderBy: { date: "desc" },
    }),
    prisma.client.findMany({ where: { deletedAt: null }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.project.findMany({ where: { deletedAt: null }, select: { id: true, name: true, clientId: true } }),
    prisma.employee.findMany({ where: { deletedAt: null }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.service.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  const rows: RevenueRow[] = revenues.map((r) => ({
    id: r.id,
    revenueCode: r.revenueCode,
    date: r.date.toISOString(),
    clientId: r.clientId,
    clientName: r.client.name,
    projectName: r.project?.name ?? "—",
    employeeName: r.employee?.name ?? "—",
    serviceName: r.service?.name ?? "—",
    revenueType: r.revenueType,
    amount: Number(r.amount),
    paymentStatus: r.paymentStatus,
    invoiceNumber: r.invoice?.invoiceNumber ?? "Not Invoiced",
  }));

  const total = rows.reduce((s, r) => s + r.amount, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Revenue</h2>
          <p className="text-sm text-muted-foreground">All billed revenue by source, traceable to client, project, and invoice</p>
        </div>
        <div className="flex items-center gap-2">
          <PeriodSelector />
          <RevenueFormDialog clients={clients} projects={projects} employees={employees} services={services} />
        </div>
      </div>
      <KpiCard label={`Total Revenue — ${range.label}`} value={formatUSD(total)} icon={DollarSign} />
      <RevenueTable rows={rows} />
    </div>
  );
}
