import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { canManageMasterData, canViewFinancials } from "@/lib/rbac";
import { ClientFormDialog } from "@/components/clients/client-form-dialog";
import { ClientsTable, type ClientRow } from "@/components/clients/clients-table";
import { clientFinancialsForRange } from "@/lib/calc";
import { resolvePeriod } from "@/lib/dates";

export default async function ClientsPage() {
  const session = await auth();
  const canManage = canManageMasterData(session?.user.role ?? "");
  const showFinancials = canViewFinancials(session?.user.role ?? "");
  const range = resolvePeriod("current_month");

  const [clients, financials, managers] = await Promise.all([
    prisma.client.findMany({ where: { deletedAt: null }, include: { accountManager: true }, orderBy: { name: "asc" } }),
    clientFinancialsForRange(range),
    prisma.user.findMany({ where: { role: { in: ["OWNER", "MANAGER", "OPERATIONS"] } }, select: { id: true, name: true } }),
  ]);
  const finById = new Map(financials.map((f) => [f.clientId, f]));

  const rows: ClientRow[] = clients.map((c) => {
    const f = finById.get(c.id);
    return {
      id: c.id,
      clientCode: c.clientCode,
      name: c.name,
      accountManager: c.accountManager?.name ?? "Unassigned",
      paymentTerms: c.paymentTerms,
      status: c.status,
      totalRevenue: f?.totalRevenue ?? 0,
      outstanding: f?.outstanding ?? 0,
      margin: f?.margin ?? 0,
    };
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Clients</h2>
          <p className="text-sm text-muted-foreground">Client master and account financial summaries</p>
        </div>
        {canManage && <ClientFormDialog accountManagers={managers} />}
      </div>
      <ClientsTable rows={rows} showFinancials={showFinancials} />
    </div>
  );
}
