// Core business calculation engine. Every number here is derived live from
// underlying records (timesheets, revenue, expenses, invoices, payments) —
// nothing on the dashboard is a manually entered figure.
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { num } from "@/lib/format";
import { DateRange } from "@/lib/dates";

// ---------------------------------------------------------------------------
// Employee economics
// Revenue = Billable Hours x Billing Rate
// Cost    = Working Hours x Hourly Cost Rate
// Contribution = Revenue - Cost
// Margin = Contribution / Revenue * 100
// Utilization = Billable Hours / Available Hours * 100
// ---------------------------------------------------------------------------

export interface EmployeeEconomics {
  employeeId: string;
  name: string;
  role: string;
  department: string;
  billingRate: number;
  hourlyCost: number;
  availableHours: number;
  billableHours: number;
  nonBillableHours: number;
  revenue: number;
  cost: number;
  contribution: number;
  margin: number;
  utilization: number;
}

function availableHoursForRange(standardWeeklyHours: number, range: DateRange): number {
  const days = Math.max(1, Math.round((range.end.getTime() - range.start.getTime()) / (1000 * 60 * 60 * 24)));
  const weeks = days / 7;
  return standardWeeklyHours * weeks;
}

export async function employeeEconomicsForRange(range: DateRange, employeeId?: string): Promise<EmployeeEconomics[]> {
  const employees = await prisma.employee.findMany({
    where: { deletedAt: null, ...(employeeId ? { id: employeeId } : {}) },
    include: {
      timesheets: {
        where: { date: { gte: range.start, lte: range.end }, status: "APPROVED" },
      },
    },
  });

  return employees.map((emp) => {
    const billableHours = emp.timesheets.filter((t) => t.billable).reduce((s, t) => s + num(t.hours), 0);
    const nonBillableHours = emp.timesheets.filter((t) => !t.billable).reduce((s, t) => s + num(t.hours), 0);

    // Available capacity only counts while the employee is active and the
    // range overlaps their tenure — a terminated employee, or one who hasn't
    // joined yet, has zero expected capacity even if they logged no hours.
    const effectiveStart = emp.joiningDate > range.start ? emp.joiningDate : range.start;
    const effectiveEnd = emp.endDate && emp.endDate < range.end ? emp.endDate : range.end;
    const hasCapacity = emp.status === "ACTIVE" && effectiveStart <= effectiveEnd;
    const availableHours = hasCapacity ? availableHoursForRange(num(emp.standardWeeklyHours), { ...range, start: effectiveStart, end: effectiveEnd }) : 0;
    const billingRate = num(emp.billingRate);
    const hourlyCost = num(emp.hourlyCost);
    const revenue = billableHours * billingRate;
    const workedHours = billableHours + nonBillableHours;
    const cost = workedHours * hourlyCost;
    const contribution = revenue - cost;
    const margin = revenue > 0 ? (contribution / revenue) * 100 : 0;
    const utilization = availableHours > 0 ? (billableHours / availableHours) * 100 : 0;

    return {
      employeeId: emp.id,
      name: emp.name,
      role: emp.role,
      department: emp.department,
      billingRate,
      hourlyCost,
      availableHours,
      billableHours,
      nonBillableHours,
      revenue,
      cost,
      contribution,
      margin,
      utilization,
    };
  });
}

// ---------------------------------------------------------------------------
// Client financials
// ---------------------------------------------------------------------------

export interface ClientFinancials {
  clientId: string;
  name: string;
  status: string;
  totalRevenue: number;
  amountReceived: number;
  outstanding: number;
  overdue: number;
  employeeCost: number;
  projectCost: number;
  grossProfit: number;
  margin: number;
}

