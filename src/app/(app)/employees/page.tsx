import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { canManageEmployees, canViewFinancials } from "@/lib/rbac";
import { EmployeeFormDialog } from "@/components/employees/employee-form-dialog";
import { EmployeesTable, type EmployeeRow } from "@/components/employees/employees-table";
import { employeeEconomicsForRange, type EmployeeEconomics } from "@/lib/calc";
import { resolvePeriod } from "@/lib/dates";

export default async function EmployeesPage() {
  const session = await auth();
  const canManage = canManageEmployees(session?.user.role ?? "");
  const showFinancials = canViewFinancials(session?.user.role ?? "");
  const range = resolvePeriod("current_month");

  const [employees, econ] = await Promise.all([
    prisma.employee.findMany({ where: { deletedAt: null }, orderBy: { name: "asc" } }),
    employeeEconomicsForRange(range),
  ]);
  const econById = new Map<string, EmployeeEconomics>(econ.map((e) => [e.employeeId, e]));

  // Zero out compensation fields server-side for non-financial roles rather
  // than just hiding the table columns — the table is a client component,
  // so anything in `rows` ships in the RSC payload and is readable from
  // devtools regardless of which columns actually render.
  const rows: EmployeeRow[] = employees.map((e) => {
    const ec = econById.get(e.id);
    return {
      id: e.id,
      employeeCode: e.employeeCode,
      name: e.name,
      role: e.role,
      department: e.department,
      employmentType: e.employmentType,
      status: e.status,
      billingRate: showFinancials ? Number(e.billingRate) : 0,
      hourlyCost: showFinancials ? Number(e.hourlyCost) : 0,
      utilization: ec?.utilization ?? 0,
      revenue: showFinancials ? (ec?.revenue ?? 0) : 0,
    };
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Employees</h2>
          <p className="text-sm text-muted-foreground">Resource master, cost rates, and billing rates</p>
        </div>
        {canManage && <EmployeeFormDialog />}
      </div>
      <EmployeesTable rows={rows} showFinancials={showFinancials} />
    </div>
  );
}
