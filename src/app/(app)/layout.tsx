import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { canViewFinancials } from "@/lib/rbac";
import { computeAlerts } from "@/lib/alerts";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user || !session.user.isActive) redirect("/login");

  const alertCount = canViewFinancials(session.user.role) ? (await computeAlerts()).length : 0;

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="print:hidden">
        <Sidebar role={session.user.role} />
      </div>
      <div className="lg:pl-60 print:pl-0 flex flex-col min-h-screen">
        <div className="print:hidden">
          <Topbar name={session.user.name ?? ""} email={session.user.email ?? ""} role={session.user.role} alertCount={alertCount} />
        </div>
        <main className="flex-1 p-4 lg:p-6 print:p-0 max-w-[1600px] w-full mx-auto">{children}</main>
      </div>
    </div>
  );
}
