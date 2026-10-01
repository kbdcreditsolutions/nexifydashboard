"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { canViewFinancials } from "@/lib/rbac";

const payableSchema = z.object({
  vendorId: z.string().min(1),
  invoiceRef: z.string().optional(),
  amount: z.coerce.number().positive(),
  dueDate: z.string().min(1),
});

export async function createPayable(formData: FormData) {
  const session = await auth();
  if (!session?.user || !canViewFinancials(session.user.role)) throw new Error("Not authorized to manage payables.");

  const parsed = payableSchema.parse(Object.fromEntries(formData));
  const created = await prisma.accountsPayable.create({
    data: {
      vendorId: parsed.vendorId,
      invoiceRef: parsed.invoiceRef || null,
      amount: parsed.amount,
      dueDate: new Date(parsed.dueDate),
      paidAmount: 0,
      balance: parsed.amount,
      status: "OPEN",
    },
  });
  await prisma.auditLog.create({ data: { entityType: "AccountsPayable", entityId: created.id, action: "CREATE", userId: session.user.id, changes: JSON.stringify(parsed) } });

  revalidatePath("/payables");
}

export async function recordPayablePayment(id: string, amount: number) {
  const session = await auth();
  if (!session?.user || !canViewFinancials(session.user.role)) throw new Error("Not authorized to record payments.");

  const payable = await prisma.accountsPayable.findUniqueOrThrow({ where: { id } });
  const newPaid = Number(payable.paidAmount) + amount;
  const newBalance = Math.max(0, Number(payable.amount) - newPaid);
  const status = newBalance <= 0.01 ? "PAID" : newPaid > 0 ? "PARTIALLY_PAID" : "OPEN";

  await prisma.accountsPayable.update({ where: { id }, data: { paidAmount: newPaid, balance: newBalance, status } });
  await prisma.cashTransaction.create({
    data: { date: new Date(), direction: "OUTFLOW", category: "Vendor Payments", amount, certainty: "ACTUAL", sourceType: "AccountsPayable", sourceId: id },
  });
  await prisma.auditLog.create({ data: { entityType: "AccountsPayable", entityId: id, action: "UPDATE", userId: session.user.id, changes: JSON.stringify({ paymentRecorded: amount }) } });

  revalidatePath("/payables");
  revalidatePath("/cash-flow");
}
