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
import { upsertClient } from "@/app/(app)/clients/actions";

export interface ClientFormValues {
  id?: string;
  clientCode: string;
  name: string;
  contactPerson?: string | null;
  email?: string | null;
  phone?: string | null;
  contractStartDate?: string | null;
  contractEndDate?: string | null;
  paymentTerms: string;
  billingTerms?: string | null;
  accountManagerId?: string | null;
  status: string;
  notes?: string | null;
}

export function ClientFormDialog({ client, accountManagers }: { client?: ClientFormValues; accountManagers: { id: string; name: string }[] }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const isEdit = Boolean(client?.id);

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      try {
        await upsertClient(client?.id ?? null, formData);
        toast.success(isEdit ? "Client updated" : "Client added");
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
          <Button size="sm"><Plus className="h-3.5 w-3.5" />Add Client</Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{isEdit ? "Edit Client" : "Add Client"}</DialogTitle></DialogHeader>
        <form action={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="clientCode">Client ID</Label>
              <Input id="clientCode" name="clientCode" defaultValue={client?.clientCode} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="name">Client Name</Label>
              <Input id="name" name="name" defaultValue={client?.name} required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="contactPerson">Contact Person</Label>
              <Input id="contactPerson" name="contactPerson" defaultValue={client?.contactPerson ?? ""} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" defaultValue={client?.email ?? ""} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" name="phone" defaultValue={client?.phone ?? ""} />
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select name="status" defaultValue={client?.status ?? "ACTIVE"}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="PROSPECT">Prospect</SelectItem>
                  <SelectItem value="INACTIVE">Inactive</SelectItem>
                  <SelectItem value="CHURNED">Churned</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="contractStartDate">Contract Start</Label>
              <Input id="contractStartDate" name="contractStartDate" type="date" defaultValue={client?.contractStartDate?.slice(0, 10) ?? ""} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="contractEndDate">Contract End</Label>
              <Input id="contractEndDate" name="contractEndDate" type="date" defaultValue={client?.contractEndDate?.slice(0, 10) ?? ""} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="paymentTerms">Payment Terms</Label>
              <Select name="paymentTerms" defaultValue={client?.paymentTerms ?? "Net 30"}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Net 15">Net 15</SelectItem>
                  <SelectItem value="Net 30">Net 30</SelectItem>
                  <SelectItem value="Net 45">Net 45</SelectItem>
                  <SelectItem value="Net 60">Net 60</SelectItem>
                  <SelectItem value="Due on Receipt">Due on Receipt</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Account Manager</Label>
              <Select name="accountManagerId" defaultValue={client?.accountManagerId ?? undefined}>
                <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
                <SelectContent>
                  {accountManagers.map((m) => (
                    <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="billingTerms">Billing Terms</Label>
            <Input id="billingTerms" name="billingTerms" defaultValue={client?.billingTerms ?? ""} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" name="notes" defaultValue={client?.notes ?? ""} rows={2} />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              {isEdit ? "Save Changes" : "Add Client"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