export async function clientFinancialsForRange(range: DateRange, clientId?: string): Promise<ClientFinancials[]> {
  const clients = await prisma.client.findMany({
    where: { deletedAt: null, ...(clientId ? { id: clientId } : {}) },
    include: {
      revenues: { where: { date: { gte: range.start, lte: range.end } } },
      invoices: { include: { payments: true } },
      expenses: { where: { date: { gte: range.start, lte: range.end }, approvalStatus: "APPROVED", deletedAt: null } },
      timesheets: {
        where: { date: { gte: range.start, lte: range.end }, status: "APPROVED", billable: true },
        include: { employee: true },
      },
    },
  });

  const now = new Date();

  return clients.map((c) => {
    const totalRevenue = c.revenues.reduce((s, r) => s + num(r.amount), 0);
    const amountReceived = c.invoices.reduce((s, inv) => s + inv.payments.reduce((ps, p) => ps + num(p.amount), 0), 0);
    const openInvoices = c.invoices.filter((inv) => inv.status === "SENT" || inv.status === "PARTIALLY_PAID" || inv.status === "OVERDUE");
    const outstanding = openInvoices.reduce((s, inv) => {
      const paid = inv.payments.reduce((ps, p) => ps + num(p.amount), 0);
      return s + Math.max(0, num(inv.total) - paid);
    }, 0);
    const overdue = openInvoices.reduce((s, inv) => {
      const paid = inv.payments.reduce((ps, p) => ps + num(p.amount), 0);
      const bal = Math.max(0, num(inv.total) - paid);
      return s + (bal > 0 && inv.dueDate < now ? bal : 0);
    }, 0);
    const employeeCost = c.timesheets.reduce((s, t) => s + num(t.hours) * num(t.employee.hourlyCost), 0);
    const projectCost = c.expenses.reduce((s, e) => s + num(e.amount), 0);
    const grossProfit = totalRevenue - employeeCost - projectCost;
    const margin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;

    return {
      clientId: c.id,
      name: c.name,
      status: c.status,
      totalRevenue,
      amountReceived,
      outstanding,
      overdue,
      employeeCost,
      projectCost,
      grossProfit,
      margin,
    };
  });
}

// ---------------------------------------------------------------------------
// Project financials
// ---------------------------------------------------------------------------

export interface ProjectFinancials {
  projectId: string;
  name: string;
  clientName: string;
  status: string;
  billingModel: string;
  budget: number;
  contractValue: number;
  estimatedHours: number;
  actualHours: number;
  revenue: number;
  employeeCost: number;
  directExpenses: number;
  totalCost: number;
  grossProfit: number;
  margin: number;
  marginThresholdPct: number;
  alerts: string[];
}

