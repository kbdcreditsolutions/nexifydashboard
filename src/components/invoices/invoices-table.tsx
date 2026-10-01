"use client";

import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { DataTable } from "@/components/data-table";
import { StatusBadge } from "@/components/status-badge";
import { formatUSD, formatDate } from "@/lib/format";

export interface InvoiceRow {
  id: string;
  invoiceNumber: string;
  clientName: string;
  invoiceDate: string;
  dueDate: string;
  total: number;
  paid: number;
  balance: number;
  status: string;
}

export function InvoicesTable({ rows }: { rows: InvoiceRow[] }) {
  const columns: ColumnDef<InvoiceRow, unknown>[] = [
    {
      accessorKey: "invoiceNumber",
      header: "Invoice #",
      cell: ({ row }) => <Link href={`/invoices/${row.original.id}`} className="font-medium hover:underline">{row.original.invoiceNumber}</Link>,
    },
    { accessorKey: "clientName", header: "Client" },
    { accessorKey: "invoiceDate", header: "Invoice Date", cell: ({ getValue }) => formatDate(getValue() as string) },
    { accessorKey: "dueDate", header: "Due Date", cell: ({ getValue }) => formatDate(getValue() as string) },
    { accessorKey: "total", header: "Total", cell: ({ getValue }) => <span className="tabular-nums font-medium">{formatUSD(getValue() as number)}</span> },
    { accessorKey: "paid", header: "Paid", cell: ({ getValue }) => <span className="tabular-nums text-positive">{formatUSD(getValue() as number)}</span> },
    { accessorKey: "balance", header: "Balance", cell: ({ getValue }) => <span className="tabular-nums">{formatUSD(getValue() as number)}</span> },
    { accessorKey: "status", header: "Status", cell: ({ getValue }) => <StatusBadge status={getValue() as string} /> },
  ];

  return <DataTable columns={columns} data={rows} searchPlaceholder="Search invoices..." exportFilename="invoices" pageSize={20} />;
}
