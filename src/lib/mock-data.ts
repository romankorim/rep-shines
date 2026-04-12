export interface Rep {
  id: string;
  name: string;
  email: string;
  team: string;
  quotaTarget: number;
  quotaPeriod: "month" | "quarter" | "year";
}

export interface Deal {
  id: string;
  repId: string;
  dealSize: number;
  closeDate: string;
  dealType: string;
  commissionAmount: number;
  tierApplied: string;
  status: "closed" | "open";
  notes?: string;
  createdAt: string;
}

export interface CompPlan {
  id: string;
  name: string;
  effectiveDate: string;
  isActive: boolean;
  tiers: CompTier[];
}

export interface CompTier {
  id: string;
  tierName: string;
  minDealSize: number;
  maxDealSize: number | null;
  commissionRate: number;
}

export interface QuotaTier {
  id: string;
  tierName: string;
  minAttainment: number;
  maxAttainment: number | null;
  rateMultiplier: number;
  color: string;
}

export const quotaTiers: QuotaTier[] = [
  { id: "qt1", tierName: "Below target", minAttainment: 0, maxAttainment: 50, rateMultiplier: 0.6, color: "destructive" },
  { id: "qt2", tierName: "Approaching", minAttainment: 50, maxAttainment: 100, rateMultiplier: 1.0, color: "warning" },
  { id: "qt3", tierName: "On target", minAttainment: 100, maxAttainment: 150, rateMultiplier: 1.3, color: "success" },
  { id: "qt4", tierName: "Accelerator", minAttainment: 150, maxAttainment: null, rateMultiplier: 1.6, color: "primary" },
];

export const reps: Rep[] = [
  { id: "r1", name: "Sarah Chen", email: "sarah@company.com", team: "Enterprise", quotaTarget: 200000, quotaPeriod: "quarter" },
  { id: "r2", name: "Marcus Johnson", email: "marcus@company.com", team: "Mid-market", quotaTarget: 150000, quotaPeriod: "quarter" },
  { id: "r3", name: "Emily Rodriguez", email: "emily@company.com", team: "Enterprise", quotaTarget: 200000, quotaPeriod: "quarter" },
  { id: "r4", name: "James Wilson", email: "james@company.com", team: "SMB", quotaTarget: 100000, quotaPeriod: "quarter" },
  { id: "r5", name: "Priya Patel", email: "priya@company.com", team: "Mid-market", quotaTarget: 150000, quotaPeriod: "quarter" },
  { id: "r6", name: "David Kim", email: "david@company.com", team: "Enterprise", quotaTarget: 200000, quotaPeriod: "quarter" },
];

export const compPlan: CompPlan = {
  id: "cp1",
  name: "Q1 2026 standard plan",
  effectiveDate: "2026-01-01",
  isActive: true,
  tiers: [
    { id: "t1", tierName: "Starter", minDealSize: 0, maxDealSize: 10000, commissionRate: 5 },
    { id: "t2", tierName: "Growth", minDealSize: 10000, maxDealSize: 50000, commissionRate: 8 },
    { id: "t3", tierName: "Enterprise", minDealSize: 50000, maxDealSize: null, commissionRate: 12 },
  ],
};

