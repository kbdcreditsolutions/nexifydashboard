"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, CalendarRange, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { createTimesheetEntry, createWeeklyTimesheet } from "@/app/(app)/timesheets/actions";

interface Lookups {
  employees: { id: string; name: string }[];
  clients: { id: string; name: string }[];
  projects: { id: string; name: string; clientId: string }[];
  services: { id: string; name: string }[];
}

function ProjectClientFields({ clientId, setClientId, clients, projects }: { clientId: string; setClientId: (v: string) => void; clients: Lookups["clients"]; projects: Lookups["projects"] }) {
  const filtered = projects.filter((p) => !clientId || p.clientId === clientId);
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="space-y-1.5">
        <Label>Client</Label>
        <Select name="clientId" onValueChange={setClientId}>
          <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
          <SelectContent>{clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label>Project</Label>
        <Select name="projectId">
          <SelectTrigger><SelectValue placeholder="Select project" /></SelectTrigger>
          <SelectContent>{filtered.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
        </Select>
      </div>
    </div>
  );
}

export function TimesheetEntryDialog({ employees, clients, projects, services }: Lookups) {
  const [open, setOpen] = useState(false);
  const [clientId, setClientId] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      try {
        await createTimesheetEntry(formData);
        toast.success("Timesheet entry submitted");
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
        <Button size="sm" variant="outline"><Plus className="h-3.5 w-3.5" />Single Entry</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>Log Time</DialogTitle></DialogHeader>
        <form action={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="date">Date</Label>
              <Input id="date" name="date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required />
            </div>
            <div className="space-y-1.5">
              <Label>Employee</Label>
              <Select name="employeeId" required>
                <SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger>
                <SelectContent>{employees.map((e) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <ProjectClientFields clientId={clientId} setClientId={setClientId} clients={clients} projects={projects} />
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Service</Label>
              <Select name="serviceId">
                <SelectTrigger><SelectValue placeholder="Select service" /></SelectTrigger>
                <SelectContent>{services.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="hours">Hours</Label>
              <Input id="hours" name="hours" type="number" step="0.25" min="0.25" max="24" required />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox id="billable" name="billable" value="true" defaultChecked />
            <Label htmlFor="billable" className="font-normal">Billable</Label>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="description">Description</Label>
            <Input id="description" name="description" />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              Submit Entry
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

const DAY_LABELS = [
  { key: "mon", label: "Mon" },
  { key: "tue", label: "Tue" },
  { key: "wed", label: "Wed" },
  { key: "thu", label: "Thu" },
  { key: "fri", label: "Fri" },
] as const;

function mondayOf(d: Date): Date {
  const x = new Date(d);
  const day = x.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  x.setDate(x.getDate() + diff);
  return x;
}

export function WeeklyTimesheetDialog({ employees, clients, projects, services }: Lookups) {
  const [open, setOpen] = useState(false);
  const [clientId, setClientId] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      try {
        await createWeeklyTimesheet(formData);
        toast.success("Weekly timesheet submitted");
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
        <Button size="sm"><CalendarRange className="h-3.5 w-3.5" />Weekly Entry</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>Bulk Weekly Entry</DialogTitle></DialogHeader>
        <form action={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Employee</Label>
              <Select name="employeeId" required>
                <SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger>
                <SelectContent>{employees.map((e) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="weekStart">Week Starting (Monday)</Label>
              <Input id="weekStart" name="weekStart" type="date" defaultValue={mondayOf(new Date()).toISOString().slice(0, 10)} required />
            </div>
          </div>
          <ProjectClientFields clientId={clientId} setClientId={setClientId} clients={clients} projects={projects} />
          <div className="space-y-1.5">
            <Label>Service</Label>
            <Select name="serviceId">
              <SelectTrigger><SelectValue placeholder="Select service" /></SelectTrigger>
              <SelectContent>{services.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-5 gap-2">
            {DAY_LABELS.map((d) => (
              <div key={d.key} className="space-y-1.5">
                <Label htmlFor={d.key} className="text-xs">{d.label}</Label>
                <Input id={d.key} name={d.key} type="number" step="0.25" min="0" max="24" placeholder="0" />
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Checkbox id="billable-week" name="billable" value="true" defaultChecked />
            <Label htmlFor="billable-week" className="font-normal">Billable</Label>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              Submit Week
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
