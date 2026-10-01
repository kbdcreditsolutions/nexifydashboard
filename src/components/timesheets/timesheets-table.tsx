"use client";

import { useTransition } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, X } from "lucide-react";
import { DataTable } from "@/components/data-table";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { formatHours, formatDate } from "@/lib/format";
import { setTimesheetApproval } from "@/app/(app)/timesheets/actions";

export interface TimesheetRow {
  id: string;
  date: string;
  employeeName: string;
  clientName: string;
  projectName: string;
  serviceName: string;
  hours: number;
  billable: boolean;
  description: string;
  status: string;
}

export function TimesheetsTable({ rows, canApprove }: { rows: TimesheetRow[]; canApprove: boolean }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function act(id: string, status: "APPROVED" | "REJECTED") {
    startTransition(async () => {
      try {
        await setTimesheetApproval(id, status);
        toast.success(status === "APPROVED" ? "Timesheet approved" : "Timesheet rejected");
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed");
      }
    });
  }

  const columns: ColumnDef<TimesheetRow, unknown>[] = [
    { accessorKey: "date", header: "Date", cell: ({ getValue }) => formatDate(getValue() as string) },
    { accessorKey: "employeeName", header: "Employee" },
    { accessorKey: "clientName", header: "Client" },
    { accessorKey: "projectName", header: "Project" },
    { accessorKey: "serviceName", header: "Service" },
    { accessorKey: "hours", header: "Hours", cell: ({ getValue }) => <span className="tabular-nums">{formatHours(getValue() as number)}</span> },
    { accessorKey: "billable", header: "Billable", cell: ({ getValue }) => ((getValue() as boolean) ? "Yes" : "No") },
    { accessorKey: "status", header: "Status", cell: ({ getValue }) => <StatusBadge status={getValue() as string} /> },
    ...(canApprove
      ? ([
          {
            id: "actions",
            header: "",
            cell: ({ row }) =>
              row.original.status === "SUBMITTED" ? (
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
        ] as ColumnDef<TimesheetRow, unknown>[])
      : []),
  ];

  return <DataTable columns={columns} data={rows} searchPlaceholder="Search timesheets..." exportFilename="timesheets" pageSize={25} />;
}