export const deals: Deal[] = [
  { id: "d1", repId: "r1", dealSize: 75000, closeDate: "2026-01-15", dealType: "New business", commissionAmount: 9000, tierApplied: "Enterprise", status: "closed", createdAt: "2026-01-15" },
  { id: "d2", repId: "r1", dealSize: 32000, closeDate: "2026-02-03", dealType: "Expansion", commissionAmount: 2560, tierApplied: "Growth", status: "closed", createdAt: "2026-02-03" },
  { id: "d3", repId: "r1", dealSize: 45000, closeDate: "2026-02-20", dealType: "New business", commissionAmount: 3600, tierApplied: "Growth", status: "closed", createdAt: "2026-02-20" },
  { id: "d4", repId: "r1", dealSize: 88000, closeDate: "2026-03-10", dealType: "New business", commissionAmount: 10560, tierApplied: "Enterprise", status: "closed", createdAt: "2026-03-10" },
  { id: "d5", repId: "r2", dealSize: 28000, closeDate: "2026-01-22", dealType: "New business", commissionAmount: 2240, tierApplied: "Growth", status: "closed", createdAt: "2026-01-22" },
  { id: "d6", repId: "r2", dealSize: 15000, closeDate: "2026-02-10", dealType: "Renewal", commissionAmount: 1200, tierApplied: "Growth", status: "closed", createdAt: "2026-02-10" },
  { id: "d7", repId: "r2", dealSize: 52000, closeDate: "2026-02-28", dealType: "New business", commissionAmount: 6240, tierApplied: "Enterprise", status: "closed", createdAt: "2026-02-28" },
  { id: "d8", repId: "r3", dealSize: 8500, closeDate: "2026-01-10", dealType: "Renewal", commissionAmount: 425, tierApplied: "Starter", status: "closed", createdAt: "2026-01-10" },
  { id: "d9", repId: "r3", dealSize: 120000, closeDate: "2026-03-01", dealType: "New business", commissionAmount: 14400, tierApplied: "Enterprise", status: "closed", createdAt: "2026-03-01" },
  { id: "d10", repId: "r4", dealSize: 5000, closeDate: "2026-01-18", dealType: "New business", commissionAmount: 250, tierApplied: "Starter", status: "closed", createdAt: "2026-01-18" },
  { id: "d11", repId: "r4", dealSize: 9500, closeDate: "2026-02-15", dealType: "Expansion", commissionAmount: 475, tierApplied: "Starter", status: "closed", createdAt: "2026-02-15" },
  { id: "d12", repId: "r4", dealSize: 22000, closeDate: "2026-03-05", dealType: "New business", commissionAmount: 1760, tierApplied: "Growth", status: "closed", createdAt: "2026-03-05" },
  { id: "d13", repId: "r5", dealSize: 41000, closeDate: "2026-01-28", dealType: "New business", commissionAmount: 3280, tierApplied: "Growth", status: "closed", createdAt: "2026-01-28" },
  { id: "d14", repId: "r5", dealSize: 67000, closeDate: "2026-02-22", dealType: "Expansion", commissionAmount: 8040, tierApplied: "Enterprise", status: "closed", createdAt: "2026-02-22" },
  { id: "d15", repId: "r5", dealSize: 33000, closeDate: "2026-03-15", dealType: "New business", commissionAmount: 2640, tierApplied: "Growth", status: "closed", createdAt: "2026-03-15" },
  { id: "d16", repId: "r6", dealSize: 95000, closeDate: "2026-01-30", dealType: "New business", commissionAmount: 11400, tierApplied: "Enterprise", status: "closed", createdAt: "2026-01-30" },
  { id: "d17", repId: "r6", dealSize: 18000, closeDate: "2026-02-18", dealType: "Renewal", commissionAmount: 1440, tierApplied: "Growth", status: "closed", createdAt: "2026-02-18" },
  { id: "d18", repId: "r6", dealSize: 55000, closeDate: "2026-03-20", dealType: "New business", commissionAmount: 6600, tierApplied: "Enterprise", status: "closed", createdAt: "2026-03-20" },
  { id: "d19", repId: "r2", dealSize: 7500, closeDate: "2026-03-12", dealType: "Renewal", commissionAmount: 375, tierApplied: "Starter", status: "closed", createdAt: "2026-03-12" },
  { id: "d20", repId: "r3", dealSize: 38000, closeDate: "2026-02-14", dealType: "New business", commissionAmount: 3040, tierApplied: "Growth", status: "closed", createdAt: "2026-02-14" },
];

// Helper functions
export function getRepDeals(repId: string): Deal[] {
  return deals.filter((d) => d.repId === repId && d.status === "closed");
}

export function getRepTotalRevenue(repId: string): number {
  return getRepDeals(repId).reduce((sum, d) => sum + d.dealSize, 0);
}

export function getRepTotalCommission(repId: string): number {
  return getRepDeals(repId).reduce((sum, d) => sum + d.commissionAmount, 0);
}

export function getRepAttainment(repId: string): number {
  const rep = reps.find((r) => r.id === repId);
  if (!rep) return 0;
  const totalRevenue = getRepTotalRevenue(repId);
  return (totalRevenue / rep.quotaTarget) * 100;
}

export function getRepQuotaTier(repId: string): QuotaTier {
  const attainment = getRepAttainment(repId);
  const matching = quotaTiers.filter((t: QuotaTier) => attainment >= t.minAttainment);
  return matching[matching.length - 1] ?? quotaTiers[0];
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);
}

export function formatPercent(value: number): string {
  return `${Math.round(value)}%`;
}
