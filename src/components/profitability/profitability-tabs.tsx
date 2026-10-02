"use client";

import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DataTable } from "@/components/data-table";
import { formatUSD, formatPercent } from "@/lib/format";

export interface ProfitRow {
  id: string;
  name: string;
  href?: string;
  revenue: number;
  directCost: number;
  contribution: number;
  margin: number;
}

function marginClass(margin: number) {
  if (margin >= 30) return "text-positive";
  if (margin < 10) return "text-negative";
  return "text-foreground";
}

function buildColumns(labelHeader: string): ColumnDef<ProfitRow, unknown>[] {
  return [
    {
      accessorKey: "name",
      header: labelHeader,
      cell: ({ row }) =>
        row.original.href ? (
          <Link href={row.original.href} prefetch={false} className="font-medium hover:underline">{row.original.name}</Link>
        ) : (
          <span className="font-medium">{row.original.name}</span>
        ),
    },
    { accessorKey: "revenue", header: "Revenue", cell: ({ getValue }) => <span className="tabular-nums">{formatUSD(getValue() as number)}</span> },
    { accessorKey: "directCost", header: "Direct Costs", cell: ({ getValue }) => <span className="tabular-nums text-muted-foreground">{formatUSD(getValue() as number)}</span> },
    { accessorKey: "contribution", header: "Contribution", cell: ({ getValue }) => <span className="tabular-nums font-medium">{formatUSD(getValue() as number)}</span> },
    { accessorKey: "margin", header: "Margin", cell: ({ getValue }) => <span className={`tabular-nums font-medium ${marginClass(getValue() as number)}`}>{formatPercent(getValue() as number)}</span> },
  ];
}

export function ProfitabilityTabs({
  byEmployee,
  byClient,
  byProject,
  byService,
  byMonth,
}: {
  byEmployee: ProfitRow[];
  byClient: ProfitRow[];
  byProject: ProfitRow[];
  byService: ProfitRow[];
  byMonth: ProfitRow[];
}) {
  return (
    <Tabs defaultValue="client">
      <TabsList>
        <TabsTrigger value="client">By Client</TabsTrigger>
        <TabsTrigger value="project">By Project</TabsTrigger>
        <TabsTrigger value="employee">By Employee</TabsTrigger>
        <TabsTrigger value="service">By Service</TabsTrigger>
        <TabsTrigger value="month">By Month</TabsTrigger>
      </TabsList>
      <TabsContent value="client">
        <DataTable columns={buildColumns("Client")} data={byClient} searchPlaceholder="Search clients..." exportFilename="profitability_by_client" />
      </TabsContent>
      <TabsContent value="project">
        <DataTable columns={buildColumns("Project")} data={byProject} searchPlaceholder="Search projects..." exportFilename="profitability_by_project" />
      </TabsContent>
      <TabsContent value="employee">
        <DataTable columns={buildColumns("Employee")} data={byEmployee} searchPlaceholder="Search employees..." exportFilename="profitability_by_employee" />
      </TabsContent>
      <TabsContent value="service">
        <DataTable columns={buildColumns("Service")} data={byService} searchPlaceholder="Search services..." exportFilename="profitability_by_service" />
      </TabsContent>
      <TabsContent value="month">
        <DataTable columns={buildColumns("Month")} data={byMonth} searchPlaceholder="Search months..." exportFilename="profitability_by_month" pageSize={12} />
      </TabsContent>
    </Tabs>
  );
}
