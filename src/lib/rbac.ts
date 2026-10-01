export type Role = "OWNER" | "FINANCE" | "OPERATIONS" | "MANAGER" | "EMPLOYEE";

export const ROLE_LABELS: Record<Role, string> = {
  OWNER: "Owner",
  FINANCE: "Finance",
  OPERATIONS: "Operations",
  MANAGER: "Manager",
  EMPLOYEE: "Employee",
};

const FULL_FINANCIALS: Role[] = ["OWNER", "FINANCE"];
const OPS_ROLES: Role[] = ["OWNER", "FINANCE", "OPERATIONS", "MANAGER"];

export function canViewFinancials(role: string): boolean {
  return FULL_FINANCIALS.includes(role as Role);
}

export function canManageSettings(role: string): boolean {
  return FULL_FINANCIALS.includes(role as Role);
}

export function canApproveTimesheets(role: string): boolean {
  return OPS_ROLES.includes(role as Role);
}

export function canApproveExpenses(role: string): boolean {
  return FULL_FINANCIALS.includes(role as Role);
}

export function canManageEmployees(role: string): boolean {
  return (["OWNER", "OPERATIONS"] as Role[]).includes(role as Role);
}

export function canManageMasterData(role: string): boolean {
  return OPS_ROLES.includes(role as Role);
}

export function isEmployeeOnly(role: string): boolean {
  return role === "EMPLOYEE";
}
