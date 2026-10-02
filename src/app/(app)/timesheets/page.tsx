import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { canApproveTimesheets } from "@/lib/rbac";
import { TimesheetEntryDialog, WeeklyTimesheetDialog } from "@/components/timesheets/timesheet-form-dialogs";
import { TimesheetsTable, type TimesheetRow } from "@/components/timesheets/timesheets-table";
import { PeriodSelector } from "@/components/period-selector";
import { KpiCard } from "@/components/kpi-card";
import { resolvePeriod, type PeriodKey } from "@/lib/dates";
import { formatHours } from "@/lib/format";
import { Clock, ClipboardCheck } from "lucide-react";

export default async function TimesheetsPage({ searchParams }: { searchParams: Promise<{ period?: string; employee?: string }> }) {
  const { period, employee: employeeFilter } = await searchParams;
  const range = resolvePeriod((period as PeriodKey) ?? "current_month");
  const session = await auth();
  const canApprove = canApproveTimesheets(session?.user.role ?? "");

  const [timesheets, employees, clients, projects, services] = await Promise.all([
    prisma.timesheet.findMany({
      where: { date: { gte: range.start, lte: range.end }, ...(employeeFilter ? { employeeId: employeeFilter } : {}) },
      relationLoadStrategy: "join",
      include: { employee: true, client: true, project: true, service: true },
      orderBy: { date: "desc" },
    }),
    prisma.employee.findMany({ where: { deletedAt: null }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.client.findMany({ where: { deletedAt: null }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.project.findMany({ where: { deletedAt: null }, select: { id: true, name: true, clientId: true } }),
    prisma.service.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  const rows: TimesheetRow[] = timesheets.map((t) => ({
    id: t.id,
    date: t.date.toISOString(),
    employeeName: t.employee.name,
    clientName: t.client?.name ?? "—",
    projectName: t.project?.name ?? "—",
    serviceName: t.service?.name ?? "—",
    hours: Number(t.hours),
    billable: t.billable,
    description: t.description ?? "",
    status: t.status,
  }));

  const totalHours = rows.reduce((s, r) => s + r.hours, 0);
  const billableHours = rows.filter((r) => r.billable).reduce((s, r) => s + r.hours, 0);
  const pendingCount = rows.filter((r) => r.status === "SUBMITTED").length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Timesheets</h2>
          <p className="text-sm text-muted-foreground">Time entry, approval, and revenue eligibility workflow</p>
        </div>
        <div className="flex items-center gap-2">
          <PeriodSelector />
          <TimesheetEntryDialog employees={employees} clients={clients} projects={projects} services={services} />
          <WeeklyTimesheetDialog employees={employees} clients={clients} projects={projects} services={services} />
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard label="Total Hours" value={formatHours(totalHours)} icon={Clock} />
        <KpiCard label="Billable Hours" value={formatHours(billableHours)} icon={Clock} />
        <KpiCard label="Pending Approval" value={String(pendingCount)} icon={ClipboardCheck} />
      </div>
      <TimesheetsTable rows={rows} canApprove={canApprove} />
    </div>
  );
}
