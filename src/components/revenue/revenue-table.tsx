"use client";

import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { DataTable } from "@/components/data-table";
import { StatusBadge } from "@/components/status-badge";
import { formatUSD, formatDate } from "@/lib/format";

export interface RevenueRow {
  id: string;
  revenueCode: string;
  date: string;
  clientId: string;
  clientName: string;
  projectName: string;
  employeeName: string;
  serviceName: string;
  revenueType: string;
  amount: number;
  paymentStatus: string;
  invoiceNumber: string;
}

export function RevenueTable({ rows }: { rows: RevenueRow[] }) {
  const columns: ColumnDef<RevenueRow, unknown>[] = [
    { accessorKey: "revenueCode", header: "ID" },
    { accessorKey: "date", header: "Date", cell: ({ getValue }) => formatDate(getValue() as string) },
    {
      accessorKey: "clientName",
      header: "Client",
      cell: ({ row }) => <Link href={`/clients/${row.original.clientId}`} prefetch={false} className="hover:underline">{row.original.clientName}</Link>,
    },
    { accessorKey: "projectName", header: "Project" },
    { accessorKey: "employeeName", header: "Employee" },
    { accessorKey: "serviceName", header: "Service" },
    { accessorKey: "revenueType", header: "Type", cell: ({ getValue }) => <span className="text-xs text-muted-foreground">{(getValue() as string).replace(/_/g, " ")}</span> },
    { accessorKey: "amount", header: "Amount", cell: ({ getValue }) => <span className="tabular-nums font-medium">{formatUSD(getValue() as number)}</span> },
    { accessorKey: "invoiceNumber", header: "Invoice" },
    { accessorKey: "paymentStatus", header: "Status", cell: ({ getValue }) => <StatusBadge status={getValue() as string} /> },
  ];

  return <DataTable columns={columns} data={rows} searchPlaceholder="Search revenue..." exportFilename="revenue" pageSize={20} />;
}
