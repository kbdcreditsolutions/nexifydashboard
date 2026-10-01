"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { canApproveTimesheets } from "@/lib/rbac";

const entrySchema = z.object({
  date: z.string().min(1),
  employeeId: z.string().min(1),
  clientId: z.string().optional(),
  projectId: z.string().optional(),
  serviceId: z.string().optional(),
  hours: z.coerce.number().positive().max(24),
  billable: z.coerce.boolean().optional(),
  description: z.string().optional(),
});

export async function createTimesheetEntry(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("Not authorized.");
  const parsed = entrySchema.parse(Object.fromEntries(formData));

  await prisma.timesheet.create({
    data: {
      date: new Date(parsed.date),
      employeeId: parsed.employeeId,
      clientId: parsed.clientId || null,
      projectId: parsed.projectId || null,
      serviceId: parsed.serviceId || null,
      hours: parsed.hours,
      billable: parsed.billable ?? true,
      description: parsed.description || null,
      status: "SUBMITTED",
    },
  });

  revalidatePath("/timesheets");
}

const weekSchema = z.object({
  employeeId: z.string().min(1),
  clientId: z.string().optional(),
  projectId: z.string().optional(),
  serviceId: z.string().optional(),
  billable: z.coerce.boolean().optional(),
  weekStart: z.string().min(1),
  mon: z.coerce.number().min(0).max(24).optional(),
  tue: z.coerce.number().min(0).max(24).optional(),
  wed: z.coerce.number().min(0).max(24).optional(),
  thu: z.coerce.number().min(0).max(24).optional(),
  fri: z.coerce.number().min(0).max(24).optional(),
});

export async function createWeeklyTimesheet(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("Not authorized.");
  const parsed = weekSchema.parse(Object.fromEntries(formData));

  const start = new Date(parsed.weekStart);
  const days = [parsed.mon, parsed.tue, parsed.wed, parsed.thu, parsed.fri];

  const rows = days
    .map((hours, i) => {
      if (!hours || hours <= 0) return null;
      const date = new Date(start);
      date.setDate(date.getDate() + i);
      return {
        date,
        employeeId: parsed.employeeId,
        clientId: parsed.clientId || null,
        projectId: parsed.projectId || null,
        serviceId: parsed.serviceId || null,
        hours,
        billable: parsed.billable ?? true,
        status: "SUBMITTED" as const,
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  if (rows.length === 0) throw new Error("Enter at least one day's hours.");

  await prisma.timesheet.createMany({ data: rows });
  revalidatePath("/timesheets");
}

export async function setTimesheetApproval(id: string, status: "APPROVED" | "REJECTED") {
  const session = await auth();
  if (!session?.user || !canApproveTimesheets(session.user.role)) throw new Error("Not authorized to approve timesheets.");

  const ts = await prisma.timesheet.update({
    where: { id },
    data: { status, approvedById: session.user.id, approvedAt: new Date() },
    include: { employee: true, project: { include: { assignments: true } } },
  });

  if (status === "APPROVED" && ts.billable && ts.clientId) {
    const existing = await prisma.revenue.findUnique({ where: { timesheetId: id } });
    if (!existing) {
      const override = ts.project?.assignments.find((a) => a.employeeId === ts.employeeId)?.billingRateOverride;
      const rate = override ? Number(override) : Number(ts.employee.billingRate);
      const count = await prisma.revenue.count();
      await prisma.revenue.create({
        data: {
          revenueCode: `REV-${String(count + 1).padStart(5, "0")}`,
          clientId: ts.clientId,
          projectId: ts.projectId,
          employeeId: ts.employeeId,
          serviceId: ts.serviceId,
          timesheetId: ts.id,
          revenueType: "HOURLY",
          date: ts.date,
          amount: Number(ts.hours) * rate,
          paymentStatus: "UNPAID",
        },
      });
    }
  }

  await prisma.auditLog.create({ data: { entityType: "Timesheet", entityId: id, action: status === "APPROVED" ? "APPROVE" : "REJECT", userId: session.user.id } });
  revalidatePath("/timesheets");
  revalidatePath("/revenue");
}
