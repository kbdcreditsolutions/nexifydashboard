import { prisma } from "@/lib/prisma";

export const DEFAULT_SETTINGS = {
  companyName: "Nexify InfoSystems",
  currency: "USD",
  fiscalYearStart: "01-01",
  defaultPaymentTerms: "Net 30",
  marginThresholdPct: "20",
  utilizationThresholdPct: "70",
  cashMinThreshold: "25000",
  largeReceivableThreshold: "10000",
  expenseSpikeThresholdPct: "30",
  contractExpiringDays: "30",
  defaultBillingRate: "100",
  defaultTaxRatePct: "0",
};

export type SettingsMap = typeof DEFAULT_SETTINGS;

// Shared between the settings form's validation (actions.ts) and the
// contract-expiry alert query (alerts.ts) so the stored value and the
// value actually applied never diverge silently.
export const MAX_CONTRACT_EXPIRING_DAYS = 3650;

// Memoize the in-flight *promise*, not just the resolved value — callers
// that both call getSettings() concurrently (e.g. computeAlerts() fires
// several queries in one Promise.all, two of which each call this) would
// otherwise both see a cold cache and both fire prisma.settings.findMany(),
// and could in principle observe different values if a setSetting() update
// landed between them.
let inflight: Promise<SettingsMap> | null = null;

export async function getSettings(): Promise<SettingsMap> {
  if (!inflight) {
    inflight = (async () => {
      const rows = await prisma.settings.findMany();
      const map = { ...DEFAULT_SETTINGS };
      for (const row of rows) {
        if (row.key in map) (map as Record<string, string>)[row.key] = row.value;
      }
      return map;
    })();
  }
  return inflight;
}

export async function setSetting(key: keyof SettingsMap, value: string) {
  await prisma.settings.upsert({
    where: { key },
    create: { id: `setting_${key}`, key, value },
    update: { value },
  });
  inflight = null;
}

export function invalidateSettingsCache() {
  inflight = null;
}
