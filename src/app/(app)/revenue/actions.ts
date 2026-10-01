"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { canViewFinancials } from "@/lib/rbac";
import { withSequentialCodeRetry } from "@/lib/sequence";

const revenueSchema = z.object({
  clientId: z.string().min(1),
  projectId: z.string().optional(),
  employeeId: z.string().optional(),
  serviceId: z.string().optional(),
  revenueType: z.enum(["HOURLY", "FIXED_PROJECT", "RETAINER", "MILESTONE", "RECURRING", "ONE_TIME_CONSULTING", "OTHER"]),
  date: z.string().min(1),
  amount: z.coerce.number().positive(),
  notes: z.string().optional(),
});

export async function createRevenue(formData: FormData) {
  const session = await auth();
  if (!session?.user || !canViewFinancials(session.user.role)) throw new Error("Not authorized to record revenue.");

  const parsed = revenueSchema.parse(Object.fromEntries(formData));

  const created = await withSequentialCodeRetry(async () => {
    const count = await prisma.revenue.count();
    return prisma.revenue.create({
      data: {
        revenueCode: `REV-${String(count + 1).padStart(5, "0")}`,
        clientId: parsed.clientId,
        projectId: parsed.projectId || null,
        employeeId: parsed.employeeId || null,
        serviceId: parsed.serviceId || null,
        revenueType: parsed.revenueType,
        date: new Date(parsed.date),
        amount: parsed.amount,
        notes: parsed.notes || null,
        paymentStatus: "UNPAID",
      },
    });
  });
  await prisma.auditLog.create({ data: { entityType: "Revenue", entityId: created.id, action: "CREATE", userId: session.user.id, changes: JSON.stringify(parsed) } });

  revalidatePath("/revenue");
}
