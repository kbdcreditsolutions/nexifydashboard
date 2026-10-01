"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { generateInvoiceFromRevenue } from "@/app/(app)/invoices/actions";

function monthRangeDefaults() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

export function InvoiceGenerateDialog({ clients, defaultTaxRate }: { clients: { id: string; name: string }[]; defaultTaxRate: number }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const defaults = monthRangeDefaults();

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      try {
        const id = await generateInvoiceFromRevenue(formData);
        toast.success("Invoice generated from un-invoiced revenue");
        setOpen(false);
        router.push(`/invoices/${id}`);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Something went wrong");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm"><Plus className="h-3.5 w-3.5" />Generate Invoice</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Generate Invoice from Revenue</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground -mt-2">
          Pulls all un-invoiced revenue for the selected client and date range into a draft invoice.
        </p>
        <form action={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Client</Label>
            <Select name="clientId" required>
              <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
              <SelectContent>{clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="startDate">From</Label>
              <Input id="startDate" name="startDate" type="date" defaultValue={defaults.start} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="endDate">To</Label>
              <Input id="endDate" name="endDate" type="date" defaultValue={defaults.end} required />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="taxRatePct">Tax Rate (%)</Label>
            <Input id="taxRatePct" name="taxRatePct" type="number" step="0.01" min="0" max="100" defaultValue={defaultTaxRate} />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              Generate
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
