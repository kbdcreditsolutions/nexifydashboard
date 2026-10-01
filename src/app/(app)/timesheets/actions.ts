"use server";

import { z } from "zod";
import type { Session } from "next-auth";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { canApproveTimesheets } from "@/lib/rbac";
import { withSequentialCodeRetry } from "@/lib/sequence";

/**
 * Resolves which employeeId a timesheet entry may be logged against for the
 * current session. Approvers (managers and above) may log time for anyone —
 * they're trusted to log on a teammate's behalf. Everyone else can only log
 * against their own linked Employee record, regardless of what employeeId
 * the form submitted, so an EMPLOYEE-role user can't attribute hours (and
 * the revenue/cost that flow from them) to a colleague.
 */
async function resolveEmployeeIdForEntry(session: Session, requestedEmployeeId: string): Promise<string> {
  if (canApproveTimesheets(session.user.role)) return requestedEmployeeId;

  const own = await prisma.employee.findUnique({ where: { userId: session.user.id } });
  if (!own) throw new Error("No employee record is linked to your account.");
  return own.id;
}

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
  const employeeId = await resolveEmployeeIdForEntry(session, parsed.employeeId);

  await prisma.timesheet.create({
    data: {
      date: new Date(parsed.date),
      employeeId,
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
  const employeeId = await resolveEmployeeIdForEntry(session, parsed.employeeId);

  const start = new Date(parsed.weekStart);
  const days = [parsed.mon, parsed.tue, parsed.wed, parsed.thu, parsed.fri];

  const rows = days
    .map((hours, i) => {
      if (!hours || hours <= 0) return null;
      const date = new Date(start);
      date.setDate(date.getDate() + i);
      return {
        date,
        employeeId,
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

  const existing = await prisma.timesheet.findUniqueOrThrow({ where: { id }, include: { employee: true } });
  if (existing.employee.userId === session.user.id) throw new Error("You cannot approve or reject your own timesheet.");

  const ts = await prisma.timesheet.update({
    where: { id },
    data: { status, approvedById: session.user.id, approvedAt: new Date() },
    include: { employee: true, project: { include: { assignments: true } } },
  });

  if (status === "APPROVED" && ts.billable && ts.clientId) {
    const clientId = ts.clientId;
    const existingRevenue = await prisma.revenue.findUnique({ where: { timesheetId: id } });
    if (!existingRevenue) {
      const override = ts.project?.assignments.find((a) => a.employeeId === ts.employeeId)?.billingRateOverride;
      const rate = override ? Number(override) : Number(ts.employee.billingRate);
      await withSequentialCodeRetry(async () => {
        const count = await prisma.revenue.count();
        return prisma.revenue.create({
          data: {
            revenueCode: `REV-${String(count + 1).padStart(5, "0")}`,
            clientId,
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
      });
    }
  } else if (status === "REJECTED") {
    // A timesheet that was previously approved (and so already minted a
    // Revenue row) and is now rejected must retract that revenue — otherwise
    // rejected hours keep counting in the P&L and client/project margins
    // forever. Only retract if it was never invoiced/paid.
    const linkedRevenue = await prisma.revenue.findUnique({ where: { timesheetId: id } });
    if (linkedRevenue && !linkedRevenue.invoiceId) {
      await prisma.revenue.delete({ where: { id: linkedRevenue.id } });
    }
  }

  await prisma.auditLog.create({ data: { entityType: "Timesheet", entityId: id, action: status === "APPROVED" ? "APPROVE" : "REJECT", userId: session.user.id } });
  revalidatePath("/timesheets");
  revalidatePath("/revenue");
}
