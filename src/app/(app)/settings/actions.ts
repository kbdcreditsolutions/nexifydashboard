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
  await requireSettingsAccess();
  const parsed = categorySchema.parse(Object.fromEntries(formData));
  await prisma.expenseCategory.create({ data: { name: parsed.name, group: parsed.group, isCustom: true } });
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
  await requireSettingsAccess();
  const parsed = userSchema.parse(Object.fromEntries(formData));
  const passwordHash = await bcrypt.hash(parsed.password, 10);
  await prisma.user.create({ data: { name: parsed.name, email: parsed.email, role: parsed.role, passwordHash } });
  revalidatePath("/settings");
}

export async function updateUserRole(userId: string, role: string) {
  const session = await requireSettingsAccess();
  await prisma.user.update({ where: { id: userId }, data: { role: role as "OWNER" | "FINANCE" | "OPERATIONS" | "MANAGER" | "EMPLOYEE" } });
  await prisma.auditLog.create({ data: { entityType: "User", entityId: userId, action: "UPDATE", userId: session.user.id, changes: JSON.stringify({ role }) } });
  revalidatePath("/settings");
}

export async function toggleUserActive(userId: string, isActive: boolean) {
  await requireSettingsAccess();
  await prisma.user.update({ where: { id: userId }, data: { isActive } });
  revalidatePath("/settings");
}
