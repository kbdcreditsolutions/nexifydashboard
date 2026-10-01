"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS } from "@/lib/nav";
import { canViewFinancials, canManageSettings } from "@/lib/rbac";
import { cn } from "@/lib/utils";
import { Building2 } from "lucide-react";

export function Sidebar({ role }: { role: string }) {
  const pathname = usePathname();

  const items = NAV_ITEMS.filter((item) => {
    if (item.settingsOnly) return canManageSettings(role);
    if (item.financialOnly) return canViewFinancials(role);
    return true;
  });

  return (
    <aside className="hidden lg:flex lg:w-60 lg:flex-col lg:fixed lg:inset-y-0 bg-sidebar text-sidebar-foreground border-r border-sidebar-border">
      <div className="flex items-center gap-2 px-5 h-16 border-b border-sidebar-border shrink-0">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground">
          <Building2 className="h-4.5 w-4.5" />
        </div>
        <div className="leading-tight">
          <div className="text-sm font-semibold tracking-tight">Nexify</div>
          <div className="text-[11px] text-sidebar-foreground/60">Operations & Finance</div>
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto py-3 px-2.5 space-y-0.5">
        {items.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="px-4 py-3 border-t border-sidebar-border text-[11px] text-sidebar-foreground/50">
        Nexify InfoSystems &middot; Internal
      </div>
    </aside>
  );
}
