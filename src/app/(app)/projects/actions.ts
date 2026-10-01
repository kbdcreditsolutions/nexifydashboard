"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { canManageMasterData } from "@/lib/rbac";

const projectSchema = z.object({
  projectCode: z.string().min(1),
  name: z.string().min(1),
  clientId: z.string().min(1),
  projectManagerId: z.string().optional(),
  serviceId: z.string().optional(),
  startDate: z.string().min(1),
  endDate: z.string().optional(),
  billingModel: z.enum(["HOURLY", "FIXED", "RETAINER", "MILESTONE"]),
  contractValue: z.coerce.number().min(0),
  budget: z.coerce.number().min(0),
  estimatedHours: z.coerce.number().min(0),
  marginThresholdPct: z.coerce.number().min(0).max(100),
  status: z.enum(["PLANNING", "ACTIVE", "ON_HOLD", "COMPLETED", "CANCELLED"]),
  notes: z.string().optional(),
});

export async function upsertProject(id: string | null, formData: FormData) {
  const session = await auth();
  if (!session?.user || !canManageMasterData(session.user.role)) throw new Error("Not authorized to manage projects.");

  const parsed = projectSchema.parse(Object.fromEntries(formData));
  const data = {
    projectCode: parsed.projectCode,
    name: parsed.name,
    clientId: parsed.clientId,
    projectManagerId: parsed.projectManagerId || null,
    serviceId: parsed.serviceId || null,
    startDate: new Date(parsed.startDate),
    endDate: parsed.endDate ? new Date(parsed.endDate) : null,
    billingModel: parsed.billingModel,
    contractValue: parsed.contractValue,
    budget: parsed.budget,
    estimatedHours: parsed.estimatedHours,
    marginThresholdPct: parsed.marginThresholdPct,
    status: parsed.status,
    notes: parsed.notes || null,
  };

  if (id) {
    await prisma.project.update({ where: { id }, data });
    await prisma.auditLog.create({ data: { entityType: "Project", entityId: id, action: "UPDATE", userId: session.user.id, changes: JSON.stringify(data) } });
  } else {
    const created = await prisma.project.create({ data });
    await prisma.auditLog.create({ data: { entityType: "Project", entityId: created.id, action: "CREATE", userId: session.user.id, changes: JSON.stringify(data) } });
  }

  revalidatePath("/projects");
}

export async function assignEmployeeToProject(projectId: string, employeeId: string) {
  const session = await auth();
  if (!session?.user || !canManageMasterData(session.user.role)) throw new Error("Not authorized.");
  await prisma.projectAssignment.upsert({
    where: { projectId_employeeId: { projectId, employeeId } },
    create: { projectId, employeeId },
    update: {},
  });
  revalidatePath(`/projects/${projectId}`);
}

export async function removeEmployeeFromProject(projectId: string, employeeId: string) {
  const session = await auth();
  if (!session?.user || !canManageMasterData(session.user.role)) throw new Error("Not authorized.");
  await prisma.projectAssignment.delete({ where: { projectId_employeeId: { projectId, employeeId } } }).catch(() => {});
  revalidatePath(`/projects/${projectId}`);
}
