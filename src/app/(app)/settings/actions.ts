"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { canManageSettings } from "@/lib/rbac";
import { setSetting, type SettingsMap, MAX_CONTRACT_EXPIRING_DAYS } from "@/lib/settings";
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

const textKeys = ["companyName", "currency", "fiscalYearStart", "defaultPaymentTerms"] as const;

// Every numeric setting is user-editable free text (a plain <input type="number">
// on the client, which is only a UI hint — nothing stops a raw request from
// sending anything). Several of these values feed directly into Prisma Date
// arithmetic (contractExpiringDays), threshold comparisons (marginThresholdPct,
// utilizationThresholdPct), or invoice tax math (defaultTaxRatePct), so each
// gets a bound matched to what it actually means — not one shared ceiling —
// this action is the actual trust boundary, not the form.
const pctSchema = z.coerce.number().finite().min(0).max(100);
// Expense spikes are legitimately >100% (e.g. a category tripling month over
// month), so this one just needs a sane upper bound, not a percent cap.
const spikePctSchema = z.coerce.number().finite().min(0).max(100_000);
const dollarSchema = z.coerce.number().finite().min(0).max(100_000_000);
const contractDaysSchema = z.coerce.number().finite().int().min(0).max(MAX_CONTRACT_EXPIRING_DAYS);

const numericSchemas = {
  marginThresholdPct: pctSchema,
  utilizationThresholdPct: pctSchema,
  defaultTaxRatePct: pctSchema,
  expenseSpikeThresholdPct: spikePctSchema,
  cashMinThreshold: dollarSchema,
  largeReceivableThreshold: dollarSchema,
  defaultBillingRate: dollarSchema,
  contractExpiringDays: contractDaysSchema,
} as const satisfies Record<string, z.ZodType<number>>;

const numericKeys = Object.keys(numericSchemas) as (keyof typeof numericSchemas)[];

export async function updateSettings(formData: FormData) {
  await requireSettingsAccess();

  // Validate every field before writing any of them — otherwise a bad value
  // on e.g. defaultTaxRatePct (last in the form) would leave every field
  // before it already committed to the DB, while the single error toast on
  // the client implies nothing saved.
  const textWrites: [keyof SettingsMap, string][] = [];
  for (const key of textKeys) {
    const value = formData.get(key);
    if (typeof value === "string" && value.trim().length > 0) {
      textWrites.push([key, value.trim()]);
    }
  }

  const numericWrites: [keyof SettingsMap, string][] = [];
  for (const key of numericKeys) {
    const value = formData.get(key);
    if (typeof value === "string" && value.trim().length > 0) {
      const parsed = numericSchemas[key].safeParse(value.trim());
      if (!parsed.success) throw new Error(`${key} must be a valid number.`);
      numericWrites.push([key, String(parsed.data)]);
    }
  }

  for (const [key, value] of [...textWrites, ...numericWrites]) {
    await setSetting(key, value);
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
