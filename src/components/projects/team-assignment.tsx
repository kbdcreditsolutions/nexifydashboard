"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { X } from "lucide-react";
import Link from "next/link";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { assignEmployeeToProject, removeEmployeeFromProject } from "@/app/(app)/projects/actions";

export function TeamAssignment({
  projectId,
  assigned,
  available,
  canManage,
}: {
  projectId: string;
  assigned: { employeeId: string; name: string; role: string }[];
  available: { id: string; name: string }[];
  canManage: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleAssign(employeeId: string) {
    startTransition(async () => {
      try {
        await assignEmployeeToProject(projectId, employeeId);
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to assign");
      }
    });
  }

  function handleRemove(employeeId: string) {
    startTransition(async () => {
      try {
        await removeEmployeeFromProject(projectId, employeeId);
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to remove");
      }
    });
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <h3 className="text-sm font-semibold mb-3">Project Team</h3>
      <div className="space-y-1.5">
        {assigned.length === 0 && <p className="text-sm text-muted-foreground">No team members assigned.</p>}
        {assigned.map((a) => (
          <div key={a.employeeId} className="flex items-center justify-between rounded-md px-2.5 py-1.5 hover:bg-accent/40">
            <Link href={`/employees/${a.employeeId}`} prefetch={false} className="text-sm hover:underline">
              {a.name} <span className="text-muted-foreground text-xs">&middot; {a.role}</span>
            </Link>
            {canManage && (
              <button onClick={() => handleRemove(a.employeeId)} disabled={pending} className="text-muted-foreground hover:text-negative">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        ))}
      </div>
      {canManage && available.length > 0 && (
        <div className="mt-3 pt-3 border-t border-border">
          <Select onValueChange={handleAssign} disabled={pending}>
            <SelectTrigger className="h-8 text-sm">
              <SelectValue placeholder="Add team member..." />
            </SelectTrigger>
            <SelectContent>
              {available.map((e) => (
                <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}
