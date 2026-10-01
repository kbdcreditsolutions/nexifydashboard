"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { canManageEmployees } from "@/lib/rbac";

const employeeSchema = z.object({
  employeeCode: z.string().min(1),
  name: z.string().min(1),
  email: z.string().email(),
  role: z.string().min(1),
  department: z.string().min(1),
  employmentType: z.enum(["FULL_TIME", "PART_TIME", "CONTRACTOR"]),
  joiningDate: z.string().min(1),
  status: z.enum(["ACTIVE", "INACTIVE", "TERMINATED"]),
  monthlyCost: z.coerce.number().min(0),
  hourlyCost: z.coerce.number().min(0),
  standardWeeklyHours: z.coerce.number().min(0),
  billingRate: z.coerce.number().min(0),
  notes: z.string().optional(),
});

export async function upsertEmployee(id: string | null, formData: FormData) {
  const session = await auth();
  if (!session?.user || !canManageEmployees(session.user.role)) {
    throw new Error("Not authorized to manage employees.");
  }

  const parsed = employeeSchema.parse(Object.fromEntries(formData));

  if (id) {
    await prisma.employee.update({
      where: { id },
      data: { ...parsed, joiningDate: new Date(parsed.joiningDate) },
    });
    await prisma.auditLog.create({
      data: { entityType: "Employee", entityId: id, action: "UPDATE", userId: session.user.id, changes: JSON.stringify(parsed) },
    });
  } else {
    const created = await prisma.employee.create({
      data: { ...parsed, joiningDate: new Date(parsed.joiningDate) },
    });
    await prisma.auditLog.create({
      data: { entityType: "Employee", entityId: created.id, action: "CREATE", userId: session.user.id, changes: JSON.stringify(parsed) },
    });
  }

  revalidatePath("/employees");
}

export async function deactivateEmployee(id: string) {
  const session = await auth();
  if (!session?.user || !canManageEmployees(session.user.role)) {
    throw new Error("Not authorized to manage employees.");
  }
  // Status-only change, not a soft delete: an inactive/terminated employee
  // must stay visible in lists and historical reports (their past
  // timesheets/revenue/cost remain attributable), so deletedAt is untouched.
  await prisma.employee.update({ where: { id }, data: { status: "INACTIVE" } });
  await prisma.auditLog.create({ data: { entityType: "Employee", entityId: id, action: "UPDATE", userId: session.user.id, changes: JSON.stringify({ status: "INACTIVE" }) } });
  revalidatePath("/employees");
}
