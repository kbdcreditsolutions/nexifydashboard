"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { canManageSettings } from "@/lib/rbac";
import { setSetting, type SettingsMap } from "@/lib/settings";
import bcrypt from "bcryptjs";

async function requireSettingsAccess() {
  const session = await auth();
  if (!session?.user || !canManageSettings(session.user.role)) throw new Error("Not authorized to manage settings.");
  return session;
}

// Role changes are the most sensitive permission in the app (a Finance user
// could otherwise promote themselves to Owner) — restricted to Owner only,
// stricter than the Owner+Finance bar the rest of Settings uses.
async function requireOwner() {
  const session = await auth();
  if (!session?.user || session.user.role !== "OWNER") throw new Error("Only an Owner can change user roles or access.");
  return session;
}

const settingsKeys = [
  "companyName",
  "currency",
  "fiscalYearStart",
  "defaultPaymentTerms",
  "marginThresholdPct",
  "utilizationThresholdPct",
  "cashMinThreshold",
  "largeReceivableThreshold",
  "expenseSpikeThresholdPct",
  "contractExpiringDays",
  "defaultBillingRate",
  "defaultTaxRatePct",
] as const;

export async function updateSettings(formData: FormData) {
  await requireSettingsAccess();
  for (const key of settingsKeys) {
    const value = formData.get(key);
    if (typeof value === "string" && value.length > 0) {
      await setSetting(key as keyof SettingsMap, value);
    }
  }
  revalidatePath("/settings");
}

const categorySchema = z.object({ name: z.string().min(1), group: z.string().min(1) });

export async function createExpenseCategory(formData: FormData) {
  const session = await requireSettingsAccess();
  const parsed = categorySchema.parse(Object.fromEntries(formData));
  const created = await prisma.expenseCategory.create({ data: { name: parsed.name, group: parsed.group, isCustom: true } });
  await prisma.auditLog.create({ data: { entityType: "ExpenseCategory", entityId: created.id, action: "CREATE", userId: session.user.id, changes: JSON.stringify(parsed) } });
  revalidatePath("/settings");
  revalidatePath("/expenses");
}

const userSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  role: z.enum(["OWNER", "FINANCE", "OPERATIONS", "MANAGER", "EMPLOYEE"]),
  password: z.string().min(8),
});

export async function createUser(formData: FormData) {
  const session = await requireSettingsAccess();
  const parsed = userSchema.parse(Object.fromEntries(formData));
  if (parsed.role === "OWNER" && session.user.role !== "OWNER") throw new Error("Only an Owner can grant the Owner role.");
  const passwordHash = await bcrypt.hash(parsed.password, 10);
  const created = await prisma.user.create({ data: { name: parsed.name, email: parsed.email, role: parsed.role, passwordHash } });
  await prisma.auditLog.create({ data: { entityType: "User", entityId: created.id, action: "CREATE", userId: session.user.id, changes: JSON.stringify({ name: parsed.name, email: parsed.email, role: parsed.role }) } });
  revalidatePath("/settings");
}

const roleEnum = z.enum(["OWNER", "FINANCE", "OPERATIONS", "MANAGER", "EMPLOYEE"]);

export async function updateUserRole(userId: string, rawRole: string) {
  const session = await requireOwner();
  const role = roleEnum.parse(rawRole);

  if (userId === session.user.id) throw new Error("You cannot change your own role.");
  if (role !== "OWNER") {
    const target = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (target.role === "OWNER") {
      const ownerCount = await prisma.user.count({ where: { role: "OWNER" } });
      if (ownerCount <= 1) throw new Error("Cannot remove the last Owner.");
    }
  }

  await prisma.user.update({ where: { id: userId }, data: { role } });
  await prisma.auditLog.create({ data: { entityType: "User", entityId: userId, action: "UPDATE", userId: session.user.id, changes: JSON.stringify({ role }) } });
  revalidatePath("/settings");
}

export async function toggleUserActive(userId: string, isActive: boolean) {
  const session = await requireOwner();
  if (userId === session.user.id) throw new Error("You cannot deactivate your own account.");
  await prisma.user.update({ where: { id: userId }, data: { isActive } });
  await prisma.auditLog.create({ data: { entityType: "User", entityId: userId, action: "UPDATE", userId: session.user.id, changes: JSON.stringify({ isActive }) } });
  revalidatePath("/settings");
}
