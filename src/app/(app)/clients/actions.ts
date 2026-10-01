"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { canManageMasterData } from "@/lib/rbac";

const clientSchema = z.object({
  clientCode: z.string().min(1),
  name: z.string().min(1),
  contactPerson: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  contractStartDate: z.string().optional(),
  contractEndDate: z.string().optional(),
  paymentTerms: z.string().min(1),
  billingTerms: z.string().optional(),
  accountManagerId: z.string().optional(),
  status: z.enum(["ACTIVE", "INACTIVE", "PROSPECT", "CHURNED"]),
  notes: z.string().optional(),
});

export async function upsertClient(id: string | null, formData: FormData) {
  const session = await auth();
  if (!session?.user || !canManageMasterData(session.user.role)) throw new Error("Not authorized to manage clients.");

  const raw = Object.fromEntries(formData);
  const parsed = clientSchema.parse(raw);
  const data = {
    clientCode: parsed.clientCode,
    name: parsed.name,
    contactPerson: parsed.contactPerson || null,
    email: parsed.email || null,
    phone: parsed.phone || null,
    contractStartDate: parsed.contractStartDate ? new Date(parsed.contractStartDate) : null,
    contractEndDate: parsed.contractEndDate ? new Date(parsed.contractEndDate) : null,
    paymentTerms: parsed.paymentTerms,
    billingTerms: parsed.billingTerms || null,
    accountManagerId: parsed.accountManagerId || null,
    status: parsed.status,
    notes: parsed.notes || null,
  };

  if (id) {
    await prisma.client.update({ where: { id }, data });
    await prisma.auditLog.create({ data: { entityType: "Client", entityId: id, action: "UPDATE", userId: session.user.id, changes: JSON.stringify(data) } });
  } else {
    const created = await prisma.client.create({ data });
    await prisma.auditLog.create({ data: { entityType: "Client", entityId: created.id, action: "CREATE", userId: session.user.id, changes: JSON.stringify(data) } });
  }

  revalidatePath("/clients");
}

export async function archiveClient(id: string) {
  const session = await auth();
  if (!session?.user || !canManageMasterData(session.user.role)) throw new Error("Not authorized to manage clients.");
  await prisma.client.update({ where: { id }, data: { status: "INACTIVE" } });
  await prisma.auditLog.create({ data: { entityType: "Client", entityId: id, action: "UPDATE", userId: session.user.id, changes: JSON.stringify({ status: "INACTIVE" }) } });
  revalidatePath("/clients");
}
