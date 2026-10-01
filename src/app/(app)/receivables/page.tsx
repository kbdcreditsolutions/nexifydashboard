import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { canViewFinancials } from "@/lib/rbac";
import { KpiCard } from "@/components/kpi-card";
import { ChartCard } from "@/components/charts/chart-card";
import { ARAgingChart } from "@/components/charts/ar-aging-chart";
import { ReceivablesTable } from "@/components/payables/receivables-table";
import { accountsReceivableAging } from "@/lib/calc";
import { getSettings } from "@/lib/settings";
import { formatUSD } from "@/lib/format";
import { Landmark, AlertTriangle } from "lucide-react";

export default async function ReceivablesPage({ searchParams }: { searchParams: Promise<{ client?: string }> }) {
  const session = await auth();
  if (!session?.user || !canViewFinancials(session.user.role)) redirect("/dashboard");

  const { client: clientFilter } = await searchParams;
  const [{ summary, rows }, settings] = await Promise.all([
    accountsReceivableAging(new Date(), clientFilter),
    getSettings(),
  ]);

  const largeReceivableThreshold = Number(settings.largeReceivableThreshold);
  const largeCount = rows.filter((r) => r.outstanding >= largeReceivableThreshold).length;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Accounts Receivable</h2>
        <p className="text-sm text-muted-foreground">Outstanding client balances and invoice aging</p>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <KpiCard label="Total Outstanding" value={formatUSD(summary.total)} icon={Landmark} />
        <KpiCard label="Current" value={formatUSD(summary.current)} />
        <KpiCard label="1-30 Days" value={formatUSD(summary.d1_30)} />
        <KpiCard label="31-90 Days" value={formatUSD(summary.d31_60 + summary.d61_90)} />
        <KpiCard label="90+ Days" value={formatUSD(summary.d90plus)} icon={AlertTriangle} />
      </div>
      {largeCount > 0 && (
        <div className="rounded-lg border border-warning/30 bg-warning/10 px-3.5 py-2.5 text-sm text-amber-800 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4" />
          {largeCount} invoice{largeCount === 1 ? "" : "s"} above the large-receivable threshold of {formatUSD(largeReceivableThreshold)}
        </div>
      )}
      <ChartCard title="Receivables Aging" sub="Outstanding balance by age bucket">
        <ARAgingChart summary={summary} />
      </ChartCard>
      <ReceivablesTable rows={rows} />
      <p className="text-xs text-muted-foreground">{rows.length} outstanding invoice line{rows.length === 1 ? "" : "s"}{clientFilter ? " for this client." : " across all clients."}</p>
    </div>
  );
}
