import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, DollarSign, Landmark, TrendingUp, AlertTriangle } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { canManageMasterData, canViewFinancials } from "@/lib/rbac";
import { ClientFormDialog } from "@/components/clients/client-form-dialog";
import { StatusBadge } from "@/components/status-badge";
import { KpiCard } from "@/components/kpi-card";
import { clientFinancialsForRange } from "@/lib/calc";
import { currentMonthRange, ytdRange } from "@/lib/dates";
import { formatUSD, formatPercent, formatDate } from "@/lib/format";

export default async function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const canManage = canManageMasterData(session?.user.role ?? "");
  const showFinancials = canViewFinancials(session?.user.role ?? "");

  const [client, managers, mtdList, ytdList, projects] = await Promise.all([
    prisma.client.findUnique({ where: { id }, include: { accountManager: true } }),
    prisma.user.findMany({ where: { role: { in: ["OWNER", "MANAGER", "OPERATIONS"] } }, select: { id: true, name: true } }),
    clientFinancialsForRange(currentMonthRange(), id),
    clientFinancialsForRange(ytdRange(), id),
    prisma.project.findMany({ where: { clientId: id, deletedAt: null }, orderBy: { startDate: "desc" } }),
  ]);
  if (!client) notFound();
  const mtd = mtdList[0];
  const ytd = ytdList[0];

  return (
    <div className="space-y-5">
      <Link href="/clients" prefetch={false} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to Clients
      </Link>

      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-xl font-semibold text-foreground">{client.name}</h2>
            <StatusBadge status={client.status} />
          </div>
          <p className="text-sm text-muted-foreground">
            {client.clientCode} &middot; {client.contactPerson ?? "No contact set"} &middot; {client.paymentTerms}
          </p>
        </div>
        {canManage && (
          <ClientFormDialog
            accountManagers={managers}
            client={{
              id: client.id,
              clientCode: client.clientCode,
              name: client.name,
              contactPerson: client.contactPerson,
              email: client.email,
              phone: client.phone,
              contractStartDate: client.contractStartDate?.toISOString(),
              contractEndDate: client.contractEndDate?.toISOString(),
              paymentTerms: client.paymentTerms,
              billingTerms: client.billingTerms,
              accountManagerId: client.accountManagerId,
              status: client.status,
              notes: client.notes,
            }}
          />
        )}
      </div>

      {showFinancials && mtd && (
        <section className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Financial Summary &middot; This Month</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
            <KpiCard label="Revenue" value={formatUSD(mtd.totalRevenue)} icon={DollarSign} href={`/revenue?client=${client.id}`} />
            <KpiCard label="Received" value={formatUSD(mtd.amountReceived)} icon={Landmark} />
            <KpiCard label="Outstanding" value={formatUSD(mtd.outstanding)} icon={Landmark} href={`/receivables?client=${client.id}`} />
            <KpiCard label="Overdue" value={formatUSD(mtd.overdue)} icon={AlertTriangle} />
            <KpiCard label="Gross Profit" value={formatUSD(mtd.grossProfit)} icon={TrendingUp} />
            <KpiCard label="Margin" value={formatPercent(mtd.margin)} />
          </div>
        </section>
      )}

      {showFinancials && ytd && (
        <section className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Year to Date</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <KpiCard label="Revenue" value={formatUSD(ytd.totalRevenue)} />
            <KpiCard label="Employee Cost" value={formatUSD(ytd.employeeCost)} />
            <KpiCard label="Project Cost" value={formatUSD(ytd.projectCost)} />
            <KpiCard label="Gross Profit" value={formatUSD(ytd.grossProfit)} />
          </div>
        </section>
      )}

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-lg border border-border bg-card p-4">
          <h3 className="text-sm font-semibold mb-3">Account Details</h3>
          <dl className="grid grid-cols-2 gap-y-2 text-sm">
            <dt className="text-muted-foreground">Account Manager</dt>
            <dd className="text-right">{client.accountManager?.name ?? "Unassigned"}</dd>
            <dt className="text-muted-foreground">Email</dt>
            <dd className="text-right">{client.email ?? "—"}</dd>
            <dt className="text-muted-foreground">Phone</dt>
            <dd className="text-right">{client.phone ?? "—"}</dd>
            <dt className="text-muted-foreground">Contract Start</dt>
            <dd className="text-right">{formatDate(client.contractStartDate)}</dd>
            <dt className="text-muted-foreground">Contract End</dt>
            <dd className="text-right">{formatDate(client.contractEndDate)}</dd>
            <dt className="text-muted-foreground">Billing Terms</dt>
            <dd className="text-right">{client.billingTerms ?? "—"}</dd>
          </dl>
        </div>

        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold">Projects</h3>
            <Link href={`/projects?client=${client.id}`} prefetch={false} className="text-xs text-muted-foreground hover:underline">View all</Link>
          </div>
          <div className="space-y-2">
            {projects.length === 0 && <p className="text-sm text-muted-foreground">No projects yet.</p>}
            {projects.map((p) => (
              <Link key={p.id} href={`/projects/${p.id}`} prefetch={false} className="flex items-center justify-between rounded-md px-2.5 py-2 hover:bg-accent/50 text-sm">
                <span>{p.name}</span>
                <StatusBadge status={p.status} />
              </Link>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