export async function projectFinancialsForRange(range: DateRange, projectId?: string): Promise<ProjectFinancials[]> {
  const projects = await prisma.project.findMany({
    where: { deletedAt: null, ...(projectId ? { id: projectId } : {}) },
    include: {
      client: true,
      revenues: { where: { date: { gte: range.start, lte: range.end } } },
      expenses: { where: { date: { gte: range.start, lte: range.end }, approvalStatus: "APPROVED", deletedAt: null } },
      timesheets: {
        where: { date: { gte: range.start, lte: range.end }, status: "APPROVED" },
        include: { employee: true },
      },
    },
  });

  const now = new Date();

  return projects.map((p) => {
    const revenue = p.revenues.reduce((s, r) => s + num(r.amount), 0);
    const employeeCost = p.timesheets.reduce((s, t) => s + num(t.hours) * num(t.employee.hourlyCost), 0);
    const directExpenses = p.expenses.reduce((s, e) => s + num(e.amount), 0);
    const totalCost = employeeCost + directExpenses;
    const grossProfit = revenue - totalCost;
    const margin = revenue > 0 ? (grossProfit / revenue) * 100 : 0;
    const actualHours = p.timesheets.reduce((s, t) => s + num(t.hours), 0);
    const marginThresholdPct = num(p.marginThresholdPct);

    const alerts: string[] = [];
    const estimatedHours = num(p.estimatedHours);
    if (estimatedHours > 0 && actualHours > estimatedHours) alerts.push("Actual hours exceed estimate");
    if (num(p.budget) > 0 && totalCost > num(p.budget)) alerts.push("Cost exceeds budget");
    if (revenue > 0 && margin < marginThresholdPct) alerts.push("Margin below threshold");
    if (p.endDate && p.status === "ACTIVE") {
      const daysToEnd = Math.floor((p.endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      if (daysToEnd >= 0 && daysToEnd <= 14) alerts.push("Approaching end date");
    }

    return {
      projectId: p.id,
      name: p.name,
      clientName: p.client.name,
      status: p.status,
      billingModel: p.billingModel,
      budget: num(p.budget),
      contractValue: num(p.contractValue),
      estimatedHours,
      actualHours,
      revenue,
      employeeCost,
      directExpenses,
      totalCost,
      grossProfit,
      margin,
      marginThresholdPct,
      alerts,
    };
  });
}

// ---------------------------------------------------------------------------
// Company P&L
// ---------------------------------------------------------------------------

export interface CompanyPL {
  revenueByType: Record<string, number>;
  totalRevenue: number;
  employeeCosts: number;
  contractorCosts: number;
  directProjectExpenses: number;
  totalDirectCosts: number;
  grossProfit: number;
  grossMarginPct: number;
  opexByCategory: Record<string, number>;
  totalOpex: number;
  operatingProfit: number;
  otherCosts: number;
  netProfit: number;
  netMarginPct: number;
}

const OTHER_COST_GROUPS = new Set(["Financial"]);

// Employee/contractor cost on the company P&L is sourced from the Expense
// ledger (actual payroll runs, contractor invoices, benefits, recruiting) —
// not re-derived from timesheet hours x cost rate. Timesheet-based costing
// is used for employee/project/client *economics* (margin per resource),
// a distinct analytical view of the same workforce spend (see principle in
// spec section 25: revenue, cost, cash and profit are tracked separately).
export async function companyPLForRange(range: DateRange): Promise<CompanyPL> {
  const [revenues, expenses] = await Promise.all([
    prisma.revenue.findMany({ where: { date: { gte: range.start, lte: range.end } } }),
    prisma.expense.findMany({
      where: { date: { gte: range.start, lte: range.end }, approvalStatus: "APPROVED", deletedAt: null },
      include: { category: true },
    }),
  ]);

  const revenueByType: Record<string, number> = {};
  for (const r of revenues) {
    revenueByType[r.revenueType] = (revenueByType[r.revenueType] ?? 0) + num(r.amount);
  }
  const totalRevenue = Object.values(revenueByType).reduce((a, b) => a + b, 0);

  let employeeCosts = 0;
  let contractorCosts = 0;
  let directProjectExpenses = 0;
  const opexByCategory: Record<string, number> = {};
  let otherCosts = 0;

  for (const e of expenses) {
    const amount = num(e.amount);
    if (e.projectId || e.clientId) {
      directProjectExpenses += amount;
      continue;
    }
    const group = e.category.group;
    if (group === "Employee") {
      if (e.category.name.toLowerCase().includes("contractor")) contractorCosts += amount;
      else employeeCosts += amount;
    } else if (OTHER_COST_GROUPS.has(group)) {
      otherCosts += amount;
    } else {
      // OPEX_GROUPS (Technology/Office/Business) plus any custom group both
      // land in operating expenses — there is no third bucket today.
      opexByCategory[e.category.name] = (opexByCategory[e.category.name] ?? 0) + amount;
    }
  }

  const totalDirectCosts = employeeCosts + contractorCosts + directProjectExpenses;
  const grossProfit = totalRevenue - totalDirectCosts;
  const grossMarginPct = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;
  const totalOpex = Object.values(opexByCategory).reduce((a, b) => a + b, 0);
  const operatingProfit = grossProfit - totalOpex;
  const netProfit = operatingProfit - otherCosts;
  const netMarginPct = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

  return {
    revenueByType,
    totalRevenue,
    employeeCosts,
    contractorCosts,
    directProjectExpenses,
    totalDirectCosts,
    grossProfit,
    grossMarginPct,
    opexByCategory,
    totalOpex,
    operatingProfit,
    otherCosts,
    netProfit,
    netMarginPct,
  };
}

// ---------------------------------------------------------------------------
// Accounts Receivable aging
// ---------------------------------------------------------------------------

export interface ARBucket {
  current: number;
  d1_30: number;
  d31_60: number;
  d61_90: number;
  d90plus: number;
  total: number;
}

export interface ClientARRow {
  invoiceId: string;
  invoiceNumber: string;
  clientId: string;
  clientName: string;
  invoiceTotal: number;
  received: number;
  outstanding: number;
  bucket: keyof Omit<ARBucket, "total">;
}

export async function accountsReceivableAging(asOf = new Date(), clientId?: string): Promise<{ summary: ARBucket; rows: ClientARRow[] }> {
  const invoices = await prisma.invoice.findMany({
    where: { status: { in: ["SENT", "PARTIALLY_PAID", "OVERDUE"] }, ...(clientId ? { clientId } : {}) },
    include: { payments: true, client: true },
  });

  const summary: ARBucket = { current: 0, d1_30: 0, d31_60: 0, d61_90: 0, d90plus: 0, total: 0 };
  const rows: ClientARRow[] = [];

  for (const inv of invoices) {
    const received = inv.payments.reduce((s, p) => s + num(p.amount), 0);
    const outstanding = Math.max(0, num(inv.total) - received);
    if (outstanding <= 0) continue;
    const daysOverdue = Math.floor((asOf.getTime() - inv.dueDate.getTime()) / (1000 * 60 * 60 * 24));
    let bucket: keyof Omit<ARBucket, "total">;
    if (daysOverdue <= 0) bucket = "current";
    else if (daysOverdue <= 30) bucket = "d1_30";
    else if (daysOverdue <= 60) bucket = "d31_60";
    else if (daysOverdue <= 90) bucket = "d61_90";
    else bucket = "d90plus";

    summary[bucket] += outstanding;
    summary.total += outstanding;
    rows.push({
      invoiceId: inv.id,
      invoiceNumber: inv.invoiceNumber,
      clientId: inv.clientId,
      clientName: inv.client.name,
      invoiceTotal: num(inv.total),
      received,
      outstanding,
      bucket,
    });
  }

  return { summary, rows };
}

// ---------------------------------------------------------------------------
// Accounts Payable summary
// ---------------------------------------------------------------------------

export interface APSummary {
  totalPayable: number;
  dueThisWeek: number;
  dueThisMonth: number;
  overdue: number;
}

export async function accountsPayableSummary(asOf = new Date()): Promise<APSummary> {
  const payables = await prisma.accountsPayable.findMany({ where: { status: { in: ["OPEN", "PARTIALLY_PAID", "OVERDUE"] } } });
  const weekEnd = new Date(asOf.getTime() + 7 * 86400000);
  const monthEnd = new Date(asOf.getFullYear(), asOf.getMonth() + 1, 0, 23, 59, 59, 999);

  let totalPayable = 0,
    dueThisWeek = 0,
    dueThisMonth = 0,
    overdue = 0;

  for (const p of payables) {
    const bal = num(p.balance);
    totalPayable += bal;
    if (p.dueDate < asOf) overdue += bal;
    else if (p.dueDate <= weekEnd) dueThisWeek += bal;
    if (p.dueDate >= asOf && p.dueDate <= monthEnd) dueThisMonth += bal;
  }

  return { totalPayable, dueThisWeek, dueThisMonth, overdue };
}

// ---------------------------------------------------------------------------
// Cash flow (actual) + forecast
// ---------------------------------------------------------------------------

export interface CashFlowSummary {
  openingCash: number;
  inflows: number;
  outflows: number;
  closingCash: number;
}

export async function actualCashBalance(asOf = new Date()): Promise<number> {
  const txns = await prisma.cashTransaction.findMany({ where: { certainty: "ACTUAL", date: { lte: asOf } } });
  return txns.reduce((s, t) => s + (t.direction === "INFLOW" ? num(t.amount) : -num(t.amount)), 0);
}

export async function cashFlowForRange(range: DateRange): Promise<CashFlowSummary & { byCategory: { category: string; inflow: number; outflow: number }[] }> {
  const [openingTxns, rangeTxns] = await Promise.all([
    prisma.cashTransaction.findMany({ where: { certainty: "ACTUAL", date: { lt: range.start } } }),
    prisma.cashTransaction.findMany({ where: { certainty: "ACTUAL", date: { gte: range.start, lte: range.end } } }),
  ]);

  const openingCash = openingTxns.reduce((s, t) => s + (t.direction === "INFLOW" ? num(t.amount) : -num(t.amount)), 0);
  const inflows = rangeTxns.filter((t) => t.direction === "INFLOW").reduce((s, t) => s + num(t.amount), 0);
  const outflows = rangeTxns.filter((t) => t.direction === "OUTFLOW").reduce((s, t) => s + num(t.amount), 0);

  const catMap = new Map<string, { inflow: number; outflow: number }>();
  for (const t of rangeTxns) {
    const entry = catMap.get(t.category) ?? { inflow: 0, outflow: 0 };
    if (t.direction === "INFLOW") entry.inflow += num(t.amount);
    else entry.outflow += num(t.amount);
    catMap.set(t.category, entry);
  }

  return {
    openingCash,
    inflows,
    outflows,
    closingCash: openingCash + inflows - outflows,
    byCategory: Array.from(catMap.entries()).map(([category, v]) => ({ category, ...v })),
  };
}

export interface CashForecastPoint {
  days: number;
  currentCash: number;
  expectedInflows: number;
  expectedOutflows: number;
  projectedCash: number;
}

function nextOccurrenceAfter(date: Date, frequency: string): Date {
  const next = new Date(date);
  if (frequency === "WEEKLY") next.setDate(next.getDate() + 7);
  else if (frequency === "MONTHLY") next.setMonth(next.getMonth() + 1);
  else if (frequency === "QUARTERLY") next.setMonth(next.getMonth() + 3);
  else next.setFullYear(next.getFullYear() + 1);
  return next;
}

export async function cashFlowForecast(horizons: number[] = [30, 60, 90], asOf = new Date()): Promise<CashForecastPoint[]> {
  const currentCash = await actualCashBalance(asOf);
  const [openInvoices, recurring, payables] = await Promise.all([
    prisma.invoice.findMany({ where: { status: { in: ["SENT", "PARTIALLY_PAID", "OVERDUE"] } }, include: { payments: true } }),
    prisma.recurringExpense.findMany({ where: { active: true } }),
    prisma.accountsPayable.findMany({ where: { status: { in: ["OPEN", "PARTIALLY_PAID", "OVERDUE"] } } }),
  ]);

  return horizons.map((days) => {
    const horizonEnd = new Date(asOf.getTime() + days * 86400000);

    const expectedInflows = openInvoices.reduce((s, inv) => {
      const received = inv.payments.reduce((ps, p) => ps + num(p.amount), 0);
      const bal = Math.max(0, num(inv.total) - received);
      return inv.dueDate <= horizonEnd ? s + bal : s;
    }, 0);

    const expectedOutflowsPayables = payables.reduce((s, p) => (p.dueDate <= horizonEnd ? s + num(p.balance) : s), 0);

    // Walk actual occurrence dates from nextOccurrence forward (stepping by
    // the expense's own frequency, stopping at any endDate) instead of a
    // flat amount x occurrences-per-month x days/30 average — the average
    // both double-counts a bill due later today (already captured the
    // instant it posts) and keeps billing an expense past its endDate.
    let expectedOutflowsRecurring = 0;
    for (const r of recurring) {
      const amount = num(r.amount);
      let occurrence = r.nextOccurrence;
      let guard = 0;
      // If nextOccurrence was never advanced past today (nothing in this
      // app currently rolls it forward automatically), skip past-due dates
      // without counting them — the forecast only projects what's ahead.
      while (occurrence < asOf && guard < 500) {
        occurrence = nextOccurrenceAfter(occurrence, r.frequency);
        guard++;
      }
      while (occurrence <= horizonEnd && (!r.endDate || occurrence <= r.endDate) && guard < 500) {
        expectedOutflowsRecurring += amount;
        occurrence = nextOccurrenceAfter(occurrence, r.frequency);
        guard++;
      }
    }

    const expectedOutflows = expectedOutflowsPayables + expectedOutflowsRecurring;

    return {
      days,
      currentCash,
      expectedInflows,
      expectedOutflows,
      projectedCash: currentCash + expectedInflows - expectedOutflows,
    };
  });
}

// ---------------------------------------------------------------------------
// Expense breakdown
// ---------------------------------------------------------------------------

export async function expenseBreakdownForRange(range: DateRange): Promise<{ category: string; group: string; amount: number }[]> {
  const expenses = await prisma.expense.findMany({
    where: { date: { gte: range.start, lte: range.end }, approvalStatus: "APPROVED", deletedAt: null },
    include: { category: true },
  });
  const map = new Map<string, { group: string; amount: number }>();
  for (const e of expenses) {
    const entry = map.get(e.category.name) ?? { group: e.category.group, amount: 0 };
    entry.amount += num(e.amount);
    map.set(e.category.name, entry);
  }
  return Array.from(map.entries()).map(([category, v]) => ({ category, ...v }));
}

// ---------------------------------------------------------------------------
// Dashboard KPI bundle
// ---------------------------------------------------------------------------

export interface DashboardKpis {
  totalRevenue: number;
  totalExpenses: number;
  grossProfit: number;
  netProfit: number;
  grossMarginPct: number;
  netMarginPct: number;
  outstandingReceivables: number;
  cashBalance: number;
  monthlyBurn: number;
  accountsPayable: number;
  activeClients: number;
  activeProjects: number;
  activeEmployees: number;
  billableHours: number;
  nonBillableHours: number;
  utilizationPct: number;
  revenuePerEmployee: number;
}

export async function dashboardKpisForRange(range: DateRange): Promise<DashboardKpis> {
  const [pl, ar, ap, cash, employeeEcon, activeClients, activeProjects] = await Promise.all([
    companyPLForRange(range),
    accountsReceivableAging(),
    accountsPayableSummary(),
    actualCashBalance(),
    employeeEconomicsForRange(range),
    prisma.client.count({ where: { status: "ACTIVE", deletedAt: null } }),
    prisma.project.count({ where: { status: "ACTIVE", deletedAt: null } }),
  ]);

  const activeEmployees = employeeEcon.filter((e) => e.availableHours > 0).length || employeeEcon.length;
  const billableHours = employeeEcon.reduce((s, e) => s + e.billableHours, 0);
  const nonBillableHours = employeeEcon.reduce((s, e) => s + e.nonBillableHours, 0);
  const availableHours = employeeEcon.reduce((s, e) => s + e.availableHours, 0);
  const utilizationPct = availableHours > 0 ? (billableHours / availableHours) * 100 : 0;

  const monthlyBurn = pl.totalDirectCosts + pl.totalOpex + pl.otherCosts;

  return {
    totalRevenue: pl.totalRevenue,
    totalExpenses: monthlyBurn,
    grossProfit: pl.grossProfit,
    netProfit: pl.netProfit,
    grossMarginPct: pl.grossMarginPct,
    netMarginPct: pl.netMarginPct,
    outstandingReceivables: ar.summary.total,
    cashBalance: cash,
    monthlyBurn,
    accountsPayable: ap.totalPayable,
    activeClients,
    activeProjects,
    activeEmployees,
    billableHours,
    nonBillableHours,
    utilizationPct,
    revenuePerEmployee: activeEmployees > 0 ? pl.totalRevenue / activeEmployees : 0,
  };
}

// ---------------------------------------------------------------------------
// Profitability by service and by month — generalizes the same
// Revenue - Direct Costs = Contribution, Margin% = Contribution / Revenue
// formula used throughout (employee/client/project) to the service and
// time dimensions, per the Profitability module.
// ---------------------------------------------------------------------------

export interface ServiceProfitability {
  serviceId: string;
  name: string;
  revenue: number;
  directCost: number;
  contribution: number;
  margin: number;
}

export async function profitabilityByService(range: DateRange): Promise<ServiceProfitability[]> {
  const services = await prisma.service.findMany({
    include: {
      revenues: { where: { date: { gte: range.start, lte: range.end } } },
      timesheets: { where: { date: { gte: range.start, lte: range.end }, status: "APPROVED" }, include: { employee: true } },
    },
  });

  return services
    .map((s) => {
      const revenue = s.revenues.reduce((sum, r) => sum + num(r.amount), 0);
      const directCost = s.timesheets.reduce((sum, t) => sum + num(t.hours) * num(t.employee.hourlyCost), 0);
      const contribution = revenue - directCost;
      const margin = revenue > 0 ? (contribution / revenue) * 100 : 0;
      return { serviceId: s.id, name: s.name, revenue, directCost, contribution, margin };
    })
    .filter((s) => s.revenue > 0 || s.directCost > 0);
}

export interface MonthProfitability {
  label: string;
  revenue: number;
  directCost: number;
  contribution: number;
  margin: number;
}

export async function profitabilityByMonth(months: { start: Date; end: Date; label: string }[]): Promise<MonthProfitability[]> {
  const results = await Promise.all(months.map((m) => companyPLForRange({ start: m.start, end: m.end, label: m.label })));
  return months.map((m, i) => ({
    label: m.label,
    revenue: results[i].totalRevenue,
    directCost: results[i].totalDirectCosts,
    contribution: results[i].grossProfit,
    margin: results[i].grossMarginPct,
  }));
}

export { getSettings };
