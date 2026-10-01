import Link from "next/link";
import { ArrowUpRight, ArrowDownRight, Minus, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface KpiCardProps {
  label: string;
  value: string;
  change?: { label: string; direction: "up" | "down" | "flat" };
  changeGoodDirection?: "up" | "down";
  icon?: LucideIcon;
  href?: string;
  sub?: string;
}

export function KpiCard({ label, value, change, changeGoodDirection = "up", icon: Icon, href, sub }: KpiCardProps) {
  const isGood = change && change.direction !== "flat" && change.direction === changeGoodDirection;
  const isBad = change && change.direction !== "flat" && change.direction !== changeGoodDirection;

  const content = (
    <div className="rounded-lg border border-border bg-card p-4 h-full flex flex-col gap-1.5 transition-colors hover:border-foreground/20">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        {Icon && <Icon className="h-3.5 w-3.5 text-muted-foreground" />}
      </div>
      <div className="text-2xl font-semibold tabular-nums tracking-tight text-foreground">{value}</div>
      <div className="flex items-center gap-1 h-4">
        {change && (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 text-xs font-medium tabular-nums",
              isGood && "text-positive",
              isBad && "text-negative",
              !isGood && !isBad && "text-muted-foreground"
            )}
          >
            {change.direction === "up" && <ArrowUpRight className="h-3 w-3" />}
            {change.direction === "down" && <ArrowDownRight className="h-3 w-3" />}
            {change.direction === "flat" && <Minus className="h-3 w-3" />}
            {change.label}
          </span>
        )}
        {sub && <span className="text-xs text-muted-foreground">{sub}</span>}
      </div>
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block h-full">
        {content}
      </Link>
    );
  }
  return content;
}
