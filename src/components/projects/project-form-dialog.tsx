"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Pencil, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { upsertProject } from "@/app/(app)/projects/actions";

export interface ProjectFormValues {
  id?: string;
  projectCode: string;
  name: string;
  clientId: string;
  projectManagerId?: string | null;
  serviceId?: string | null;
  startDate: string;
  endDate?: string | null;
  billingModel: string;
  contractValue: number;
  budget: number;
  estimatedHours: number;
  marginThresholdPct: number;
  status: string;
  notes?: string | null;
}

export function ProjectFormDialog({
  project,
  clients,
  managers,
  services,
  defaultClientId,
}: {
  project?: ProjectFormValues;
  clients: { id: string; name: string }[];
  managers: { id: string; name: string }[];
  services: { id: string; name: string }[];
  defaultClientId?: string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const isEdit = Boolean(project?.id);

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      try {
        await upsertProject(project?.id ?? null, formData);
        toast.success(isEdit ? "Project updated" : "Project added");
        setOpen(false);
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Something went wrong");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {isEdit ? (
          <Button variant="outline" size="sm"><Pencil className="h-3.5 w-3.5" />Edit</Button>
        ) : (
          <Button size="sm"><Plus className="h-3.5 w-3.5" />Add Project</Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{isEdit ? "Edit Project" : "Add Project"}</DialogTitle></DialogHeader>
        <form action={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="projectCode">Project ID</Label>
              <Input id="projectCode" name="projectCode" defaultValue={project?.projectCode} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="name">Project Name</Label>
              <Input id="name" name="name" defaultValue={project?.name} required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Client</Label>
              <Select name="clientId" defaultValue={project?.clientId ?? defaultClientId}>
                <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
                <SelectContent>
                  {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Project Manager</Label>
              <Select name="projectManagerId" defaultValue={project?.projectManagerId ?? undefined}>
                <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
                <SelectContent>
                  {managers.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Service Type</Label>
              <Select name="serviceId" defaultValue={project?.serviceId ?? undefined}>
                <SelectTrigger><SelectValue placeholder="Select service" /></SelectTrigger>
                <SelectContent>
                  {services.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Billing Model</Label>
              <Select name="billingModel" defaultValue={project?.billingModel ?? "HOURLY"}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="HOURLY">Hourly</SelectItem>
                  <SelectItem value="FIXED">Fixed Price</SelectItem>
                  <SelectItem value="RETAINER">Retainer</SelectItem>
                  <SelectItem value="MILESTONE">Milestone</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="startDate">Start Date</Label>
              <Input id="startDate" name="startDate" type="date" defaultValue={project?.startDate?.slice(0, 10)} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="endDate">End Date</Label>
              <Input id="endDate" name="endDate" type="date" defaultValue={project?.endDate?.slice(0, 10) ?? ""} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="contractValue">Contract Value ($)</Label>
              <Input id="contractValue" name="contractValue" type="number" step="0.01" min="0" defaultValue={project?.contractValue ?? 0} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="budget">Budget ($)</Label>
              <Input id="budget" name="budget" type="number" step="0.01" min="0" defaultValue={project?.budget ?? 0} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="estimatedHours">Estimated Hours</Label>
              <Input id="estimatedHours" name="estimatedHours" type="number" step="1" min="0" defaultValue={project?.estimatedHours ?? 0} required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="marginThresholdPct">Margin Threshold (%)</Label>
              <Input id="marginThresholdPct" name="marginThresholdPct" type="number" step="1" min="0" max="100" defaultValue={project?.marginThresholdPct ?? 20} required />
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select name="status" defaultValue={project?.status ?? "PLANNING"}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="PLANNING">Planning</SelectItem>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="ON_HOLD">On Hold</SelectItem>
                  <SelectItem value="COMPLETED">Completed</SelectItem>
                  <SelectItem value="CANCELLED">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" name="notes" defaultValue={project?.notes ?? ""} rows={2} />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              {isEdit ? "Save Changes" : "Add Project"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
