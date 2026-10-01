"use client";

import { useTransition } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, X } from "lucide-react";
import { DataTable } from "@/components/data-table";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { formatUSD, formatDate } from "@/lib/format";
import { setExpenseApproval } from "@/app/(app)/expenses/actions";

export interface ExpenseRow {
  id: string;
  expenseCode: string;
  date: string;
  category: string;
  group: string;
  vendor: string;
  amount: number;
  paidBy: string;
  clientName: string;
  projectName: string;
  recurring: boolean;
  approvalStatus: string;
}

export function ExpensesTable({ rows, canApprove }: { rows: ExpenseRow[]; canApprove: boolean }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function act(id: string, status: "APPROVED" | "REJECTED") {
    startTransition(async () => {
      try {
        await setExpenseApproval(id, status);
        toast.success(status === "APPROVED" ? "Expense approved" : "Expense rejected");
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed");
      }
    });
  }

  const columns: ColumnDef<ExpenseRow, unknown>[] = [
    { accessorKey: "expenseCode", header: "ID" },
    { accessorKey: "date", header: "Date", cell: ({ getValue }) => formatDate(getValue() as string) },
    { accessorKey: "category", header: "Category" },
    { accessorKey: "group", header: "Group", cell: ({ getValue }) => <span className="text-xs text-muted-foreground">{getValue() as string}</span> },
    { accessorKey: "vendor", header: "Vendor" },
    { accessorKey: "amount", header: "Amount", cell: ({ getValue }) => <span className="tabular-nums font-medium">{formatUSD(getValue() as number)}</span> },
    { accessorKey: "paidBy", header: "Paid By" },
    { accessorKey: "clientName", header: "Client" },
    { accessorKey: "projectName", header: "Project" },
    { accessorKey: "approvalStatus", header: "Status", cell: ({ getValue }) => <StatusBadge status={getValue() as string} /> },
    ...(canApprove
      ? ([
          {
            id: "actions",
            header: "",
            cell: ({ row }) =>
              row.original.approvalStatus === "PENDING" ? (
                <div className="flex items-center gap-1">
                  <Button size="icon" variant="outline" className="h-7 w-7 text-positive" disabled={pending} onClick={() => act(row.original.id, "APPROVED")}>
                    <Check className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="icon" variant="outline" className="h-7 w-7 text-negative" disabled={pending} onClick={() => act(row.original.id, "REJECTED")}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ) : null,
          },
        ] as ColumnDef<ExpenseRow, unknown>[])
      : []),
  ];

  return <DataTable columns={columns} data={rows} searchPlaceholder="Search expenses..." exportFilename="expenses" pageSize={20} />;
}
