"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { createUser, updateUserRole, toggleUserActive } from "@/app/(app)/settings/actions";

const ROLES = ["OWNER", "FINANCE", "OPERATIONS", "MANAGER", "EMPLOYEE"];
const ROLE_LABEL: Record<string, string> = { OWNER: "Owner", FINANCE: "Finance", OPERATIONS: "Operations", MANAGER: "Manager", EMPLOYEE: "Employee" };

export interface UserRow {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
}

export function UsersManager({ users, currentUserId }: { users: UserRow[]; currentUserId: string }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleCreate(formData: FormData) {
    startTransition(async () => {
      try {
        await createUser(formData);
        toast.success("User added");
        setOpen(false);
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Something went wrong");
      }
    });
  }

  function handleRoleChange(userId: string, role: string) {
    startTransition(async () => {
      try {
        await updateUserRole(userId, role);
        toast.success("Role updated");
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed");
      }
    });
  }

  function handleToggleActive(userId: string, isActive: boolean) {
    startTransition(async () => {
      try {
        await toggleUserActive(userId, isActive);
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed");
      }
    });
  }

  return (
    <div className="rounded-lg border border-border bg-card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Users &amp; Roles</h3>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline"><Plus className="h-3.5 w-3.5" />Add User</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader><DialogTitle>Add User</DialogTitle></DialogHeader>
            <form action={handleCreate} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="name">Name</Label>
                <Input id="name" name="name" required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input id="email" name="email" type="email" required />
              </div>
              <div className="space-y-1.5">
                <Label>Role</Label>
                <Select name="role" defaultValue="EMPLOYEE">
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{ROLES.map((r) => <SelectItem key={r} value={r}>{ROLE_LABEL[r]}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">Temporary Password</Label>
                <Input id="password" name="password" type="password" minLength={8} required />
              </div>
              <DialogFooter>
                <Button type="submit" disabled={pending}>
                  {pending && <Loader2 className="h-4 w-4 animate-spin" />}
                  Add User
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-xs text-muted-foreground">
            <th className="text-left py-1.5">Name</th>
            <th className="text-left py-1.5">Email</th>
            <th className="text-left py-1.5">Role</th>
            <th className="text-left py-1.5">Active</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id} className="border-b border-border last:border-0">
              <td className="py-2">{u.name}{u.id === currentUserId && <span className="text-xs text-muted-foreground"> (you)</span>}</td>
              <td className="py-2 text-muted-foreground">{u.email}</td>
              <td className="py-2">
                <Select defaultValue={u.role} onValueChange={(v) => handleRoleChange(u.id, v)} disabled={pending || u.id === currentUserId}>
                  <SelectTrigger className="h-8 w-36 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>{ROLES.map((r) => <SelectItem key={r} value={r}>{ROLE_LABEL[r]}</SelectItem>)}</SelectContent>
                </Select>
              </td>
              <td className="py-2">
                <Switch checked={u.isActive} disabled={pending || u.id === currentUserId} onCheckedChange={(v) => handleToggleActive(u.id, v)} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
