import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { canViewFinancials } from "@/lib/rbac";
import { PeriodSelector } from "@/components/period-selector";
import { ProfitabilityTabs, type ProfitRow } from "@/components/profitability/profitability-tabs";
import {
  employeeEconomicsForRange,
  clientFinancialsForRange,
  projectFinancialsForRange,
  profitabilityByService,
  profitabilityByMonth,
} from "@/lib/calc";
import { resolvePeriod, lastNMonths, type PeriodKey } from "@/lib/dates";

export default async function ProfitabilityPage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const session = await auth();
  if (!session?.user || !canViewFinancials(session.user.role)) redirect("/dashboard");

  const { period } = await searchParams;
  const range = resolvePeriod((period as PeriodKey) ?? "current_month");
  const months = lastNMonths(12);

  const [employees, clients, projects, services, monthly] = await Promise.all([
    employeeEconomicsForRange(range),
    clientFinancialsForRange(range),
    projectFinancialsForRange(range),
    profitabilityByService(range),
    profitabilityByMonth(months),
  ]);

  const byEmployee: ProfitRow[] = employees.map((e) => ({
    id: e.employeeId,
    name: e.name,
    href: `/employees/${e.employeeId}`,
    revenue: e.revenue,
    directCost: e.cost,
    contribution: e.contribution,
    margin: e.margin,
  }));

  const byClient: ProfitRow[] = clients.map((c) => ({
    id: c.clientId,
    name: c.name,
    href: `/clients/${c.clientId}`,
    revenue: c.totalRevenue,
    directCost: c.employeeCost + c.projectCost,
    contribution: c.grossProfit,
    margin: c.margin,
  }));

  const byProject: ProfitRow[] = projects.map((p) => ({
    id: p.projectId,
    name: p.name,
    href: `/projects/${p.projectId}`,
    revenue: p.revenue,
    directCost: p.totalCost,
    contribution: p.grossProfit,
    margin: p.margin,
  }));

  const byService: ProfitRow[] = services.map((s) => ({
    id: s.serviceId,
    name: s.name,
    revenue: s.revenue,
    directCost: s.directCost,
    contribution: s.contribution,
    margin: s.margin,
  }));

  const byMonth: ProfitRow[] = monthly.map((m) => ({
    id: m.label,
    name: m.label,
    revenue: m.revenue,
    directCost: m.directCost,
    contribution: m.contribution,
    margin: m.margin,
  }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Profitability</h2>
          <p className="text-sm text-muted-foreground">Revenue minus direct costs, by employee, client, project, service, and month</p>
        </div>
        <PeriodSelector />
      </div>
      <ProfitabilityTabs byEmployee={byEmployee} byClient={byClient} byProject={byProject} byService={byService} byMonth={byMonth} />
    </div>
  );
}
