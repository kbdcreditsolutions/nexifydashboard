"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { canViewFinancials } from "@/lib/rbac";
import { getSettings } from "@/lib/settings";
import { withSequentialCodeRetry } from "@/lib/sequence";

const generateSchema = z.object({
  clientId: z.string().min(1),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  taxRatePct: z.coerce.number().min(0).max(100).optional(),
});

export async function generateInvoiceFromRevenue(formData: FormData) {
  const session = await auth();
  if (!session?.user || !canViewFinancials(session.user.role)) throw new Error("Not authorized to create invoices.");

  const parsed = generateSchema.parse(Object.fromEntries(formData));
  const start = new Date(parsed.startDate);
  const end = new Date(parsed.endDate);
  end.setHours(23, 59, 59, 999);

  const revenues = await prisma.revenue.findMany({
    where: { clientId: parsed.clientId, date: { gte: start, lte: end }, invoiceId: null },
    include: { project: true, service: true },
  });
  if (revenues.length === 0) throw new Error("No un-invoiced revenue found for this client in the selected range.");

  const settings = await getSettings();
  const client = await prisma.client.findUniqueOrThrow({ where: { id: parsed.clientId } });

  const grouped = new Map<string, number>();
  for (const r of revenues) {
    const key = `${r.project?.name ?? "General"} — ${r.service?.name ?? "Services"}`;
    grouped.set(key, (grouped.get(key) ?? 0) + Number(r.amount));
  }

  const subtotal = Math.round(revenues.reduce((s, r) => s + Number(r.amount), 0) * 100) / 100;
  const taxRate = parsed.taxRatePct ?? Number(settings.defaultTaxRatePct);
  const taxAmount = Math.round(subtotal * (taxRate / 100) * 100) / 100;
  const total = Math.round((subtotal + taxAmount) * 100) / 100;

  const termsDays = client.paymentTerms === "Net 15" ? 15 : client.paymentTerms === "Net 45" ? 45 : client.paymentTerms === "Net 60" ? 60 : client.paymentTerms === "Due on Receipt" ? 0 : 30;
  const invoiceDate = new Date();
  const dueDate = new Date(invoiceDate.getTime() + termsDays * 86400000);

  const invoice = await withSequentialCodeRetry(async () => {
    const count = await prisma.invoice.count();
    return prisma.invoice.create({
      data: {
        invoiceNumber: `INV-${invoiceDate.getFullYear()}-${String(count + 1).padStart(4, "0")}`,
        clientId: parsed.clientId,
        invoiceDate,
        dueDate,
        subtotal,
        taxRate,
        taxAmount,
        total,
        status: "DRAFT",
        items: { create: Array.from(grouped.entries()).map(([desc, amt]) => ({ description: desc, quantity: 1, unitPrice: amt, amount: amt })) },
      },
    });
  });

  await prisma.revenue.updateMany({ where: { id: { in: revenues.map((r) => r.id) } }, data: { invoiceId: invoice.id } });
  await prisma.auditLog.create({ data: { entityType: "Invoice", entityId: invoice.id, action: "CREATE", userId: session.user.id, changes: JSON.stringify({ total, lineItems: grouped.size }) } });

  revalidatePath("/invoices");
  revalidatePath("/revenue");
  return invoice.id;
}

export async function setInvoiceStatus(id: string, status: "SENT" | "CANCELLED") {
  const session = await auth();
  if (!session?.user || !canViewFinancials(session.user.role)) throw new Error("Not authorized.");

  await prisma.$transaction(async (tx) => {
    await tx.invoice.update({ where: { id }, data: { status } });
    if (status === "CANCELLED") {
      // Unlink the revenue this invoice was carrying so it becomes
      // un-invoiced again (generateInvoiceFromRevenue only picks up rows
      // with invoiceId: null) instead of being permanently stranded off
      // both the invoice list and every future invoice run.
      await tx.revenue.updateMany({ where: { invoiceId: id }, data: { invoiceId: null, paymentStatus: "UNPAID" } });
    }
    await tx.auditLog.create({ data: { entityType: "Invoice", entityId: id, action: "UPDATE", userId: session.user.id, changes: JSON.stringify({ status }) } });
  });

  revalidatePath("/invoices");
  revalidatePath(`/invoices/${id}`);
  revalidatePath("/revenue");
}

const paymentSchema = z.object({
  date: z.string().min(1),
  amount: z.coerce.number().positive(),
  method: z.string().optional(),
  reference: z.string().optional(),
  notes: z.string().optional(),
});

export async function recordPayment(invoiceId: string, formData: FormData) {
  const session = await auth();
  if (!session?.user || !canViewFinancials(session.user.role)) throw new Error("Not authorized to record payments.");

  const parsed = paymentSchema.parse(Object.fromEntries(formData));

  // Everything below must be one atomic unit — a payment row, the invoice's
  // status, linked revenue's payment status, and the cash inflow all have to
  // agree, or a crash mid-way would record cash that was never actually
  // reflected on the invoice. Re-reading the invoice+payments inside the
  // transaction (rather than trusting a snapshot fetched before the write)
  // also closes the race where two payments submitted back-to-back both
  // compute totalPaid off the same stale balance.
  await prisma.$transaction(async (tx) => {
    const invoice = await tx.invoice.findUniqueOrThrow({ where: { id: invoiceId }, include: { payments: true } });
    if (invoice.status === "CANCELLED") throw new Error("Cannot record a payment against a cancelled invoice.");

    const alreadyPaid = invoice.payments.reduce((s, p) => s + Number(p.amount), 0);
    const remainingBalance = Math.max(0, Number(invoice.total) - alreadyPaid);
    if (remainingBalance <= 0) throw new Error("This invoice is already paid in full.");

    // Clamp to the outstanding balance — the dialog's max attribute is a UI
    // hint only, the server must not trust a client-supplied amount.
    const amount = Math.min(parsed.amount, remainingBalance);

    await tx.payment.create({
      data: { invoiceId, date: new Date(parsed.date), amount, method: parsed.method || null, reference: parsed.reference || null, notes: parsed.notes || null },
    });

    const totalPaid = alreadyPaid + amount;
    const newStatus = totalPaid >= Number(invoice.total) - 0.01 ? "PAID" : totalPaid > 0 ? "PARTIALLY_PAID" : invoice.status;
    await tx.invoice.update({ where: { id: invoiceId }, data: { status: newStatus } });
    await tx.revenue.updateMany({ where: { invoiceId }, data: { paymentStatus: newStatus === "PAID" ? "PAID" : newStatus === "PARTIALLY_PAID" ? "PARTIALLY_PAID" : "UNPAID" } });

    await tx.cashTransaction.create({
      data: { date: new Date(parsed.date), direction: "INFLOW", category: "Client Payments", amount, certainty: "ACTUAL", sourceType: "Payment", sourceId: invoiceId, notes: `${invoice.invoiceNumber} payment` },
    });

    await tx.auditLog.create({ data: { entityType: "Invoice", entityId: invoiceId, action: "UPDATE", userId: session.user.id, changes: JSON.stringify({ paymentRecorded: amount }) } });
  });

  revalidatePath("/invoices");
  revalidatePath(`/invoices/${invoiceId}`);
  revalidatePath("/receivables");
  revalidatePath("/cash-flow");
}
