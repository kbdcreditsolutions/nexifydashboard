"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Send, Ban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { setInvoiceStatus } from "@/app/(app)/invoices/actions";

export function InvoiceStatusActions({ id, status }: { id: string; status: string }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function act(next: "SENT" | "CANCELLED") {
    startTransition(async () => {
      try {
        await setInvoiceStatus(id, next);
        toast.success(next === "SENT" ? "Invoice marked as sent" : "Invoice cancelled");
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed");
      }
    });
  }

  if (status !== "DRAFT") return null;

  return (
    <div className="flex items-center gap-2">
      <Button size="sm" variant="outline" disabled={pending} onClick={() => act("SENT")}>
        <Send className="h-3.5 w-3.5" /> Mark as Sent
      </Button>
      <Button size="sm" variant="outline" disabled={pending} onClick={() => act("CANCELLED")}>
        <Ban className="h-3.5 w-3.5" /> Cancel
      </Button>
    </div>
  );
}
