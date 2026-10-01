import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { canViewFinancials } from "@/lib/rbac";
import { InvoiceGenerateDialog } from "@/components/invoices/invoice-generate-dialog";
import { InvoicesTable, type InvoiceRow } from "@/components/invoices/invoices-table";
import { KpiCard } from "@/components/kpi-card";
import { getSettings } from "@/lib/settings";
import { formatUSD } from "@/lib/format";
import { FileText, Landmark } from "lucide-react";

export default async function InvoicesPage() {
  const session = await auth();
  if (!session?.user || !canViewFinancials(session.user.role)) redirect("/dashboard");

  const [invoices, clients, settings] = await Promise.all([
    prisma.invoice.findMany({ include: { client: true, payments: true }, orderBy: { invoiceDate: "desc" } }),
    prisma.client.findMany({ where: { deletedAt: null }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    getSettings(),
  ]);

  const now = new Date();
  const rows: InvoiceRow[] = invoices.map((inv) => {
    const paid = inv.payments.reduce((s, p) => s + Number(p.amount), 0);
    const balance = Math.max(0, Number(inv.total) - paid);
    const effectiveStatus = (inv.status === "SENT" || inv.status === "PARTIALLY_PAID") && inv.dueDate < now && balance > 0 ? "OVERDUE" : inv.status;
    return {
      id: inv.id,
      invoiceNumber: inv.invoiceNumber,
      clientName: inv.client.name,
      invoiceDate: inv.invoiceDate.toISOString(),
      dueDate: inv.dueDate.toISOString(),
      total: Number(inv.total),
      paid,
      balance,
      status: effectiveStatus,
    };
  });

  const totalOutstanding = rows.reduce((s, r) => s + r.balance, 0);
  const totalInvoiced = rows.reduce((s, r) => s + r.total, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Invoices</h2>
          <p className="text-sm text-muted-foreground">Invoice management, generated from approved revenue</p>
        </div>
        <InvoiceGenerateDialog clients={clients} defaultTaxRate={Number(settings.defaultTaxRatePct)} />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard label="Total Invoiced" value={formatUSD(totalInvoiced)} icon={FileText} />
        <KpiCard label="Outstanding Balance" value={formatUSD(totalOutstanding)} icon={Landmark} />
      </div>
      <InvoicesTable rows={rows} />
    </div>
  );
}
