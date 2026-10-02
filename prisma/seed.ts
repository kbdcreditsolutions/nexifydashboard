// Realistic, fully-connected demo data: Employees -> Timesheets -> Revenue ->
// Invoices -> Payments, plus Expenses -> Payables, plus Cash transactions
// derived from those same payments/expenses so every dashboard figure
// traces back to a source record.
import { PrismaClient, EmploymentType, ProjectStatus, BillingModel, InvoiceStatus } from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";

async function createManyChunked<T>(label: string, rows: T[], fn: (chunk: T[]) => Promise<unknown>, chunkSize = 500) {
  for (let i = 0; i < rows.length; i += chunkSize) {
    await fn(rows.slice(i, i + chunkSize));
  }
  if (rows.length > 0) console.log(`  (${label}: ${rows.length} rows in ${Math.ceil(rows.length / chunkSize)} batch(es))`);
}

const prisma = new PrismaClient();

// --- deterministic PRNG so the demo data is stable across reseeds ----------
let seedState = 42;
function rand(): number {
  seedState = (seedState * 1103515245 + 12345) & 0x7fffffff;
  return seedState / 0x7fffffff;
}
function randInt(min: number, max: number): number {
  return Math.floor(rand() * (max - min + 1)) + min;
}
function pick<T>(arr: T[]): T {
  return arr[randInt(0, arr.length - 1)];
}
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

const TODAY = new Date("2026-10-01T12:00:00Z");
const RANGE_START = new Date("2026-04-01T00:00:00Z");

