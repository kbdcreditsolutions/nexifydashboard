import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertTriangle, AlertCircle, Info } from "lucide-react";
import { auth } from "@/auth";
import { canViewFinancials } from "@/lib/rbac";
import { computeAlerts } from "@/lib/alerts";
import { cn } from "@/lib/utils";

const SEVERITY_STYLE: Record<string, string> = {
  CRITICAL: "border-negative/30 bg-negative/5 text-red-900",
  WARNING: "border-warning/30 bg-warning/5 text-amber-900",
  INFO: "border-border bg-card text-foreground",
};

const SEVERITY_ICON = { CRITICAL: AlertCircle, WARNING: AlertTriangle, INFO: Info };

export default async function AlertsPage() {
  const session = await auth();
  if (!session?.user || !canViewFinancials(session.user.role)) redirect("/dashboard");

  const alerts = await computeAlerts();
  const critical = alerts.filter((a) => a.severity === "CRITICAL").length;
  const warning = alerts.filter((a) => a.severity === "WARNING").length;
  const info = alerts.filter((a) => a.severity === "INFO").length;

  return (
    <div className="space-y-4 max-w-3xl">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Alerts</h2>
        <p className="text-sm text-muted-foreground">
          {critical} critical &middot; {warning} warning &middot; {info} informational — computed live against your configured thresholds in{" "}
          <Link href="/settings" className="underline underline-offset-2">Settings</Link>
        </p>
      </div>

      {alerts.length === 0 && (
        <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          No active alerts. Everything is within configured thresholds.
        </div>
      )}

      <div className="space-y-2">
        {alerts.map((a, i) => {
          const Icon = SEVERITY_ICON[a.severity];
          const content = (
            <div className={cn("flex items-start gap-3 rounded-lg border px-3.5 py-3 text-sm", SEVERITY_STYLE[a.severity])}>
              <Icon className="h-4 w-4 mt-0.5 shrink-0" />
              <div className="flex-1">
                <p>{a.message}</p>
                <p className="text-xs opacity-60 mt-0.5">{a.type.replace(/_/g, " ")}</p>
              </div>
            </div>
          );
          return a.href ? (
            <Link key={i} href={a.href} className="block hover:opacity-80 transition-opacity">
              {content}
            </Link>
          ) : (
            <div key={i}>{content}</div>
          );
        })}
      </div>
    </div>
  );
}
