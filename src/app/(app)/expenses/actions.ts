"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { canApproveExpenses } from "@/lib/rbac";

const expenseSchema = z.object({
  date: z.string().min(1),
  categoryId: z.string().min(1),
  subcategory: z.string().optional(),
  vendorId: z.string().optional(),
  amount: z.coerce.number().positive(),
  paymentMethod: z.string().optional(),
  paidBy: z.enum(["COMPANY", "EMPLOYEE"]),
  employeeId: z.string().optional(),
  clientId: z.string().optional(),
  projectId: z.string().optional(),
  recurring: z.coerce.boolean().optional(),
  receiptUrl: z.string().optional(),
  notes: z.string().optional(),
});

export async function createExpense(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("Not authorized.");

  const parsed = expenseSchema.parse(Object.fromEntries(formData));
  const count = await prisma.expense.count();

  const created = await prisma.expense.create({
    data: {
      expenseCode: `EXP-${String(count + 1).padStart(5, "0")}`,
      date: new Date(parsed.date),
      categoryId: parsed.categoryId,
      subcategory: parsed.subcategory || null,
      vendorId: parsed.vendorId || null,
      amount: parsed.amount,
      paymentMethod: parsed.paymentMethod || null,
      paidBy: parsed.paidBy,
      employeeId: parsed.employeeId || null,
      clientId: parsed.clientId || null,
      projectId: parsed.projectId || null,
      recurring: parsed.recurring ?? false,
      receiptUrl: parsed.receiptUrl || null,
      notes: parsed.notes || null,
      approvalStatus: "PENDING",
    },
  });
  await prisma.auditLog.create({ data: { entityType: "Expense", entityId: created.id, action: "CREATE", userId: session.user.id, changes: JSON.stringify(parsed) } });

  revalidatePath("/expenses");
}

export async function setExpenseApproval(id: string, status: "APPROVED" | "REJECTED") {
  const session = await auth();
  if (!session?.user || !canApproveExpenses(session.user.role)) throw new Error("Not authorized to approve expenses.");

  await prisma.expense.update({
    where: { id },
    data: { approvalStatus: status, approvedById: session.user.id, approvedAt: new Date() },
  });
  await prisma.auditLog.create({ data: { entityType: "Expense", entityId: id, action: status === "APPROVED" ? "APPROVE" : "REJECT", userId: session.user.id } });

  revalidatePath("/expenses");
}
