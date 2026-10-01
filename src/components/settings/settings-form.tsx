"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { SettingsMap } from "@/lib/settings";
import { updateSettings } from "@/app/(app)/settings/actions";

export function SettingsForm({ settings }: { settings: SettingsMap }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      try {
        await updateSettings(formData);
        toast.success("Settings saved");
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Something went wrong");
      }
    });
  }

  return (
    <form action={handleSubmit} className="space-y-6">
      <div className="rounded-lg border border-border bg-card p-5 space-y-4">
        <h3 className="text-sm font-semibold">Company</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="companyName">Company Name</Label>
            <Input id="companyName" name="companyName" defaultValue={settings.companyName} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="currency">Currency</Label>
            <Input id="currency" name="currency" defaultValue={settings.currency} disabled />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="fiscalYearStart">Fiscal Year Start (MM-DD)</Label>
            <Input id="fiscalYearStart" name="fiscalYearStart" defaultValue={settings.fiscalYearStart} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="defaultPaymentTerms">Default Payment Terms</Label>
            <Input id="defaultPaymentTerms" name="defaultPaymentTerms" defaultValue={settings.defaultPaymentTerms} />
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-5 space-y-4">
        <h3 className="text-sm font-semibold">Financial</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="defaultBillingRate">Default Billing Rate ($/hr)</Label>
            <Input id="defaultBillingRate" name="defaultBillingRate" type="number" step="0.01" defaultValue={settings.defaultBillingRate} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="defaultTaxRatePct">Default Tax Rate (%)</Label>
            <Input id="defaultTaxRatePct" name="defaultTaxRatePct" type="number" step="0.01" defaultValue={settings.defaultTaxRatePct} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="marginThresholdPct">Profitability Margin Threshold (%)</Label>
            <Input id="marginThresholdPct" name="marginThresholdPct" type="number" step="1" defaultValue={settings.marginThresholdPct} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="utilizationThresholdPct">Utilization Threshold (%)</Label>
            <Input id="utilizationThresholdPct" name="utilizationThresholdPct" type="number" step="1" defaultValue={settings.utilizationThresholdPct} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cashMinThreshold">Minimum Cash Threshold ($)</Label>
            <Input id="cashMinThreshold" name="cashMinThreshold" type="number" step="100" defaultValue={settings.cashMinThreshold} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="largeReceivableThreshold">Large Receivable Threshold ($)</Label>
            <Input id="largeReceivableThreshold" name="largeReceivableThreshold" type="number" step="100" defaultValue={settings.largeReceivableThreshold} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="expenseSpikeThresholdPct">Expense Spike Threshold (%)</Label>
            <Input id="expenseSpikeThresholdPct" name="expenseSpikeThresholdPct" type="number" step="1" defaultValue={settings.expenseSpikeThresholdPct} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="contractExpiringDays">Contract Expiring Alert (days)</Label>
            <Input id="contractExpiringDays" name="contractExpiringDays" type="number" step="1" defaultValue={settings.contractExpiringDays} />
          </div>
        </div>
      </div>

      <Button type="submit" disabled={pending}>
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        Save Settings
      </Button>
    </form>
  );
}
