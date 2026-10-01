// Alerts are computed live from current records against configurable
// thresholds (Settings) rather than stored as pre-generated rows, so they
// are always consistent with the underlying data.
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { num } from "@/lib/format";
import { currentMonthRange, previousMonthRange, addDays } from "@/lib/dates";
import { projectFinancialsForRange, employeeEconomicsForRange, actualCashBalance } from "@/lib/calc";

export interface AppAlert {
  type: string;
  severity: "INFO" | "WARNING" | "CRITICAL";
  message: string;
  href?: string;
}

export async function computeAlerts(): Promise<AppAlert[]> {
  const settings = await getSettings();
  const now = new Date();
  const alerts: AppAlert[] = [];

  // Invoice overdue + large receivable
  const invoices = await prisma.invoice.findMany({
    where: { status: { in: ["SENT", "PARTIALLY_PAID", "OVERDUE"] } },
    include: { payments: true, client: true },
  });
  const largeThreshold = Number(settings.largeReceivableThreshold);
  for (const inv of invoices) {
    const paid = inv.payments.reduce((s, p) => s + num(p.amount), 0);
    const balance = Math.max(0, num(inv.total) - paid);
    if (balance <= 0) continue;
    if (inv.dueDate < now) {
      const days = Math.floor((now.getTime() - inv.dueDate.getTime()) / 86400000);
      alerts.push({ type: "INVOICE_OVERDUE", severity: days > 30 ? "CRITICAL" : "WARNING", message: `${inv.invoiceNumber} (${inv.client.name}) is ${days} days overdue — ${balance.toFixed(2)} outstanding`, href: `/invoices/${inv.id}` });
    }
    if (balance >= largeThreshold) {
      alerts.push({ type: "LARGE_RECEIVABLE", severity: "WARNING", message: `${inv.client.name} has a large outstanding balance of $${balance.toFixed(2)} on ${inv.invoiceNumber}`, href: `/invoices/${inv.id}` });
    }
  }

  // Project over budget / margin below threshold
  const projectFin = await projectFinancialsForRange({ start: new Date(now.getFullYear() - 50, 0, 1), end: new Date(now.getFullYear() + 50, 0, 1), label: "All Time" });
  for (const p of projectFin) {
    if (p.alerts.includes("Cost exceeds budget")) {
      alerts.push({ type: "PROJECT_OVER_BUDGET", severity: "CRITICAL", message: `${p.name} (${p.clientName}) is over budget — cost $${p.totalCost.toFixed(0)} vs budget $${p.budget.toFixed(0)}`, href: `/projects/${p.projectId}` });
    }
    if (p.alerts.includes("Margin below threshold")) {
      alerts.push({ type: "PROJECT_MARGIN_LOW", severity: "WARNING", message: `${p.name} (${p.clientName}) margin ${p.margin.toFixed(1)}% is below its ${p.marginThresholdPct}% threshold`, href: `/projects/${p.projectId}` });
    }
    if (p.alerts.includes("Approaching end date")) {
      alerts.push({ type: "CONTRACT_EXPIRING", severity: "INFO", message: `${p.name} (${p.clientName}) is approaching its end date`, href: `/projects/${p.projectId}` });
    }
  }

  // Employee utilization below threshold — evaluated over a trailing 30-day
  // window rather than the calendar month, so a 1-2 day-old month doesn't
  // falsely flag every employee as underutilized.
  const utilThreshold = Number(settings.utilizationThresholdPct);
  const econ = await employeeEconomicsForRange({ start: addDays(now, -30), end: now, label: "Trailing 30 Days" });
  for (const e of econ) {
    if (e.availableHours > 0 && e.utilization < utilThreshold && e.availableHours > 20) {
      alerts.push({ type: "UTILIZATION_LOW", severity: "WARNING", message: `${e.name} utilization is ${e.utilization.toFixed(1)}%, below the ${utilThreshold}% target`, href: `/employees/${e.employeeId}` });
    }
  }

  // Expense spike (category vs prior month)
  const spikeThresholdPct = Number(settings.expenseSpikeThresholdPct);
  const [curExpenses, prevExpenses] = await Promise.all([
    prisma.expense.findMany({ where: { date: { gte: currentMonthRange().start, lte: currentMonthRange().end }, approvalStatus: "APPROVED", deletedAt: null }, include: { category: true } }),
    prisma.expense.findMany({ where: { date: { gte: previousMonthRange().start, lte: previousMonthRange().end }, approvalStatus: "APPROVED", deletedAt: null }, include: { category: true } }),
  ]);
  const curByCat = new Map<string, number>();
  for (const e of curExpenses) curByCat.set(e.category.name, (curByCat.get(e.category.name) ?? 0) + num(e.amount));
  const prevByCat = new Map<string, number>();
  for (const e of prevExpenses) prevByCat.set(e.category.name, (prevByCat.get(e.category.name) ?? 0) + num(e.amount));
  for (const [cat, curAmt] of curByCat) {
    const prevAmt = prevByCat.get(cat) ?? 0;
    if (prevAmt > 500 && curAmt > prevAmt * (1 + spikeThresholdPct / 100)) {
      const pct = ((curAmt - prevAmt) / prevAmt) * 100;
      alerts.push({ type: "EXPENSE_SPIKE", severity: "WARNING", message: `${cat} expenses up ${pct.toFixed(0)}% vs last month ($${curAmt.toFixed(0)} vs $${prevAmt.toFixed(0)})`, href: "/expenses" });
    }
  }

  // Upcoming recurring expenses (next 7 days)
  const upcomingRecurring = await prisma.recurringExpense.findMany({ where: { active: true, nextOccurrence: { lte: addDays(now, 7), gte: now } } });
  for (const r of upcomingRecurring) {
    alerts.push({ type: "RECURRING_EXPENSE_UPCOMING", severity: "INFO", message: `${r.name} ($${num(r.amount).toFixed(2)}) is due ${r.nextOccurrence.toLocaleDateString()}`, href: "/expenses" });
  }

  // Upcoming payables (next 7 days)
  const upcomingPayables = await prisma.accountsPayable.findMany({ where: { status: { in: ["OPEN", "PARTIALLY_PAID", "OVERDUE"] }, dueDate: { lte: addDays(now, 7) } }, include: { vendor: true } });
  for (const p of upcomingPayables) {
    alerts.push({ type: "PAYABLE_UPCOMING", severity: p.dueDate < now ? "CRITICAL" : "INFO", message: `${p.vendor.name} payable of $${num(p.balance).toFixed(2)} due ${p.dueDate.toLocaleDateString()}`, href: "/payables" });
  }

  // Cash below minimum threshold
  const cashMin = Number(settings.cashMinThreshold);
  const cash = await actualCashBalance();
  if (cash < cashMin) {
    alerts.push({ type: "CASH_BELOW_THRESHOLD", severity: "CRITICAL", message: `Cash balance $${cash.toFixed(2)} is below the minimum threshold of $${cashMin.toFixed(2)}`, href: "/cash-flow" });
  }

  // Contract nearing expiration
  const contractDays = Number(settings.contractExpiringDays);
  const clients = await prisma.client.findMany({ where: { status: "ACTIVE", contractEndDate: { not: null, lte: addDays(now, contractDays) } } });
  for (const c of clients) {
    if (!c.contractEndDate) continue;
    alerts.push({ type: "CONTRACT_EXPIRING", severity: "WARNING", message: `${c.name}'s contract ends ${c.contractEndDate.toLocaleDateString()}`, href: `/clients/${c.id}` });
  }

  const severityRank = { CRITICAL: 0, WARNING: 1, INFO: 2 };
  return alerts.sort((a, b) => severityRank[a.severity] - severityRank[b.severity]);
}
