"use client";

import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { DataTable } from "@/components/data-table";
import { StatusBadge } from "@/components/status-badge";
import { formatUSD } from "@/lib/format";

export interface ReceivableRow {
  invoiceId: string;
  invoiceNumber: string;
  clientId: string;
  clientName: string;
  invoiceTotal: number;
  received: number;
  outstanding: number;
  bucket: string;
}

const BUCKET_LABEL: Record<string, string> = {
  current: "Current",
  d1_30: "1-30 Days",
  d31_60: "31-60 Days",
  d61_90: "61-90 Days",
  d90plus: "90+ Days",
};

export function ReceivablesTable({ rows }: { rows: ReceivableRow[] }) {
  const columns: ColumnDef<ReceivableRow, unknown>[] = [
    {
      accessorKey: "invoiceNumber",
      header: "Invoice",
      cell: ({ row }) => <Link href={`/invoices/${row.original.invoiceId}`} prefetch={false} className="font-medium hover:underline">{row.original.invoiceNumber}</Link>,
    },
    {
      accessorKey: "clientName",
      header: "Client",
      cell: ({ row }) => <Link href={`/clients/${row.original.clientId}`} prefetch={false} className="hover:underline">{row.original.clientName}</Link>,
    },
    { accessorKey: "invoiceTotal", header: "Invoice Amount", cell: ({ getValue }) => <span className="tabular-nums">{formatUSD(getValue() as number)}</span> },
    { accessorKey: "received", header: "Received", cell: ({ getValue }) => <span className="tabular-nums text-positive">{formatUSD(getValue() as number)}</span> },
    { accessorKey: "outstanding", header: "Outstanding", cell: ({ getValue }) => <span className="tabular-nums font-medium">{formatUSD(getValue() as number)}</span> },
    { accessorKey: "bucket", header: "Aging", cell: ({ getValue }) => <StatusBadge status={BUCKET_LABEL[getValue() as string] ?? (getValue() as string)} /> },
  ];

  return <DataTable columns={columns} data={rows} searchPlaceholder="Search receivables..." exportFilename="accounts_receivable" pageSize={20} />;
}