function isWeekday(d: Date) {
  const day = d.getDay();
  return day !== 0 && day !== 6;
}
function eachWeekday(start: Date, end: Date): Date[] {
  const out: Date[] = [];
  const cur = new Date(start);
  while (cur <= end) {
    if (isWeekday(cur)) out.push(new Date(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}
function monthsInRange(start: Date, end: Date): { start: Date; end: Date }[] {
  const out: { start: Date; end: Date }[] = [];
  const cur = new Date(start.getFullYear(), start.getMonth(), 1);
  while (cur <= end) {
    const mStart = new Date(cur);
    const mEnd = new Date(cur.getFullYear(), cur.getMonth() + 1, 0);
    out.push({ start: mStart, end: mEnd > end ? end : mEnd });
    cur.setMonth(cur.getMonth() + 1);
  }
  return out;
}

async function main() {
  console.log("Seeding Nexify Operations & Finance Dashboard...");

  // -------------------------------------------------------------- cleanup --
  await prisma.auditLog.deleteMany();
  await prisma.alert.deleteMany();
  await prisma.cashTransaction.deleteMany();
  await prisma.accountsPayable.deleteMany();
  await prisma.accountsReceivable.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.invoiceItem.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.revenue.deleteMany();
  await prisma.timesheet.deleteMany();
  await prisma.expense.deleteMany();
  await prisma.recurringExpense.deleteMany();
  await prisma.vendor.deleteMany();
  await prisma.expenseCategory.deleteMany();
  await prisma.projectAssignment.deleteMany();
  await prisma.clientAssignment.deleteMany();
  await prisma.project.deleteMany();
  await prisma.service.deleteMany();
  await prisma.client.deleteMany();
  await prisma.employee.deleteMany();
  await prisma.financialPeriod.deleteMany();
  await prisma.settings.deleteMany();
  await prisma.user.deleteMany();

  // ---------------------------------------------------------------- users --
  const passwordHash = await bcrypt.hash("Nexify2026!", 10);
  const ownerUser = await prisma.user.create({
    data: { name: "Victor Hale", email: "owner@nexifyinfo.com", passwordHash, role: "OWNER" },
  });
  const financeUser = await prisma.user.create({
    data: { name: "Dana Whitfield", email: "finance@nexifyinfo.com", passwordHash, role: "FINANCE" },
  });
  const opsUser = await prisma.user.create({
    data: { name: "Marcus Lee", email: "ops@nexifyinfo.com", passwordHash, role: "OPERATIONS" },
  });
  const managerUser = await prisma.user.create({
    data: { name: "Carlos Mendez", email: "manager@nexifyinfo.com", passwordHash, role: "MANAGER" },
  });
  const employeeUser = await prisma.user.create({
    data: { name: "John Smith", email: "employee@nexifyinfo.com", passwordHash, role: "EMPLOYEE" },
  });

  // ------------------------------------------------------------- settings --
  await prisma.settings.createMany({
    data: [
      { id: "s_companyName", key: "companyName", value: "Nexify InfoSystems" },
      { id: "s_currency", key: "currency", value: "USD" },
      { id: "s_fiscalYearStart", key: "fiscalYearStart", value: "01-01" },
      { id: "s_defaultPaymentTerms", key: "defaultPaymentTerms", value: "Net 30" },
      { id: "s_marginThresholdPct", key: "marginThresholdPct", value: "20" },
      { id: "s_utilizationThresholdPct", key: "utilizationThresholdPct", value: "70" },
      { id: "s_cashMinThreshold", key: "cashMinThreshold", value: "50000" },
      { id: "s_largeReceivableThreshold", key: "largeReceivableThreshold", value: "15000" },
      { id: "s_expenseSpikeThresholdPct", key: "expenseSpikeThresholdPct", value: "30" },
      { id: "s_contractExpiringDays", key: "contractExpiringDays", value: "30" },
      { id: "s_defaultBillingRate", key: "defaultBillingRate", value: "100" },
      { id: "s_defaultTaxRatePct", key: "defaultTaxRatePct", value: "0" },
    ],
  });

  // ------------------------------------------------------------ services --
  const serviceNames = [
    "IT Strategy",
    "Technology Consulting",
    "Automation",
    "AI & Machine Learning",
    "Cloud Services",
    "Cybersecurity",
    "Data Engineering",
    "Software Development",
    "Talent Services",
  ];
  const services = await Promise.all(serviceNames.map((name) => prisma.service.create({ data: { name } })));
  const svc = (name: string) => services.find((s) => s.name === name)!;

  // ----------------------------------------------------------- employees --
  type EmpSeed = {
    code: string;
    name: string;
    email: string;
    role: string;
    department: string;
    type: EmploymentType;
    joined: string;
    monthlyCost: number;
    hourlyCost: number;
    weeklyHours: number;
    billingRate: number;
    userId?: string;
  };
  const empSeeds: EmpSeed[] = [
    { code: "EMP-001", name: "Sarah Chen", email: "sarah.chen@nexifyinfo.com", role: "VP Engineering", department: "Engineering", type: "FULL_TIME", joined: "2022-03-01", monthlyCost: 10400, hourlyCost: 60, weeklyHours: 40, billingRate: 160 },
    { code: "EMP-002", name: "John Smith", email: "john.smith@nexifyinfo.com", role: "Cloud Engineer", department: "Cloud & DevOps", type: "FULL_TIME", joined: "2023-01-15", monthlyCost: 6066, hourlyCost: 35, weeklyHours: 40, billingRate: 75, userId: employeeUser.id },
    { code: "EMP-003", name: "Priya Nair", email: "priya.nair@nexifyinfo.com", role: "Data Engineer", department: "Data & AI", type: "FULL_TIME", joined: "2023-06-01", monthlyCost: 7800, hourlyCost: 45, weeklyHours: 40, billingRate: 120 },
    { code: "EMP-004", name: "Marcus Lee", email: "marcus.lee@nexifyinfo.com", role: "AI/ML Lead", department: "Data & AI", type: "FULL_TIME", joined: "2022-09-01", monthlyCost: 9533, hourlyCost: 55, weeklyHours: 40, billingRate: 150, userId: opsUser.id },
    { code: "EMP-005", name: "Elena Rodriguez", email: "elena.rodriguez@nexifyinfo.com", role: "Cybersecurity Consultant", department: "Cybersecurity", type: "FULL_TIME", joined: "2023-02-01", monthlyCost: 8666, hourlyCost: 50, weeklyHours: 40, billingRate: 135 },
    { code: "EMP-006", name: "David Kim", email: "david.kim@nexifyinfo.com", role: "Software Developer", department: "Software Development", type: "FULL_TIME", joined: "2024-01-08", monthlyCost: 6586, hourlyCost: 38, weeklyHours: 40, billingRate: 95 },
    { code: "EMP-007", name: "Aisha Patel", email: "aisha.patel@nexifyinfo.com", role: "Software Developer", department: "Software Development", type: "FULL_TIME", joined: "2024-03-18", monthlyCost: 6240, hourlyCost: 36, weeklyHours: 40, billingRate: 90 },
    { code: "EMP-008", name: "Tom Walker", email: "tom.walker@nexifyinfo.com", role: "DevOps Engineer", department: "Cloud & DevOps", type: "CONTRACTOR", joined: "2023-11-01", monthlyCost: 7280, hourlyCost: 42, weeklyHours: 40, billingRate: 110 },
    { code: "EMP-009", name: "Nina Brooks", email: "nina.brooks@nexifyinfo.com", role: "IT Strategy Consultant", department: "Strategy & Consulting", type: "FULL_TIME", joined: "2021-10-01", monthlyCost: 10053, hourlyCost: 58, weeklyHours: 40, billingRate: 155 },
    { code: "EMP-010", name: "Carlos Mendez", email: "carlos.mendez@nexifyinfo.com", role: "Project Manager", department: "Project Management", type: "FULL_TIME", joined: "2022-05-16", monthlyCost: 6933, hourlyCost: 40, weeklyHours: 40, billingRate: 100, userId: managerUser.id },
    { code: "EMP-011", name: "Grace Liu", email: "grace.liu@nexifyinfo.com", role: "UX Designer", department: "Design", type: "FULL_TIME", joined: "2024-02-05", monthlyCost: 5893, hourlyCost: 34, weeklyHours: 40, billingRate: 85 },
    { code: "EMP-012", name: "Ben Carter", email: "ben.carter@nexifyinfo.com", role: "Automation Engineer", department: "Engineering", type: "CONTRACTOR", joined: "2026-07-01", monthlyCost: 7626, hourlyCost: 44, weeklyHours: 40, billingRate: 115 },
  ];

  const employees = await Promise.all(
    empSeeds.map((e) =>
      prisma.employee.create({
        data: {
          employeeCode: e.code,
          userId: e.userId,
          name: e.name,
          email: e.email,
          role: e.role,
          department: e.department,
          employmentType: e.type,
          joiningDate: new Date(e.joined),
          status: "ACTIVE",
          monthlyCost: e.monthlyCost,
          hourlyCost: e.hourlyCost,
          standardWeeklyHours: e.weeklyHours,
          billingRate: e.billingRate,
        },
      })
    )
  );
  const emp = (name: string) => employees.find((e) => e.name === name)!;

  // -------------------------------------------------------------- clients --
  type ClientSeed = { code: string; name: string; contact: string; email: string; phone: string; start: string; end: string | null; terms: string; status: "ACTIVE" | "INACTIVE" | "CHURNED"; manager: string };
  const clientSeeds: ClientSeed[] = [
    { code: "CL-001", name: "Horizon Retail Group", contact: "Megan Ross", email: "megan.ross@horizonretail.com", phone: "212-555-0142", start: "2025-03-01", end: "2027-02-28", terms: "Net 30", status: "ACTIVE", manager: "Carlos Mendez" },
    { code: "CL-002", name: "Atlas Manufacturing", contact: "Robert Hayes", email: "rhayes@atlasmfg.com", phone: "313-555-0198", start: "2025-01-15", end: "2026-12-31", terms: "Net 45", status: "ACTIVE", manager: "Nina Brooks" },
    { code: "CL-003", name: "BlueWave Financial", contact: "Linda Osei", email: "linda.osei@bluewavefin.com", phone: "646-555-0177", start: "2025-04-01", end: "2027-03-31", terms: "Net 30", status: "ACTIVE", manager: "Sarah Chen" },
    { code: "CL-004", name: "Summit Health Partners", contact: "Dr. Alan Pierce", email: "apierce@summithealth.org", phone: "617-555-0133", start: "2024-11-01", end: "2026-10-31", terms: "Net 15", status: "ACTIVE", manager: "Nina Brooks" },
    { code: "CL-005", name: "Pinnacle Logistics", contact: "Rachel Kwan", email: "rkwan@pinnaclelog.com", phone: "214-555-0166", start: "2025-06-01", end: "2026-11-30", terms: "Net 30", status: "ACTIVE", manager: "Carlos Mendez" },
    { code: "CL-006", name: "Cedar Point Insurance", contact: "Oliver Grant", email: "ogrant@cedarpointins.com", phone: "312-555-0121", start: "2025-02-01", end: "2027-01-31", terms: "Net 60", status: "ACTIVE", manager: "Marcus Lee" },
    { code: "CL-007", name: "Northgate Media", contact: "Jasmine Cole", email: "jcole@northgatemedia.com", phone: "404-555-0154", start: "2024-08-01", end: "2026-05-31", terms: "Net 30", status: "CHURNED", manager: "Carlos Mendez" },
    { code: "CL-008", name: "Vertex Energy Solutions", contact: "Henry Osborn", email: "hosborn@vertexenergy.com", phone: "713-555-0188", start: "2026-09-01", end: "2027-08-31", terms: "Net 30", status: "ACTIVE", manager: "Nina Brooks" },
  ];
  const managerByName: Record<string, string> = { "Carlos Mendez": managerUser.id, "Nina Brooks": ownerUser.id, "Sarah Chen": ownerUser.id, "Marcus Lee": opsUser.id };

  const clients = await Promise.all(
    clientSeeds.map((c) =>
      prisma.client.create({
        data: {
          clientCode: c.code,
          name: c.name,
          contactPerson: c.contact,
          email: c.email,
          phone: c.phone,
          contractStartDate: new Date(c.start),
          contractEndDate: c.end ? new Date(c.end) : null,
          paymentTerms: c.terms,
          billingTerms: "Monthly invoicing, due per payment terms",
          accountManagerId: managerByName[c.manager],
          status: c.status,
        },
      })
    )
  );
  const client = (name: string) => clients.find((c) => c.name === name)!;

  // ------------------------------------------------------------- projects --
  type ProjSeed = {
    code: string; name: string; clientName: string; serviceName: string; pm: string;
    start: string; end: string | null; model: BillingModel; contractValue: number;
    budget: number; estHours: number; marginThreshold: number; status: ProjectStatus;
    team: string[];
  };
  const projSeeds: ProjSeed[] = [
    { code: "PRJ-001", name: "POS Modernization", clientName: "Horizon Retail Group", serviceName: "Software Development", pm: "Carlos Mendez", start: "2026-03-01", end: "2026-12-15", model: "HOURLY", contractValue: 180000, budget: 180000, estHours: 1600, marginThreshold: 20, status: "ACTIVE", team: ["David Kim", "Aisha Patel", "Carlos Mendez"] },
    { code: "PRJ-002", name: "Cloud Migration Phase 2", clientName: "Horizon Retail Group", serviceName: "Cloud Services", pm: "Sarah Chen", start: "2026-05-01", end: "2026-11-30", model: "FIXED", contractValue: 120000, budget: 90000, estHours: 850, marginThreshold: 25, status: "ACTIVE", team: ["John Smith", "Tom Walker"] },
    { code: "PRJ-003", name: "IoT Data Platform", clientName: "Atlas Manufacturing", serviceName: "Data Engineering", pm: "Nina Brooks", start: "2026-02-01", end: "2027-01-31", model: "HOURLY", contractValue: 150000, budget: 150000, estHours: 1400, marginThreshold: 20, status: "ACTIVE", team: ["Priya Nair", "Marcus Lee"] },
    { code: "PRJ-004", name: "Automation Line Controls", clientName: "Atlas Manufacturing", serviceName: "Automation", pm: "Nina Brooks", start: "2026-01-05", end: "2026-05-30", model: "FIXED", contractValue: 85000, budget: 70000, estHours: 700, marginThreshold: 20, status: "COMPLETED", team: ["Ben Carter"] },
    { code: "PRJ-005", name: "AI Fraud Detection Engine", clientName: "BlueWave Financial", serviceName: "AI & Machine Learning", pm: "Sarah Chen", start: "2026-04-01", end: "2027-03-31", model: "HOURLY", contractValue: 220000, budget: 150000, estHours: 1300, marginThreshold: 25, status: "ACTIVE", team: ["Marcus Lee", "Priya Nair"] },
    { code: "PRJ-006", name: "Security Audit & Hardening", clientName: "BlueWave Financial", serviceName: "Cybersecurity", pm: "Marcus Lee", start: "2026-08-01", end: "2026-10-10", model: "FIXED", contractValue: 60000, budget: 48000, estHours: 420, marginThreshold: 20, status: "ACTIVE", team: ["Elena Rodriguez"] },
    { code: "PRJ-007", name: "EHR Integration Retainer", clientName: "Summit Health Partners", serviceName: "Technology Consulting", pm: "Nina Brooks", start: "2026-01-01", end: null, model: "RETAINER", contractValue: 25000, budget: 25000, estHours: 180, marginThreshold: 20, status: "ACTIVE", team: ["Nina Brooks", "David Kim"] },
    { code: "PRJ-008", name: "IT Strategy Roadmap", clientName: "Summit Health Partners", serviceName: "IT Strategy", pm: "Nina Brooks", start: "2026-01-10", end: "2026-03-20", model: "MILESTONE", contractValue: 45000, budget: 35000, estHours: 320, marginThreshold: 20, status: "COMPLETED", team: ["Nina Brooks"] },
    { code: "PRJ-009", name: "Fleet Tracking App", clientName: "Pinnacle Logistics", serviceName: "Software Development", pm: "Carlos Mendez", start: "2026-06-01", end: "2026-12-31", model: "HOURLY", contractValue: 95000, budget: 95000, estHours: 900, marginThreshold: 20, status: "ACTIVE", team: ["Aisha Patel", "Grace Liu"] },
    { code: "PRJ-010", name: "Cloud Cost Optimization", clientName: "Pinnacle Logistics", serviceName: "Cloud Services", pm: "Sarah Chen", start: "2026-07-01", end: "2026-10-31", model: "HOURLY", contractValue: 40000, budget: 40000, estHours: 350, marginThreshold: 20, status: "ON_HOLD", team: ["Tom Walker"] },
    { code: "PRJ-011", name: "Claims Automation", clientName: "Cedar Point Insurance", serviceName: "Automation", pm: "Marcus Lee", start: "2026-03-15", end: "2026-12-01", model: "HOURLY", contractValue: 130000, budget: 130000, estHours: 1100, marginThreshold: 30, status: "ACTIVE", team: ["Ben Carter", "David Kim"] },
    { code: "PRJ-012", name: "Cybersecurity Retainer", clientName: "Cedar Point Insurance", serviceName: "Cybersecurity", pm: "Marcus Lee", start: "2026-02-01", end: null, model: "RETAINER", contractValue: 15000, budget: 15000, estHours: 110, marginThreshold: 20, status: "ACTIVE", team: ["Elena Rodriguez"] },
    { code: "PRJ-013", name: "Legacy App Support", clientName: "Northgate Media", serviceName: "Software Development", pm: "Carlos Mendez", start: "2025-08-01", end: "2026-05-31", model: "HOURLY", contractValue: 20000, budget: 20000, estHours: 200, marginThreshold: 20, status: "COMPLETED", team: ["David Kim"] },
    { code: "PRJ-014", name: "Website Redesign", clientName: "Northgate Media", serviceName: "Software Development", pm: "Carlos Mendez", start: "2026-04-01", end: "2026-05-01", model: "FIXED", contractValue: 18000, budget: 15000, estHours: 140, marginThreshold: 20, status: "CANCELLED", team: ["Grace Liu"] },
    { code: "PRJ-015", name: "Data Lake Build", clientName: "Vertex Energy Solutions", serviceName: "Data Engineering", pm: "Nina Brooks", start: "2026-11-01", end: "2027-05-31", model: "HOURLY", contractValue: 175000, budget: 175000, estHours: 1500, marginThreshold: 20, status: "PLANNING", team: ["Priya Nair"] },
  ];
  const pmByName: Record<string, string> = { "Carlos Mendez": managerUser.id, "Nina Brooks": ownerUser.id, "Sarah Chen": ownerUser.id, "Marcus Lee": opsUser.id };

  const projects = await Promise.all(
    projSeeds.map((p) =>
      prisma.project.create({
        data: {
          projectCode: p.code,
          name: p.name,
          clientId: client(p.clientName).id,
          projectManagerId: pmByName[p.pm],
          serviceId: svc(p.serviceName).id,
          startDate: new Date(p.start),
          endDate: p.end ? new Date(p.end) : null,
          billingModel: p.model,
          contractValue: p.contractValue,
          budget: p.budget,
          estimatedHours: p.estHours,
          marginThresholdPct: p.marginThreshold,
          status: p.status,
        },
      })
    )
  );
  const project = (code: string) => projects.find((p) => p.projectCode === code)!;

  for (const p of projSeeds) {
    for (const name of p.team) {
      await prisma.projectAssignment.create({ data: { projectId: project(p.code).id, employeeId: emp(name).id } });
    }
  }
  // client-level assignments (account team) derived from project teams
  const clientTeamSeen = new Set<string>();
  for (const p of projSeeds) {
    for (const name of p.team) {
      const key = `${p.clientName}:${name}`;
      if (clientTeamSeen.has(key)) continue;
      clientTeamSeen.add(key);
      await prisma.clientAssignment.create({ data: { clientId: client(p.clientName).id, employeeId: emp(name).id } });
    }
  }

  // ------------------------------------------------------- expense setup --
  const categorySeeds: { name: string; group: string }[] = [
    { name: "Payroll", group: "Employee" },
    { name: "Contractor Payments", group: "Employee" },
    { name: "Bonuses", group: "Employee" },
    { name: "Benefits", group: "Employee" },
    { name: "Recruiting", group: "Employee" },
    { name: "Training", group: "Employee" },
    { name: "SaaS", group: "Technology" },
    { name: "AI/LLM", group: "Technology" },
    { name: "Cloud", group: "Technology" },
    { name: "Hosting", group: "Technology" },
    { name: "Domains", group: "Technology" },
    { name: "Software Licenses", group: "Technology" },
    { name: "Developer Tools", group: "Technology" },
    { name: "Security", group: "Technology" },
    { name: "Rent", group: "Office" },
    { name: "Utilities", group: "Office" },
    { name: "Internet", group: "Office" },
    { name: "Equipment", group: "Office" },
    { name: "Supplies", group: "Office" },
    { name: "Maintenance", group: "Office" },
    { name: "Marketing", group: "Business" },
    { name: "Advertising", group: "Business" },
    { name: "Travel", group: "Business" },
    { name: "Hotels", group: "Business" },
    { name: "Transportation", group: "Business" },
    { name: "Meals", group: "Business" },
    { name: "Client Entertainment", group: "Business" },
    { name: "Events", group: "Business" },
    { name: "Legal", group: "Business" },
    { name: "Accounting", group: "Business" },
    { name: "Professional Services", group: "Business" },
    { name: "Bank Fees", group: "Financial" },
    { name: "Payment Processing", group: "Financial" },
    { name: "Interest", group: "Financial" },
    { name: "Other Financial Expenses", group: "Financial" },
  ];
  const categories = await Promise.all(categorySeeds.map((c) => prisma.expenseCategory.create({ data: { name: c.name, group: c.group } })));
  const cat = (name: string) => categories.find((c) => c.name === name)!;

  const vendorNames = [
    "Amazon Web Services", "Google Cloud", "Microsoft Azure", "OpenAI", "Anthropic", "Slack Technologies",
    "GitHub", "Figma", "Zoom", "WeWork", "Deel Inc.", "Gusto Payroll", "LinkedIn", "Delta Air Lines",
    "Marriott Hotels", "Uber for Business", "Hale & Partners LLP", "Summit CPA Group", "Stripe", "Chase Bank",
    "Datadog", "Jira (Atlassian)",
  ];
  const vendors = await Promise.all(vendorNames.map((name) => prisma.vendor.create({ data: { name } })));
  const vendor = (name: string) => vendors.find((v) => v.name === name)!;

  // --------------------------------------------------- recurring expenses --
  type RecSeed = { name: string; vendor: string; category: string; amount: number; freq: "MONTHLY"; day: number };
  const recSeeds: RecSeed[] = [
    { name: "AWS Cloud Infrastructure", vendor: "Amazon Web Services", category: "Cloud", amount: 3180, freq: "MONTHLY", day: 3 },
    { name: "Google Cloud Platform", vendor: "Google Cloud", category: "Cloud", amount: 940, freq: "MONTHLY", day: 3 },
    { name: "OpenAI API", vendor: "OpenAI", category: "AI/LLM", amount: 1250, freq: "MONTHLY", day: 5 },
    { name: "Anthropic API", vendor: "Anthropic", category: "AI/LLM", amount: 980, freq: "MONTHLY", day: 5 },
    { name: "Slack Workspace", vendor: "Slack Technologies", category: "SaaS", amount: 420, freq: "MONTHLY", day: 1 },
    { name: "GitHub Enterprise", vendor: "GitHub", category: "Developer Tools", amount: 310, freq: "MONTHLY", day: 1 },
    { name: "Figma Org Plan", vendor: "Figma", category: "Developer Tools", amount: 180, freq: "MONTHLY", day: 1 },
    { name: "Zoom Business", vendor: "Zoom", category: "SaaS", amount: 150, freq: "MONTHLY", day: 1 },
    { name: "Datadog Monitoring", vendor: "Datadog", category: "Security", amount: 560, freq: "MONTHLY", day: 7 },
    { name: "WeWork Office Lease", vendor: "WeWork", category: "Rent", amount: 4500, freq: "MONTHLY", day: 1 },
    { name: "Office Internet & Utilities", vendor: "WeWork", category: "Utilities", amount: 340, freq: "MONTHLY", day: 1 },
    { name: "Summit CPA Bookkeeping", vendor: "Summit CPA Group", category: "Accounting", amount: 850, freq: "MONTHLY", day: 10 },
    { name: "LinkedIn Talent & Ads", vendor: "LinkedIn", category: "Advertising", amount: 1100, freq: "MONTHLY", day: 15 },
  ];
  const recurring = await Promise.all(
    recSeeds.map((r) =>
      prisma.recurringExpense.create({
        data: {
          name: r.name,
          vendorId: vendor(r.vendor).id,
          categoryId: cat(r.category).id,
          amount: r.amount,
          frequency: "MONTHLY",
          startDate: new Date("2025-06-01"),
          nextOccurrence: new Date("2026-11-01"),
          active: true,
        },
      })
    )
  );

  // ===========================================================================
  // TIMESHEETS + REVENUE (the core of the connected model)
  // Buffered and flushed via createMany — individually awaiting ~2800
  // sequential creates over a WAN connection to Postgres (Neon) is the
  // single biggest cost in this script (hundreds of ms of round-trip
  // latency each, serially); batching cuts it to a handful of requests.
  // ===========================================================================
  console.log("Generating timesheets and revenue...");

  const activeProjSeeds = projSeeds.filter((p) => ["ACTIVE", "COMPLETED", "ON_HOLD"].includes(p.status));
  let revenueCount = 0;
  const invoiceableRevenueByClientMonth = new Map<string, { clientId: string; month: string; items: { projectName: string; serviceName: string; amount: number }[] }>();

  function addInvoiceable(clientId: string, month: string, projectName: string, serviceName: string, amount: number) {
    const key = `${clientId}:${month}`;
    const entry = invoiceableRevenueByClientMonth.get(key) ?? { clientId, month, items: [] };
    entry.items.push({ projectName, serviceName, amount });
    invoiceableRevenueByClientMonth.set(key, entry);
  }

  type TimesheetRow = {
    id: string; date: Date; employeeId: string; clientId: string | null; projectId: string | null; serviceId: string | null;
    hours: number; billable: boolean; description: string; status: "APPROVED"; approvedById: string; approvedAt: Date;
  };
  type RevenueRow = {
    id: string; revenueCode: string; clientId: string; projectId: string | null; employeeId: string | null; serviceId: string | null;
    timesheetId: string | null; revenueType: "HOURLY" | "RETAINER" | "MILESTONE" | "FIXED_PROJECT"; date: Date; amount: number; paymentStatus: "UNPAID";
  };
  const timesheetBuffer: TimesheetRow[] = [];
  const revenueBuffer: RevenueRow[] = [];

  function nextRevCode(): string {
    revenueCount++;
    return `REV-${String(revenueCount).padStart(5, "0")}`;
  }

  for (const p of activeProjSeeds) {
    const pStart = new Date(Math.max(new Date(p.start).getTime(), RANGE_START.getTime()));
    const pEndCap = p.end ? new Date(p.end) : TODAY;
    const pEnd = new Date(Math.min(pEndCap.getTime(), TODAY.getTime()));
    if (pStart > pEnd) continue;

    if (p.model === "HOURLY") {
      for (const memberName of p.team) {
        const e = empSeeds.find((x) => x.name === memberName)!;
        const employeeRecord = emp(memberName);
        const joined = new Date(e.joined);
        const memberStart = new Date(Math.max(pStart.getTime(), joined.getTime()));
        if (memberStart > pEnd) continue;

        const days = eachWeekday(memberStart, pEnd);
        for (const day of days) {
          // ~78% of weekdays this member logs time on this project (vacations, other work mixed in)
          if (rand() > 0.78) continue;
          const billableHours = round2(4 + rand() * 4.5); // 4-8.5 hrs billable
          const nonBillableHours = rand() > 0.75 ? round2(rand() * 1.5) : 0;

          const billTsId = randomUUID();
          timesheetBuffer.push({
            id: billTsId,
            date: day,
            employeeId: employeeRecord.id,
            clientId: client(p.clientName).id,
            projectId: project(p.code).id,
            serviceId: svc(p.serviceName).id,
            hours: billableHours,
            billable: true,
            description: `${p.serviceName} work on ${p.name}`,
            status: "APPROVED",
            approvedById: ownerUser.id,
            approvedAt: day,
          });

          const amount = round2(billableHours * e.billingRate);
          revenueBuffer.push({
            id: randomUUID(),
            revenueCode: nextRevCode(),
            clientId: client(p.clientName).id,
            projectId: project(p.code).id,
            employeeId: employeeRecord.id,
            serviceId: svc(p.serviceName).id,
            timesheetId: billTsId,
            revenueType: "HOURLY",
            date: day,
            amount,
            paymentStatus: "UNPAID",
          });
          const monthKey = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}`;
          addInvoiceable(client(p.clientName).id, monthKey, p.name, p.serviceName, amount);

          if (nonBillableHours > 0) {
            timesheetBuffer.push({
              id: randomUUID(),
              date: day,
              employeeId: employeeRecord.id,
              clientId: client(p.clientName).id,
              projectId: project(p.code).id,
              serviceId: svc(p.serviceName).id,
              hours: nonBillableHours,
              billable: false,
              description: "Internal sync / admin",
              status: "APPROVED",
              approvedById: ownerUser.id,
              approvedAt: day,
            });
          }
        }
      }
    } else if (p.model === "RETAINER") {
      for (const { start: mStart } of monthsInRange(pStart, pEnd)) {
        const amount = p.contractValue;
        revenueBuffer.push({
          id: randomUUID(),
          revenueCode: nextRevCode(),
          clientId: client(p.clientName).id,
          projectId: project(p.code).id,
          employeeId: null,
          serviceId: svc(p.serviceName).id,
          timesheetId: null,
          revenueType: "RETAINER",
          date: new Date(mStart.getFullYear(), mStart.getMonth(), 1),
          amount,
          paymentStatus: "UNPAID",
        });
        const monthKey = `${mStart.getFullYear()}-${String(mStart.getMonth() + 1).padStart(2, "0")}`;
        addInvoiceable(client(p.clientName).id, monthKey, p.name, p.serviceName, amount);

        // light retainer staffing hours, non-revenue-generating (already covered by flat fee)
        for (const memberName of p.team) {
          const employeeRecord = emp(memberName);
          const days = eachWeekday(mStart, new Date(Math.min(new Date(mStart.getFullYear(), mStart.getMonth() + 1, 0).getTime(), pEnd.getTime())));
          for (const day of days) {
            if (rand() > 0.35) continue;
            const hours = round2(1 + rand() * 3);
            timesheetBuffer.push({
              id: randomUUID(),
              date: day,
              employeeId: employeeRecord.id,
              clientId: client(p.clientName).id,
              projectId: project(p.code).id,
              serviceId: svc(p.serviceName).id,
              hours,
              billable: true,
              description: `Retainer coverage: ${p.name}`,
              status: "APPROVED",
              approvedById: ownerUser.id,
              approvedAt: day,
            });
          }
        }
      }
    } else if (p.model === "FIXED" || p.model === "MILESTONE") {
      const totalDays = Math.max(1, Math.round((pEnd.getTime() - pStart.getTime()) / 86400000));
      const milestones = p.model === "MILESTONE" ? [0.3, 0.4, 0.3] : [0.4, 0.4, 0.2];
      let offset = 0;
      for (let i = 0; i < milestones.length; i++) {
        offset += totalDays / milestones.length;
        const mDate = new Date(pStart.getTime() + offset * 86400000);
        if (mDate > pEnd) continue;
        const amount = round2(p.contractValue * milestones[i]);
        revenueBuffer.push({
          id: randomUUID(),
          revenueCode: nextRevCode(),
          clientId: client(p.clientName).id,
          projectId: project(p.code).id,
          employeeId: null,
          serviceId: svc(p.serviceName).id,
          timesheetId: null,
          revenueType: p.model === "MILESTONE" ? "MILESTONE" : "FIXED_PROJECT",
          date: mDate,
          amount,
          paymentStatus: "UNPAID",
        });
        const monthKey = `${mDate.getFullYear()}-${String(mDate.getMonth() + 1).padStart(2, "0")}`;
        addInvoiceable(client(p.clientName).id, monthKey, p.name, p.serviceName, amount);
      }

      // delivery team hours logged against the fixed-price budget (cost only, no separate revenue)
      for (const memberName of p.team) {
        const employeeRecord = emp(memberName);
        const days = eachWeekday(pStart, pEnd);
        for (const day of days) {
          if (rand() > 0.7) continue;
          const hours = round2(3.5 + rand() * 4.5);
          timesheetBuffer.push({
            id: randomUUID(),
            date: day,
            employeeId: employeeRecord.id,
            clientId: client(p.clientName).id,
            projectId: project(p.code).id,
            serviceId: svc(p.serviceName).id,
            hours,
            billable: true,
            description: `Delivery work on ${p.name}`,
            status: "APPROVED",
            approvedById: ownerUser.id,
            approvedAt: day,
          });
        }
      }
    }
  }

  await createManyChunked("timesheets", timesheetBuffer, (chunk) => prisma.timesheet.createMany({ data: chunk }));
  await createManyChunked("revenue", revenueBuffer, (chunk) => prisma.revenue.createMany({ data: chunk }));
  console.log(`  ${timesheetBuffer.length} timesheet entries, ${revenueBuffer.length} revenue records`);

  // ===========================================================================
  // INVOICES + PAYMENTS (built from the invoiceable revenue grouped above)
  // ===========================================================================
  console.log("Generating invoices and payments...");
  let invoiceCount = 0;
  let paymentCount = 0;
  const cashTxns: { date: Date; direction: "INFLOW" | "OUTFLOW"; category: string; amount: number; certainty: "ACTUAL"; sourceType: string; sourceId: string; notes?: string }[] = [];

  const sortedKeys = Array.from(invoiceableRevenueByClientMonth.keys()).sort();
  for (const key of sortedKeys) {
    const entry = invoiceableRevenueByClientMonth.get(key)!;
    const [year, month] = entry.month.split("-").map(Number);
    const invoiceDate = new Date(year, month - 1, 28 > new Date(year, month, 0).getDate() ? new Date(year, month, 0).getDate() : 28);
    const clientSeed = clientSeeds.find((c) => client(c.name).id === entry.clientId)!;
    const termsDays = clientSeed.terms === "Net 15" ? 15 : clientSeed.terms === "Net 45" ? 45 : clientSeed.terms === "Net 60" ? 60 : 30;
    const dueDate = new Date(invoiceDate.getTime() + termsDays * 86400000);
    const subtotal = round2(entry.items.reduce((s, i) => s + i.amount, 0));
    if (subtotal <= 0) continue;

    const taxRate = rand() < 0.15 ? 6.5 : 0;
    const taxAmount = round2(subtotal * (taxRate / 100));
    const total = round2(subtotal + taxAmount);

    // group line items by project+service
    const grouped = new Map<string, number>();
    for (const i of entry.items) {
      const k = `${i.projectName} — ${i.serviceName}`;
      grouped.set(k, (grouped.get(k) ?? 0) + i.amount);
    }

    // determine status based on age relative to "today"
    const daysSinceDue = Math.floor((TODAY.getTime() - dueDate.getTime()) / 86400000);
    let status: InvoiceStatus;
    let paidPortion = 0;
    if (daysSinceDue > 45) {
      status = "PAID";
      paidPortion = 1;
    } else if (daysSinceDue > 10 && rand() < 0.8) {
      status = "PAID";
      paidPortion = 1;
    } else if (daysSinceDue > 0) {
      // overdue — mix of partial and fully unpaid to populate AR aging buckets
      const r = rand();
      if (r < 0.35) {
        status = "PARTIALLY_PAID";
        paidPortion = 0.4 + rand() * 0.3;
      } else {
        status = "OVERDUE";
        paidPortion = 0;
      }
    } else {
      // not yet due
      const r = rand();
      status = r < 0.3 ? "PARTIALLY_PAID" : "SENT";
      paidPortion = status === "PARTIALLY_PAID" ? 0.3 + rand() * 0.3 : 0;
    }

    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber: `INV-2026-${String(invoiceCount + 1).padStart(4, "0")}`,
        clientId: entry.clientId,
        invoiceDate,
        dueDate,
        subtotal,
        taxRate,
        taxAmount,
        total,
        status,
        items: {
          create: Array.from(grouped.entries()).map(([desc, amt]) => ({ description: desc, quantity: 1, unitPrice: round2(amt), amount: round2(amt) })),
        },
      },
    });
    invoiceCount++;

    // link revenue rows in this client+month to this invoice
    await prisma.revenue.updateMany({
      where: { clientId: entry.clientId, date: { gte: new Date(year, month - 1, 1), lte: new Date(year, month, 0) }, invoiceId: null },
      data: { invoiceId: invoice.id, paymentStatus: status === "PAID" ? "PAID" : status === "PARTIALLY_PAID" ? "PARTIALLY_PAID" : "UNPAID" },
    });

    if (paidPortion > 0) {
      const paidAmount = round2(total * paidPortion);
      const paymentDate = new Date(Math.min(dueDate.getTime() - (rand() > 0.5 ? 2 : -5) * 86400000, TODAY.getTime()));
      const payment = await prisma.payment.create({
        data: { invoiceId: invoice.id, date: paymentDate, amount: paidAmount, method: pick(["ACH", "Wire Transfer", "Credit Card"]), reference: `PMT-${invoice.invoiceNumber}` },
      });
      paymentCount++;
      cashTxns.push({ date: paymentDate, direction: "INFLOW", category: "Client Payments", amount: paidAmount, certainty: "ACTUAL", sourceType: "Payment", sourceId: payment.id, notes: `${clientSeed.name} — ${invoice.invoiceNumber}` });
    }

    if (status === "SENT" || status === "PARTIALLY_PAID" || status === "OVERDUE") {
      const outstanding = round2(total - total * paidPortion);
      await prisma.accountsReceivable.create({ data: { invoiceId: invoice.id, outstanding, dueDate } });
    }
  }
  console.log(`  ${invoiceCount} invoices, ${paymentCount} payments`);

  // ===========================================================================
  // EXPENSES (recurring-generated + one-off variable spend)
  // ===========================================================================
  console.log("Generating expenses...");
  let expenseCount = 0;

  for (const { start: mStart } of monthsInRange(RANGE_START, TODAY)) {
    // --- payroll (employee group, full-time only) ---
    const activeFullTime = empSeeds.filter((e) => e.type === "FULL_TIME" && new Date(e.joined) <= mStart);
    const activeContractors = empSeeds.filter((e) => e.type === "CONTRACTOR" && new Date(e.joined) <= mStart);
    const payrollTotal = round2(activeFullTime.reduce((s, e) => s + e.monthlyCost, 0));
    const payrollDate = new Date(mStart.getFullYear(), mStart.getMonth(), 1);

    if (payrollTotal > 0) {
      const payrollExpense = await prisma.expense.create({
        data: {
          expenseCode: `EXP-${String(expenseCount + 1).padStart(5, "0")}`,
          date: payrollDate,
          categoryId: cat("Payroll").id,
          vendorId: vendor("Gusto Payroll").id,
          amount: payrollTotal,
          paymentMethod: "ACH",
          paidBy: "COMPANY",
          recurring: true,
          approvalStatus: "APPROVED",
          approvedById: financeUser.id,
          approvedAt: payrollDate,
          notes: "Monthly payroll run — full-time staff",
        },
      });
      expenseCount++;
      cashTxns.push({ date: payrollDate, direction: "OUTFLOW", category: "Payroll", amount: payrollTotal, certainty: "ACTUAL", sourceType: "Expense", sourceId: payrollExpense.id });

      const benefitsAmount = round2(payrollTotal * 0.08);
      const benefitsExpense = await prisma.expense.create({
        data: {
          expenseCode: `EXP-${String(expenseCount + 1).padStart(5, "0")}`,
          date: payrollDate,
          categoryId: cat("Benefits").id,
          amount: benefitsAmount,
          paymentMethod: "ACH",
          paidBy: "COMPANY",
          recurring: true,
          approvalStatus: "APPROVED",
          approvedById: financeUser.id,
          approvedAt: payrollDate,
          notes: "Health insurance & benefits",
        },
      });
      expenseCount++;
      cashTxns.push({ date: payrollDate, direction: "OUTFLOW", category: "Benefits", amount: benefitsAmount, certainty: "ACTUAL", sourceType: "Expense", sourceId: benefitsExpense.id });
    }

    for (const c of activeContractors) {
      const contractorExpense = await prisma.expense.create({
        data: {
          expenseCode: `EXP-${String(expenseCount + 1).padStart(5, "0")}`,
          date: payrollDate,
          categoryId: cat("Contractor Payments").id,
          vendorId: vendor("Deel Inc.").id,
          amount: c.monthlyCost,
          paymentMethod: "Wire Transfer",
          paidBy: "COMPANY",
          recurring: true,
          approvalStatus: "APPROVED",
          approvedById: financeUser.id,
          approvedAt: payrollDate,
          notes: `Contractor payment — ${c.name}`,
        },
      });
      expenseCount++;
      cashTxns.push({ date: payrollDate, direction: "OUTFLOW", category: "Contractor Payments", amount: c.monthlyCost, certainty: "ACTUAL", sourceType: "Expense", sourceId: contractorExpense.id });
    }

    // --- recurring operational expenses ---
    for (const r of recSeeds) {
      const d = new Date(mStart.getFullYear(), mStart.getMonth(), r.day);
      if (d > TODAY) continue;
      const jitter = 1 + (rand() - 0.5) * 0.08;
      const amount = round2(r.amount * jitter);
      const recRow = recurring[recSeeds.indexOf(r)];
      const e = await prisma.expense.create({
        data: {
          expenseCode: `EXP-${String(expenseCount + 1).padStart(5, "0")}`,
          date: d,
          categoryId: cat(r.category).id,
          vendorId: vendor(r.vendor).id,
          amount,
          paymentMethod: "Credit Card",
          paidBy: "COMPANY",
          recurring: true,
          recurringExpenseId: recRow.id,
          approvalStatus: "APPROVED",
          approvedById: financeUser.id,
          approvedAt: d,
        },
      });
      expenseCount++;
      cashTxns.push({ date: d, direction: "OUTFLOW", category: r.category, amount, certainty: "ACTUAL", sourceType: "Expense", sourceId: e.id });
    }

    // --- bank & payment-processing fees (scaled to that month's inflow) ---
    const bankFee = round2(45 + rand() * 20);
    const bankFeeExpense = await prisma.expense.create({
      data: {
        expenseCode: `EXP-${String(expenseCount + 1).padStart(5, "0")}`,
        date: new Date(mStart.getFullYear(), mStart.getMonth(), 28),
        categoryId: cat("Bank Fees").id,
        vendorId: vendor("Chase Bank").id,
        amount: bankFee,
        paymentMethod: "ACH",
        paidBy: "COMPANY",
        recurring: true,
        approvalStatus: "APPROVED",
        approvedById: financeUser.id,
        approvedAt: new Date(mStart.getFullYear(), mStart.getMonth(), 28),
      },
    });
    expenseCount++;
    cashTxns.push({ date: new Date(mStart.getFullYear(), mStart.getMonth(), 28), direction: "OUTFLOW", category: "Bank Fees", amount: bankFee, certainty: "ACTUAL", sourceType: "Expense", sourceId: bankFeeExpense.id });

    // --- occasional variable business expenses, some client/project-allocated ---
    const variableCount = randInt(2, 5);
    for (let i = 0; i < variableCount; i++) {
      const choices: { category: string; vendor: string; min: number; max: number; allocate: boolean }[] = [
        { category: "Travel", vendor: "Delta Air Lines", min: 350, max: 1200, allocate: true },
        { category: "Hotels", vendor: "Marriott Hotels", min: 300, max: 900, allocate: true },
        { category: "Transportation", vendor: "Uber for Business", min: 40, max: 180, allocate: true },
        { category: "Meals", vendor: "Uber for Business", min: 60, max: 320, allocate: true },
        { category: "Client Entertainment", vendor: "Marriott Hotels", min: 150, max: 600, allocate: true },
        { category: "Equipment", vendor: "Amazon Web Services", min: 400, max: 2600, allocate: false },
        { category: "Supplies", vendor: "Amazon Web Services", min: 60, max: 300, allocate: false },
        { category: "Legal", vendor: "Hale & Partners LLP", min: 800, max: 3200, allocate: false },
        { category: "Professional Services", vendor: "Summit CPA Group", min: 500, max: 1800, allocate: false },
        { category: "Recruiting", vendor: "LinkedIn", min: 600, max: 2400, allocate: false },
        { category: "Training", vendor: "GitHub", min: 150, max: 800, allocate: false },
        { category: "Events", vendor: "Marriott Hotels", min: 1200, max: 4500, allocate: false },
      ];
      const choice = pick(choices);
      const amount = round2(choice.min + rand() * (choice.max - choice.min));
      const day = randInt(1, Math.min(28, new Date(mStart.getFullYear(), mStart.getMonth() + 1, 0).getDate()));
      const d = new Date(mStart.getFullYear(), mStart.getMonth(), day);
      if (d > TODAY) continue;

      let allocClientId: string | undefined;
      let allocProjectId: string | undefined;
      if (choice.allocate && rand() < 0.6) {
        const activeAtDate = projSeeds.filter((p) => new Date(p.start) <= d && (!p.end || new Date(p.end) >= d));
        if (activeAtDate.length) {
          const pr = pick(activeAtDate);
          allocProjectId = project(pr.code).id;
          allocClientId = client(pr.clientName).id;
        }
      }

      const paidByEmployee = rand() < 0.25;
      const e = await prisma.expense.create({
        data: {
          expenseCode: `EXP-${String(expenseCount + 1).padStart(5, "0")}`,
          date: d,
          categoryId: cat(choice.category).id,
          vendorId: vendor(choice.vendor).id,
          amount,
          paymentMethod: paidByEmployee ? "Personal Card (reimbursable)" : "Corporate Card",
          paidBy: paidByEmployee ? "EMPLOYEE" : "COMPANY",
          employeeId: paidByEmployee ? emp(pick(empSeeds.map((e) => e.name))).id : undefined,
          clientId: allocClientId,
          projectId: allocProjectId,
          recurring: false,
          approvalStatus: rand() < 0.08 ? "PENDING" : "APPROVED",
          approvedById: rand() < 0.08 ? null : financeUser.id,
          approvedAt: rand() < 0.08 ? null : d,
          notes: `${choice.category} expense`,
        },
      });
      expenseCount++;
      if (e.approvalStatus === "APPROVED") {
        cashTxns.push({ date: d, direction: "OUTFLOW", category: choice.category, amount, certainty: "ACTUAL", sourceType: "Expense", sourceId: e.id });
      }
    }
  }
  console.log(`  ${expenseCount} expense records`);

  // --- a handful of payables (larger spend awaiting vendor payment) ---
  const bigExpenses = await prisma.expense.findMany({
    where: { category: { name: { in: ["Legal", "Equipment", "Events", "Professional Services"] } }, approvalStatus: "APPROVED" },
    orderBy: { date: "desc" },
    take: 6,
  });
  for (const be of bigExpenses) {
    const dueDate = new Date(be.date.getTime() + 30 * 86400000);
    const overdue = dueDate < TODAY && rand() < 0.4;
    const partiallyPaid = !overdue && rand() < 0.3;
    const balance = overdue ? num(be.amount) : partiallyPaid ? round2(num(be.amount) * 0.5) : dueDate < TODAY ? 0 : num(be.amount);
    const paidAmount = round2(num(be.amount) - balance);
    await prisma.accountsPayable.create({
      data: {
        vendorId: be.vendorId!,
        expenseId: be.id,
        invoiceRef: `VEND-${be.expenseCode}`,
        amount: be.amount,
        dueDate,
        paidAmount,
        balance,
        status: balance <= 0 ? "PAID" : overdue ? "OVERDUE" : partiallyPaid ? "PARTIALLY_PAID" : "OPEN",
      },
    });
  }
  function num(v: unknown): number {
    return Number(v) || 0;
  }

  // --- opening cash seed so the balance isn't built from zero ---
  cashTxns.push({ date: new Date(RANGE_START.getTime() - 86400000), direction: "INFLOW", category: "Opening Balance", amount: 150000, certainty: "ACTUAL", sourceType: "Manual", sourceId: "opening-balance", notes: "Owner capital / prior retained cash" });

  await prisma.cashTransaction.createMany({ data: cashTxns.map((t) => ({ ...t })) });
  console.log(`  ${cashTxns.length} cash transactions`);

  // --- financial periods ---
  for (const { start: mStart, end: mEnd } of monthsInRange(new Date("2026-01-01"), TODAY)) {
    await prisma.financialPeriod.create({
      data: { label: `${mStart.getFullYear()}-${String(mStart.getMonth() + 1).padStart(2, "0")}`, startDate: mStart, endDate: mEnd, isClosed: mEnd < new Date(TODAY.getFullYear(), TODAY.getMonth(), 1) },
    });
  }

  console.log("Seed complete.");
  console.log("Login as: owner@nexifyinfo.com / Nexify2026!  (or finance@ / ops@ / manager@ / employee@)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
