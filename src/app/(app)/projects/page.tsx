import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { canManageMasterData, canViewFinancials } from "@/lib/rbac";
import { ProjectFormDialog } from "@/components/projects/project-form-dialog";
import { ProjectsTable, type ProjectRow } from "@/components/projects/projects-table";
import { projectFinancialsForRange } from "@/lib/calc";
import { resolvePeriod } from "@/lib/dates";

export default async function ProjectsPage({ searchParams }: { searchParams: Promise<{ client?: string }> }) {
  const { client: clientFilter } = await searchParams;
  const session = await auth();
  const canManage = canManageMasterData(session?.user.role ?? "");
  const showFinancials = canViewFinancials(session?.user.role ?? "");
  const range = resolvePeriod("current_month");

  const [projects, financials, clients, managers, services] = await Promise.all([
    prisma.project.findMany({ where: { deletedAt: null, ...(clientFilter ? { clientId: clientFilter } : {}) }, include: { client: true }, orderBy: { startDate: "desc" } }),
    projectFinancialsForRange(range),
    prisma.client.findMany({ where: { deletedAt: null }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.user.findMany({ where: { role: { in: ["OWNER", "MANAGER", "OPERATIONS"] } }, select: { id: true, name: true } }),
    prisma.service.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  const finById = new Map(financials.map((f) => [f.projectId, f]));

  // See employees/page.tsx: financial figures are zeroed here, not just
  // hidden in the table, since the table is a client component and the
  // RSC payload would otherwise carry them regardless of which columns render.
  const rows: ProjectRow[] = projects.map((p) => {
    const f = finById.get(p.id);
    return {
      id: p.id,
      projectCode: p.projectCode,
      name: p.name,
      clientName: p.client.name,
      billingModel: p.billingModel,
      status: p.status,
      budget: showFinancials ? Number(p.budget) : 0,
      revenue: showFinancials ? (f?.revenue ?? 0) : 0,
      margin: showFinancials ? (f?.margin ?? 0) : 0,
      alertCount: f?.alerts.length ?? 0,
    };
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Projects</h2>
          <p className="text-sm text-muted-foreground">Project financial profiles and delivery status</p>
        </div>
        {canManage && <ProjectFormDialog clients={clients} managers={managers} services={services} defaultClientId={clientFilter} />}
      </div>
      <ProjectsTable rows={rows} showFinancials={showFinancials} />
    </div>
  );
}
