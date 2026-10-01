"use client";

import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { DataTable } from "@/components/data-table";
import { StatusBadge } from "@/components/status-badge";
import { formatUSD, formatPercent } from "@/lib/format";

export interface ClientRow {
  id: string;
  clientCode: string;
  name: string;
  accountManager: string;
  paymentTerms: string;
  status: string;
  totalRevenue: number;
  outstanding: number;
  margin: number;
}

export function ClientsTable({ rows, showFinancials }: { rows: ClientRow[]; showFinancials: boolean }) {
  const columns: ColumnDef<ClientRow, unknown>[] = [
    { accessorKey: "clientCode", header: "ID" },
    {
      accessorKey: "name",
      header: "Client",
      cell: ({ row }) => (
        <Link href={`/clients/${row.original.id}`} className="font-medium text-foreground hover:underline">
          {row.original.name}
        </Link>
      ),
    },
    { accessorKey: "accountManager", header: "Account Manager" },
    { accessorKey: "paymentTerms", header: "Payment Terms" },
    { accessorKey: "status", header: "Status", cell: ({ getValue }) => <StatusBadge status={getValue() as string} /> },
    ...(showFinancials
      ? ([
          { accessorKey: "totalRevenue", header: "Revenue (MTD)", cell: ({ getValue }) => <span className="tabular-nums">{formatUSD(getValue() as number)}</span> },
          { accessorKey: "outstanding", header: "Outstanding", cell: ({ getValue }) => <span className="tabular-nums">{formatUSD(getValue() as number)}</span> },
          { accessorKey: "margin", header: "Margin", cell: ({ getValue }) => <span className="tabular-nums">{formatPercent(getValue() as number)}</span> },
        ] as ColumnDef<ClientRow, unknown>[])
      : []),
  ];

  return <DataTable columns={columns} data={rows} searchPlaceholder="Search clients..." exportFilename="clients" />;
}
