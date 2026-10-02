"use client";

import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { DataTable } from "@/components/data-table";
import { StatusBadge } from "@/components/status-badge";
import { formatUSD, formatPercent } from "@/lib/format";

export interface EmployeeRow {
  id: string;
  employeeCode: string;
  name: string;
  role: string;
  department: string;
  employmentType: string;
  status: string;
  billingRate: number;
  hourlyCost: number;
  utilization: number;
  revenue: number;
}

export function EmployeesTable({ rows, showFinancials }: { rows: EmployeeRow[]; showFinancials: boolean }) {
  const columns: ColumnDef<EmployeeRow, unknown>[] = [
    { accessorKey: "employeeCode", header: "ID" },
    {
      accessorKey: "name",
      header: "Name",
      cell: ({ row }) => (
        <Link href={`/employees/${row.original.id}`} prefetch={false} className="font-medium text-foreground hover:underline">
          {row.original.name}
        </Link>
      ),
    },
    { accessorKey: "role", header: "Role" },
    { accessorKey: "department", header: "Department" },
    {
      accessorKey: "employmentType",
      header: "Type",
      cell: ({ getValue }) => <span className="text-muted-foreground text-xs">{(getValue() as string).replace("_", " ")}</span>,
    },
    { accessorKey: "status", header: "Status", cell: ({ getValue }) => <StatusBadge status={getValue() as string} /> },
    ...(showFinancials
      ? ([
          { accessorKey: "billingRate", header: "Billing Rate", cell: ({ getValue }) => <span className="tabular-nums">{formatUSD(getValue() as number)}/hr</span> },
          { accessorKey: "hourlyCost", header: "Cost Rate", cell: ({ getValue }) => <span className="tabular-nums text-muted-foreground">{formatUSD(getValue() as number)}/hr</span> },
          { accessorKey: "revenue", header: "Revenue (MTD)", cell: ({ getValue }) => <span className="tabular-nums">{formatUSD(getValue() as number)}</span> },
        ] as ColumnDef<EmployeeRow, unknown>[])
      : []),
    { accessorKey: "utilization", header: "Utilization", cell: ({ getValue }) => <span className="tabular-nums">{formatPercent(getValue() as number)}</span> },
  ];

  return <DataTable columns={columns} data={rows} searchPlaceholder="Search employees..." exportFilename="employees" />;
}
