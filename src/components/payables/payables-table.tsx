"use client";

import { useTransition } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { DollarSign } from "lucide-react";
import { DataTable } from "@/components/data-table";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { formatUSD, formatDate } from "@/lib/format";
import { recordPayablePayment } from "@/app/(app)/payables/actions";

export interface PayableRow {
  id: string;
  vendorName: string;
  invoiceRef: string;
  amount: number;
  dueDate: string;
  paidAmount: number;
  balance: number;
  status: string;
}

export function PayablesTable({ rows }: { rows: PayableRow[] }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function payInFull(id: string, balance: number) {
    startTransition(async () => {
      try {
        await recordPayablePayment(id, balance);
        toast.success("Payment recorded");
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed");
      }
    });
  }

  const columns: ColumnDef<PayableRow, unknown>[] = [
    { accessorKey: "vendorName", header: "Vendor" },
    { accessorKey: "invoiceRef", header: "Reference" },
    { accessorKey: "amount", header: "Amount", cell: ({ getValue }) => <span className="tabular-nums">{formatUSD(getValue() as number)}</span> },
    { accessorKey: "dueDate", header: "Due Date", cell: ({ getValue }) => formatDate(getValue() as string) },
    { accessorKey: "paidAmount", header: "Paid", cell: ({ getValue }) => <span className="tabular-nums text-positive">{formatUSD(getValue() as number)}</span> },
    { accessorKey: "balance", header: "Balance", cell: ({ getValue }) => <span className="tabular-nums font-medium">{formatUSD(getValue() as number)}</span> },
    { accessorKey: "status", header: "Status", cell: ({ getValue }) => <StatusBadge status={getValue() as string} /> },
    {
      id: "actions",
      header: "",
      cell: ({ row }) =>
        row.original.balance > 0 ? (
          <Button size="sm" variant="outline" className="h-7" disabled={pending} onClick={() => payInFull(row.original.id, row.original.balance)}>
            <DollarSign className="h-3.5 w-3.5" /> Pay in Full
          </Button>
        ) : null,
    },
  ];

  return <DataTable columns={columns} data={rows} searchPlaceholder="Search payables..." exportFilename="accounts_payable" pageSize={20} />;
}
