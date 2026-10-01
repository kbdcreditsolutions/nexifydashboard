"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Pencil, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { upsertEmployee } from "@/app/(app)/employees/actions";

export interface EmployeeFormValues {
  id?: string;
  employeeCode: string;
  name: string;
  email: string;
  role: string;
  department: string;
  employmentType: string;
  joiningDate: string;
  status: string;
  monthlyCost: number;
  hourlyCost: number;
  standardWeeklyHours: number;
  billingRate: number;
  notes?: string | null;
}

export function EmployeeFormDialog({ employee }: { employee?: EmployeeFormValues }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const isEdit = Boolean(employee?.id);

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      try {
        await upsertEmployee(employee?.id ?? null, formData);
        toast.success(isEdit ? "Employee updated" : "Employee added");
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
          <Button variant="outline" size="sm">
            <Pencil className="h-3.5 w-3.5" />
            Edit
          </Button>
        ) : (
          <Button size="sm">
            <Plus className="h-3.5 w-3.5" />
            Add Employee
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Employee" : "Add Employee"}</DialogTitle>
        </DialogHeader>
        <form action={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="employeeCode">Employee ID</Label>
              <Input id="employeeCode" name="employeeCode" defaultValue={employee?.employeeCode} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" defaultValue={employee?.name} required />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" defaultValue={employee?.email} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="role">Role / Title</Label>
              <Input id="role" name="role" defaultValue={employee?.role} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="department">Department</Label>
              <Input id="department" name="department" defaultValue={employee?.department} required />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Employment Type</Label>
              <Select name="employmentType" defaultValue={employee?.employmentType ?? "FULL_TIME"}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="FULL_TIME">Full-Time</SelectItem>
                  <SelectItem value="PART_TIME">Part-Time</SelectItem>
                  <SelectItem value="CONTRACTOR">Contractor</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select name="status" defaultValue={employee?.status ?? "ACTIVE"}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="INACTIVE">Inactive</SelectItem>
                  <SelectItem value="TERMINATED">Terminated</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="joiningDate">Joining Date</Label>
              <Input id="joiningDate" name="joiningDate" type="date" defaultValue={employee?.joiningDate?.slice(0, 10)} required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="monthlyCost">Monthly Cost ($)</Label>
              <Input id="monthlyCost" name="monthlyCost" type="number" step="0.01" min="0" defaultValue={employee?.monthlyCost} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="hourlyCost">Hourly Cost ($)</Label>
              <Input id="hourlyCost" name="hourlyCost" type="number" step="0.01" min="0" defaultValue={employee?.hourlyCost} required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="standardWeeklyHours">Standard Weekly Hours</Label>
              <Input id="standardWeeklyHours" name="standardWeeklyHours" type="number" step="0.5" min="0" defaultValue={employee?.standardWeeklyHours ?? 40} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="billingRate">Billing Rate ($/hr)</Label>
              <Input id="billingRate" name="billingRate" type="number" step="0.01" min="0" defaultValue={employee?.billingRate} required />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="notes">Notes</Label>
            <Input id="notes" name="notes" defaultValue={employee?.notes ?? ""} />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              {isEdit ? "Save Changes" : "Add Employee"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
