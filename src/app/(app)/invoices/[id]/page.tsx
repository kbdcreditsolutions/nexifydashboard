import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { canViewFinancials } from "@/lib/rbac";
import { StatusBadge } from "@/components/status-badge";
import { PaymentDialog } from "@/components/invoices/payment-dialog";
import { InvoiceStatusActions } from "@/components/invoices/invoice-status-actions";
import { formatUSD, formatDate } from "@/lib/format";

export default async function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user || !canViewFinancials(session.user.role)) redirect("/dashboard");

  const { id } = await params;
  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: { client: true, items: true, payments: { orderBy: { date: "desc" } }, project: true },
  });
  if (!invoice) notFound();

  const paid = invoice.payments.reduce((s, p) => s + Number(p.amount), 0);
  const balance = Math.max(0, Number(invoice.total) - paid);
  const now = new Date();
  const effectiveStatus = (invoice.status === "SENT" || invoice.status === "PARTIALLY_PAID") && invoice.dueDate < now && balance > 0 ? "OVERDUE" : invoice.status;

  return (
    <div className="space-y-5 max-w-3xl">
      <Link href="/invoices" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to Invoices
      </Link>

      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-xl font-semibold text-foreground">{invoice.invoiceNumber}</h2>
            <StatusBadge status={effectiveStatus} />
          </div>
          <p className="text-sm text-muted-foreground">
            <Link href={`/clients/${invoice.clientId}`} className="hover:underline">{invoice.client.name}</Link>
            {invoice.project && <> &middot; {invoice.project.name}</>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <InvoiceStatusActions id={invoice.id} status={invoice.status} />
          {balance > 0 && invoice.status !== "CANCELLED" && <PaymentDialog invoiceId={invoice.id} maxAmount={balance} />}
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-5 space-y-4">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">Invoice Date</p>
            <p className="font-medium">{formatDate(invoice.invoiceDate)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Due Date</p>
            <p className="font-medium">{formatDate(invoice.dueDate)}</p>
          </div>
        </div>

        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-xs text-muted-foreground">
              <th className="text-left py-1.5">Description</th>
              <th className="text-right py-1.5">Qty</th>
              <th className="text-right py-1.5">Unit Price</th>
              <th className="text-right py-1.5">Amount</th>
            </tr>
          </thead>
          <tbody>
            {invoice.items.map((item) => (
              <tr key={item.id} className="border-b border-border last:border-0">
                <td className="py-2">{item.description}</td>
                <td className="py-2 text-right tabular-nums">{Number(item.quantity)}</td>
                <td className="py-2 text-right tabular-nums">{formatUSD(item.unitPrice)}</td>
                <td className="py-2 text-right tabular-nums">{formatUSD(item.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="flex justify-end">
          <dl className="w-56 space-y-1.5 text-sm">
            <div className="flex justify-between"><dt className="text-muted-foreground">Subtotal</dt><dd className="tabular-nums">{formatUSD(invoice.subtotal)}</dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">Tax ({Number(invoice.taxRate)}%)</dt><dd className="tabular-nums">{formatUSD(invoice.taxAmount)}</dd></div>
            <div className="flex justify-between font-semibold border-t border-border pt-1.5"><dt>Total</dt><dd className="tabular-nums">{formatUSD(invoice.total)}</dd></div>
            <div className="flex justify-between text-positive"><dt>Paid</dt><dd className="tabular-nums">{formatUSD(paid)}</dd></div>
            <div className="flex justify-between font-semibold"><dt>Balance</dt><dd className="tabular-nums">{formatUSD(balance)}</dd></div>
          </dl>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-4">
        <h3 className="text-sm font-semibold mb-3">Payment History</h3>
        {invoice.payments.length === 0 && <p className="text-sm text-muted-foreground">No payments recorded yet.</p>}
        {invoice.payments.length > 0 && (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted-foreground">
                <th className="text-left py-1.5">Date</th>
                <th className="text-left py-1.5">Method</th>
                <th className="text-left py-1.5">Reference</th>
                <th className="text-right py-1.5">Amount</th>
              </tr>
            </thead>
            <tbody>
              {invoice.payments.map((p) => (
                <tr key={p.id} className="border-b border-border last:border-0">
                  <td className="py-1.5">{formatDate(p.date)}</td>
                  <td className="py-1.5">{p.method ?? "—"}</td>
                  <td className="py-1.5">{p.reference ?? "—"}</td>
                  <td className="py-1.5 text-right tabular-nums">{formatUSD(p.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
