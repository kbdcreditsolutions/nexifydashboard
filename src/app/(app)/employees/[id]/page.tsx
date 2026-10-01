import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { canManageEmployees, canViewFinancials } from "@/lib/rbac";
import { EmployeeFormDialog } from "@/components/employees/employee-form-dialog";
import { StatusBadge } from "@/components/status-badge";
import { KpiCard } from "@/components/kpi-card";
import { employeeEconomicsForRange } from "@/lib/calc";
import { currentMonthRange, ytdRange } from "@/lib/dates";
import { formatUSD, formatPercent, formatHours, formatDate } from "@/lib/format";
import { DollarSign, TrendingUp, Clock, Gauge } from "lucide-react";

export default async function EmployeeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const canManage = canManageEmployees(session?.user.role ?? "");
  const showFinancials = canViewFinancials(session?.user.role ?? "");

  const employee = await prisma.employee.findUnique({
    where: { id },
    include: {
      projectAssignments: { include: { project: { include: { client: true } } } },
      clientAssignments: { include: { client: true } },
    },
  });
  if (!employee) notFound();

  const [mtdEcon, ytdEcon, recentTimesheets] = await Promise.all([
    employeeEconomicsForRange(currentMonthRange(), id),
    employeeEconomicsForRange(ytdRange(), id),
    prisma.timesheet.findMany({
      where: { employeeId: id },
      orderBy: { date: "desc" },
      take: 10,
      include: { project: true, client: true },
    }),
  ]);
  const mtd = mtdEcon[0];
  const ytd = ytdEcon[0];

  return (
    <div className="space-y-5">
      <Link href="/employees" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to Employees
      </Link>

      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-xl font-semibold text-foreground">{employee.name}</h2>
            <StatusBadge status={employee.status} />
          </div>
          <p className="text-sm text-muted-foreground">
            {employee.employeeCode} &middot; {employee.role} &middot; {employee.department} &middot; {employee.employmentType.replace("_", " ")}
          </p>
        </div>
        {canManage && (
          <EmployeeFormDialog
            employee={{
              id: employee.id,
              employeeCode: employee.employeeCode,
              name: employee.name,
              email: employee.email,
              role: employee.role,
              department: employee.department,
              employmentType: employee.employmentType,
              joiningDate: employee.joiningDate.toISOString(),
              status: employee.status,
              monthlyCost: Number(employee.monthlyCost),
              hourlyCost: Number(employee.hourlyCost),
              standardWeeklyHours: Number(employee.standardWeeklyHours),
              billingRate: Number(employee.billingRate),
              notes: employee.notes,
            }}
          />
        )}
      </div>

      {showFinancials && mtd && (
        <section className="space-y-3">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Employee Economics &middot; This Month</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Revenue attributed as billable hours &times; billing rate — an internal performance view, distinct from recognized revenue on fixed-price or retainer contracts.</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
            <KpiCard label="Billable Hours" value={formatHours(mtd.billableHours)} icon={Clock} />
            <KpiCard label="Non-Billable Hours" value={formatHours(mtd.nonBillableHours)} icon={Clock} />
            <KpiCard label="Revenue Generated" value={formatUSD(mtd.revenue)} icon={DollarSign} href={`/revenue?employee=${employee.id}`} />
            <KpiCard label="Employee Cost" value={formatUSD(mtd.cost)} icon={DollarSign} />
            <KpiCard label="Contribution" value={formatUSD(mtd.contribution)} icon={TrendingUp} />
            <KpiCard label="Margin / Utilization" value={formatPercent(mtd.margin)} sub={`Util. ${formatPercent(mtd.utilization)}`} icon={Gauge} />
          </div>
        </section>
      )}

      {showFinancials && ytd && (
        <section className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Year to Date</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <KpiCard label="Billable Hours" value={formatHours(ytd.billableHours)} />
            <KpiCard label="Revenue" value={formatUSD(ytd.revenue)} />
            <KpiCard label="Contribution" value={formatUSD(ytd.contribution)} />
            <KpiCard label="Utilization" value={formatPercent(ytd.utilization)} />
          </div>
        </section>
      )}

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-lg border border-border bg-card p-4">
          <h3 className="text-sm font-semibold mb-3">Rates</h3>
          <dl className="grid grid-cols-2 gap-y-2 text-sm">
            <dt className="text-muted-foreground">Billing Rate</dt>
            <dd className="text-right tabular-nums">{formatUSD(employee.billingRate)}/hr</dd>
            <dt className="text-muted-foreground">Hourly Cost</dt>
            <dd className="text-right tabular-nums">{formatUSD(employee.hourlyCost)}/hr</dd>
            <dt className="text-muted-foreground">Monthly Cost</dt>
            <dd className="text-right tabular-nums">{formatUSD(employee.monthlyCost)}</dd>
            <dt className="text-muted-foreground">Standard Weekly Hours</dt>
            <dd className="text-right tabular-nums">{formatHours(employee.standardWeeklyHours)}</dd>
            <dt className="text-muted-foreground">Joined</dt>
            <dd className="text-right">{formatDate(employee.joiningDate)}</dd>
          </dl>
        </div>

        <div className="rounded-lg border border-border bg-card p-4">
          <h3 className="text-sm font-semibold mb-3">Assignments</h3>
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Clients</p>
            <div className="flex flex-wrap gap-1.5">
              {employee.clientAssignments.length === 0 && <span className="text-sm text-muted-foreground">None</span>}
              {employee.clientAssignments.map((ca) => (
                <Link key={ca.id} href={`/clients/${ca.clientId}`} className="text-xs rounded-full bg-accent px-2.5 py-1 hover:underline">
                  {ca.client.name}
                </Link>
              ))}
            </div>
            <p className="text-xs font-medium text-muted-foreground mt-3">Projects</p>
            <div className="flex flex-wrap gap-1.5">
              {employee.projectAssignments.length === 0 && <span className="text-sm text-muted-foreground">None</span>}
              {employee.projectAssignments.map((pa) => (
                <Link key={pa.id} href={`/projects/${pa.projectId}`} className="text-xs rounded-full bg-accent px-2.5 py-1 hover:underline">
                  {pa.project.name}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold">Recent Timesheets</h3>
          <Link href={`/timesheets?employee=${employee.id}`} className="text-xs text-muted-foreground hover:underline">
            View all
          </Link>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-xs text-muted-foreground">
              <th className="text-left py-1.5">Date</th>
              <th className="text-left py-1.5">Project</th>
              <th className="text-left py-1.5">Billable</th>
              <th className="text-right py-1.5">Hours</th>
              <th className="text-left py-1.5">Status</th>
            </tr>
          </thead>
          <tbody>
            {recentTimesheets.map((t) => (
              <tr key={t.id} className="border-b border-border last:border-0">
                <td className="py-1.5">{formatDate(t.date)}</td>
                <td className="py-1.5">{t.project?.name ?? "—"}</td>
                <td className="py-1.5">{t.billable ? "Yes" : "No"}</td>
                <td className="py-1.5 text-right tabular-nums">{formatHours(t.hours)}</td>
                <td className="py-1.5"><StatusBadge status={t.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
