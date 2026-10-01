"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/data-table";
import { formatHours, formatPercent } from "@/lib/format";

export interface UtilRow {
  id: string;
  name: string;
  department: string;
  availableHours: number;
  billableHours: number;
  nonBillableHours: number;
  utilization: number;
}

export function UtilizationReportTable({ rows }: { rows: UtilRow[] }) {
  const columns: ColumnDef<UtilRow, unknown>[] = [
    { accessorKey: "name", header: "Employee" },
    { accessorKey: "department", header: "Department" },
    { accessorKey: "availableHours", header: "Available Hours", cell: ({ getValue }) => <span className="tabular-nums">{formatHours(getValue() as number)}</span> },
    { accessorKey: "billableHours", header: "Billable Hours", cell: ({ getValue }) => <span className="tabular-nums">{formatHours(getValue() as number)}</span> },
    { accessorKey: "nonBillableHours", header: "Non-Billable Hours", cell: ({ getValue }) => <span className="tabular-nums text-muted-foreground">{formatHours(getValue() as number)}</span> },
    { accessorKey: "utilization", header: "Utilization", cell: ({ getValue }) => <span className="tabular-nums font-medium">{formatPercent(getValue() as number)}</span> },
  ];

  return <DataTable columns={columns} data={rows} searchPlaceholder="Search employees..." exportFilename="utilization_report" />;
}
