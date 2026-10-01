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

let cache: SettingsMap | null = null;

export async function getSettings(): Promise<SettingsMap> {
  if (cache) return cache;
  const rows = await prisma.settings.findMany();
  const map = { ...DEFAULT_SETTINGS };
  for (const row of rows) {
    if (row.key in map) (map as Record<string, string>)[row.key] = row.value;
  }
  cache = map;
  return map;
}

export async function setSetting(key: keyof SettingsMap, value: string) {
  await prisma.settings.upsert({
    where: { key },
    create: { id: `setting_${key}`, key, value },
    update: { value },
  });
  cache = null;
}

export function invalidateSettingsCache() {
  cache = null;
}
