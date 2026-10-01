import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<string, string> = {
  // positive / healthy
  ACTIVE: "bg-positive/10 text-positive",
  APPROVED: "bg-positive/10 text-positive",
  PAID: "bg-positive/10 text-positive",
  COMPLETED: "bg-positive/10 text-positive",
  // neutral / in-progress
  DRAFT: "bg-muted text-muted-foreground",
  PLANNING: "bg-muted text-muted-foreground",
  PENDING: "bg-warning/15 text-amber-700",
  SUBMITTED: "bg-chart-1/10 text-chart-1",
  SENT: "bg-chart-1/10 text-chart-1",
  PARTIALLY_PAID: "bg-warning/15 text-amber-700",
  ON_HOLD: "bg-warning/15 text-amber-700",
  OPEN: "bg-chart-1/10 text-chart-1",
  // warning / attention
  INACTIVE: "bg-muted text-muted-foreground",
  CHURNED: "bg-negative/10 text-negative",
  OVERDUE: "bg-negative/10 text-negative",
  REJECTED: "bg-negative/10 text-negative",
  CANCELLED: "bg-muted text-muted-foreground line-through",
  PROSPECT: "bg-chart-5/10 text-chart-5",
};

export function StatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status] ?? "bg-muted text-muted-foreground";
  const label = status.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
  return (
    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap", style)}>
      {label}
    </span>
  );
}
