import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { canManageSettings } from "@/lib/rbac";
import { getSettings } from "@/lib/settings";
import { SettingsForm } from "@/components/settings/settings-form";
import { CategoryManager } from "@/components/settings/category-manager";
import { UsersManager } from "@/components/settings/users-manager";

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user || !canManageSettings(session.user.role)) redirect("/dashboard");

  const [settings, categories, users] = await Promise.all([
    getSettings(),
    prisma.expenseCategory.findMany({ orderBy: { name: "asc" } }),
    prisma.user.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Settings</h2>
        <p className="text-sm text-muted-foreground">Company profile, financial configuration, categories, and user access</p>
      </div>
      <SettingsForm settings={settings} />
      <CategoryManager categories={categories} />
      <UsersManager
        users={users.map((u) => ({ id: u.id, name: u.name, email: u.email, role: u.role, isActive: u.isActive }))}
        currentUserId={session.user.id}
      />
    </div>
  );
}
