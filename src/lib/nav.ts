import {
  LayoutDashboard,
  DollarSign,
  Users,
  Building2,
  FolderKanban,
  Clock,
  Receipt,
  FileText,
  Landmark,
  Wallet,
  TrendingUp,
  PieChart,
  BarChart3,
  Settings,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  financialOnly?: boolean;
  settingsOnly?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Revenue", href: "/revenue", icon: DollarSign, financialOnly: true },
  { label: "Employees", href: "/employees", icon: Users },
  { label: "Clients", href: "/clients", icon: Building2 },
  { label: "Projects", href: "/projects", icon: FolderKanban },
  { label: "Timesheets", href: "/timesheets", icon: Clock },
  { label: "Expenses", href: "/expenses", icon: Receipt },
  { label: "Invoices", href: "/invoices", icon: FileText, financialOnly: true },
  { label: "Accounts Receivable", href: "/receivables", icon: Landmark, financialOnly: true },
  { label: "Accounts Payable", href: "/payables", icon: Wallet, financialOnly: true },
  { label: "Cash Flow", href: "/cash-flow", icon: TrendingUp, financialOnly: true },
  { label: "Profitability", href: "/profitability", icon: PieChart, financialOnly: true },
  { label: "Reports", href: "/reports", icon: BarChart3, financialOnly: true },
  { label: "Settings", href: "/settings", icon: Settings, settingsOnly: true },
];
