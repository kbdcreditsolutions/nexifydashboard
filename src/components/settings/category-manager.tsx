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
import { createExpenseCategory } from "@/app/(app)/settings/actions";

const GROUPS = ["Employee", "Technology", "Office", "Business", "Financial"];

export function CategoryManager({ categories }: { categories: { id: string; name: string; group: string; isCustom: boolean }[] }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      try {
        await createExpenseCategory(formData);
        toast.success("Category added");
        setOpen(false);
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Something went wrong");
      }
    });
  }

  const byGroup = GROUPS.map((g) => ({ group: g, items: categories.filter((c) => c.group === g) }));

  return (
    <div className="rounded-lg border border-border bg-card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Expense Categories</h3>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline"><Plus className="h-3.5 w-3.5" />Add Category</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader><DialogTitle>Add Expense Category</DialogTitle></DialogHeader>
            <form action={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="name">Category Name</Label>
                <Input id="name" name="name" required />
              </div>
              <div className="space-y-1.5">
                <Label>Group</Label>
                <Select name="group" defaultValue="Business">
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{GROUPS.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={pending}>
                  {pending && <Loader2 className="h-4 w-4 animate-spin" />}
                  Add Category
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {byGroup.map(({ group, items }) => (
          <div key={group}>
            <p className="text-xs font-semibold text-muted-foreground mb-1.5">{group}</p>
            <div className="space-y-1">
              {items.map((c) => (
                <div key={c.id} className="text-sm flex items-center gap-1.5">
                  {c.name}
                  {c.isCustom && <span className="text-[10px] text-muted-foreground">(custom)</span>}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
