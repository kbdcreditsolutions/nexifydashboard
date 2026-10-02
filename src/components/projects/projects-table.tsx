"use client";

import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { DataTable } from "@/components/data-table";
import { StatusBadge } from "@/components/status-badge";
import { formatUSD, formatPercent } from "@/lib/format";

export interface ProjectRow {
  id: string;
  projectCode: string;
  name: string;
  clientName: string;
  billingModel: string;
  status: string;
  budget: number;
  revenue: number;
  margin: number;
  alertCount: number;
}

export function ProjectsTable({ rows, showFinancials }: { rows: ProjectRow[]; showFinancials: boolean }) {
  const columns: ColumnDef<ProjectRow, unknown>[] = [
    { accessorKey: "projectCode", header: "ID" },
    {
      accessorKey: "name",
      header: "Project",
      cell: ({ row }) => (
        <Link href={`/projects/${row.original.id}`} prefetch={false} className="font-medium text-foreground hover:underline inline-flex items-center gap-1.5">
          {row.original.name}
          {row.original.alertCount > 0 && <AlertTriangle className="h-3.5 w-3.5 text-warning" />}
        </Link>
      ),
    },
    { accessorKey: "clientName", header: "Client" },
    { accessorKey: "billingModel", header: "Billing Model", cell: ({ getValue }) => <span className="text-xs text-muted-foreground">{(getValue() as string).replace("_", " ")}</span> },
    { accessorKey: "status", header: "Status", cell: ({ getValue }) => <StatusBadge status={getValue() as string} /> },
    ...(showFinancials
      ? ([
          { accessorKey: "budget", header: "Budget", cell: ({ getValue }) => <span className="tabular-nums">{formatUSD(getValue() as number)}</span> },
          { accessorKey: "revenue", header: "Revenue (MTD)", cell: ({ getValue }) => <span className="tabular-nums">{formatUSD(getValue() as number)}</span> },
          { accessorKey: "margin", header: "Margin", cell: ({ getValue }) => <span className="tabular-nums">{formatPercent(getValue() as number)}</span> },
        ] as ColumnDef<ProjectRow, unknown>[])
      : []),
  ];

  return <DataTable columns={columns} data={rows} searchPlaceholder="Search projects..." exportFilename="projects" />;
}
