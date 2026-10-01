import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, AlertTriangle, DollarSign, TrendingUp, Clock } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { canManageMasterData, canViewFinancials } from "@/lib/rbac";
import { ProjectFormDialog } from "@/components/projects/project-form-dialog";
import { TeamAssignment } from "@/components/projects/team-assignment";
import { StatusBadge } from "@/components/status-badge";
import { KpiCard } from "@/components/kpi-card";
import { Progress } from "@/components/ui/progress";
import { projectFinancialsForRange } from "@/lib/calc";
import { currentMonthRange, ytdRange } from "@/lib/dates";
import { formatUSD, formatPercent, formatHours, formatDate } from "@/lib/format";

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const canManage = canManageMasterData(session?.user.role ?? "");
  const showFinancials = canViewFinancials(session?.user.role ?? "");

  const [project, clients, managers, services, mtdList, ytdList, allTimeList, employees] = await Promise.all([
    prisma.project.findUnique({
      where: { id },
      include: { client: true, projectManager: true, service: true, assignments: { include: { employee: true } } },
    }),
    prisma.client.findMany({ where: { deletedAt: null }, select: { id: true, name: true } }),
    prisma.user.findMany({ where: { role: { in: ["OWNER", "MANAGER", "OPERATIONS"] } }, select: { id: true, name: true } }),
    prisma.service.findMany({ select: { id: true, name: true } }),
    projectFinancialsForRange(currentMonthRange(), id),
    projectFinancialsForRange(ytdRange(), id),
    projectFinancialsForRange({ start: new Date(new Date().getFullYear() - 50, 0, 1), end: new Date(new Date().getFullYear() + 50, 0, 1), label: "All Time" }, id),
    prisma.employee.findMany({ where: { deletedAt: null, status: "ACTIVE" }, select: { id: true, name: true } }),
  ]);
  if (!project) notFound();
  const mtd = mtdList[0];
  const ytd = ytdList[0];
  const allTime = allTimeList[0];

  const assignedIds = new Set(project.assignments.map((a) => a.employeeId));
  const availableEmployees = employees.filter((e) => !assignedIds.has(e.id));

  return (
    <div className="space-y-5">
      <Link href="/projects" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to Projects
      </Link>

      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-xl font-semibold text-foreground">{project.name}</h2>
            <StatusBadge status={project.status} />
          </div>
          <p className="text-sm text-muted-foreground">
            {project.projectCode} &middot;{" "}
            <Link href={`/clients/${project.clientId}`} className="hover:underline">{project.client.name}</Link> &middot;{" "}
            {project.service?.name ?? "No service set"} &middot; {project.billingModel.replace("_", " ")}
          </p>
        </div>
        {canManage && (
          <ProjectFormDialog
            clients={clients}
            managers={managers}
            services={services}
            project={{
              id: project.id,
              projectCode: project.projectCode,
              name: project.name,
              clientId: project.clientId,
              projectManagerId: project.projectManagerId,
              serviceId: project.serviceId,
              startDate: project.startDate.toISOString(),
              endDate: project.endDate?.toISOString(),
              billingModel: project.billingModel,
              contractValue: Number(project.contractValue),
              budget: Number(project.budget),
              estimatedHours: Number(project.estimatedHours),
              marginThresholdPct: Number(project.marginThresholdPct),
              status: project.status,
              notes: project.notes,
            }}
          />
        )}
      </div>

      {allTime && allTime.alerts.length > 0 && (
        <div className="rounded-lg border border-warning/30 bg-warning/10 p-3.5 space-y-1.5">
          <div className="flex items-center gap-1.5 text-sm font-medium text-amber-800">
            <AlertTriangle className="h-4 w-4" /> Attention Required
          </div>
          <ul className="text-sm text-amber-800 list-disc list-inside space-y-0.5">
            {allTime.alerts.map((a) => <li key={a}>{a}</li>)}
          </ul>
        </div>
      )}

      {showFinancials && allTime && (
        <section className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Budget &amp; Hours (All Time)</h3>
          <div className="rounded-lg border border-border bg-card p-4 space-y-3">
            <div className="grid grid-cols-2 gap-6">
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-muted-foreground">Cost vs Budget</span>
                  <span className="tabular-nums">{formatUSD(allTime.totalCost)} / {formatUSD(allTime.budget)}</span>
                </div>
                <Progress value={allTime.budget > 0 ? Math.min(100, (allTime.totalCost / allTime.budget) * 100) : 0} />
              </div>
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-muted-foreground">Actual vs Estimated Hours</span>
                  <span className="tabular-nums">{formatHours(allTime.actualHours)} / {formatHours(allTime.estimatedHours)}</span>
                </div>
                <Progress value={allTime.estimatedHours > 0 ? Math.min(100, (allTime.actualHours / allTime.estimatedHours) * 100) : 0} />
              </div>
            </div>
          </div>
        </section>
      )}

      {showFinancials && mtd && (
        <section className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">This Month</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3">
            <KpiCard label="Revenue" value={formatUSD(mtd.revenue)} icon={DollarSign} />
            <KpiCard label="Employee Cost" value={formatUSD(mtd.employeeCost)} icon={DollarSign} />
            <KpiCard label="Direct Expenses" value={formatUSD(mtd.directExpenses)} icon={DollarSign} />
            <KpiCard label="Gross Profit" value={formatUSD(mtd.grossProfit)} icon={TrendingUp} />
            <KpiCard label="Margin" value={formatPercent(mtd.margin)} sub={`Target ${formatPercent(mtd.marginThresholdPct)}`} />
          </div>
        </section>
      )}

      {showFinancials && ytd && (
        <section className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Year to Date</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <KpiCard label="Revenue" value={formatUSD(ytd.revenue)} />
            <KpiCard label="Total Cost" value={formatUSD(ytd.totalCost)} />
            <KpiCard label="Gross Profit" value={formatUSD(ytd.grossProfit)} />
            <KpiCard label="Hours Logged" value={formatHours(ytd.actualHours)} icon={Clock} />
          </div>
        </section>
      )}

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-lg border border-border bg-card p-4">
          <h3 className="text-sm font-semibold mb-3">Project Details</h3>
          <dl className="grid grid-cols-2 gap-y-2 text-sm">
            <dt className="text-muted-foreground">Project Manager</dt>
            <dd className="text-right">{project.projectManager?.name ?? "Unassigned"}</dd>
            <dt className="text-muted-foreground">Start Date</dt>
            <dd className="text-right">{formatDate(project.startDate)}</dd>
            <dt className="text-muted-foreground">End Date</dt>
            <dd className="text-right">{formatDate(project.endDate)}</dd>
            {showFinancials && (
              <>
                <dt className="text-muted-foreground">Contract Value</dt>
                <dd className="text-right tabular-nums">{formatUSD(project.contractValue)}</dd>
                <dt className="text-muted-foreground">Budget</dt>
                <dd className="text-right tabular-nums">{formatUSD(project.budget)}</dd>
              </>
            )}
          </dl>
        </div>

        <TeamAssignment
          projectId={project.id}
          assigned={project.assignments.map((a) => ({ employeeId: a.employeeId, name: a.employee.name, role: a.employee.role }))}
          available={availableEmployees}
          canManage={canManage}
        />
      </section>
    </div>
  );
}
