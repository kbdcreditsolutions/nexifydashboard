"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { canViewFinancials } from "@/lib/rbac";

const txnSchema = z.object({
  date: z.string().min(1),
  direction: z.enum(["INFLOW", "OUTFLOW"]),
  category: z.string().min(1),
  amount: z.coerce.number().positive(),
  notes: z.string().optional(),
});

export async function createCashTransaction(formData: FormData) {
  const session = await auth();
  if (!session?.user || !canViewFinancials(session.user.role)) throw new Error("Not authorized to record cash transactions.");

  const parsed = txnSchema.parse(Object.fromEntries(formData));
  const created = await prisma.cashTransaction.create({
    data: { date: new Date(parsed.date), direction: parsed.direction, category: parsed.category, amount: parsed.amount, certainty: "ACTUAL", sourceType: "Manual", notes: parsed.notes || null },
  });
  await prisma.auditLog.create({ data: { entityType: "CashTransaction", entityId: created.id, action: "CREATE", userId: session.user.id, changes: JSON.stringify(parsed) } });

  revalidatePath("/cash-flow");
}
