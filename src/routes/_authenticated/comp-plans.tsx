import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calculator, Check } from "lucide-react";
import { useState } from "react";
import { compPlansQueryOptions } from "@/lib/query-options";

export const Route = createFileRoute("/_authenticated/comp-plans")({
  loader: ({ context }) => context.queryClient.ensureQueryData(compPlansQueryOptions()),
  component: CompPlansPage,
});

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);
}

function CompPlansPage() {
  const { data } = useSuspenseQuery(compPlansQueryOptions());
  const { activePlan, activeTiers, quotaTiers, reps } = data;

  const [previewDealSize, setPreviewDealSize] = useState("");
  const [previewAttainment, setPreviewAttainment] = useState("");

  function calculatePreview(): string | null {
    const size = parseFloat(previewDealSize);
    const att = parseFloat(previewAttainment);
    if (isNaN(size) || isNaN(att) || size <= 0) return null;

    const tier = activeTiers.find(
      (t) => size >= Number(t.min_deal_size) && (t.max_deal_size === null || size < Number(t.max_deal_size))
    );
    if (!tier) return null;

    const quotaTier = [...quotaTiers].reverse().find((qt) => att >= Number(qt.min_attainment)) ?? quotaTiers[0];
    if (!quotaTier) return null;

    const commission = size * (Number(tier.commission_rate) / 100) * Number(quotaTier.rate_multiplier);
    return `${formatCurrency(commission)} (${tier.commission_rate}% × ${quotaTier.rate_multiplier}x = ${(Number(tier.commission_rate) * Number(quotaTier.rate_multiplier)).toFixed(1)}% effective)`;
  }

  const preview = calculatePreview();

  return (
    <AppLayout>
      <div className="space-y-4 sm:space-y-6">
        <div>
          <h1 className="text-lg sm:text-xl font-bold tracking-tight">Comp plans</h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">Configure commission tiers and quota targets</p>
        </div>

        {activePlan && (
          <Card className="border-border/50">
            <CardHeader className="pb-3 px-4 sm:px-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <CardTitle className="text-sm sm:text-base">{activePlan.name}</CardTitle>
                  <CardDescription className="mt-1 text-xs sm:text-sm">Effective from {new Date(activePlan.effective_date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</CardDescription>
                </div>
                <Badge className="bg-success/15 text-success border-success/20 border w-fit">
                  <Check className="h-3 w-3 mr-1" />Active
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-6 px-4 sm:px-6">
              <div>
                <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Deal size tiers</h3>
                <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
                  {activeTiers.map((tier) => (
                    <div key={tier.id} className="rounded-lg border border-border/50 bg-muted/20 p-3 sm:p-4">
                      <p className="text-sm font-semibold text-foreground mb-1">{tier.tier_name}</p>
                      <p className="text-xs text-muted-foreground mb-2">
                        {formatCurrency(Number(tier.min_deal_size))} – {tier.max_deal_size ? formatCurrency(Number(tier.max_deal_size)) : "∞"}
                      </p>
                      <p className="text-xl sm:text-2xl font-bold text-primary">{tier.commission_rate}%</p>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Commission rate</p>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Quota attainment multipliers</h3>
                <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
                  {quotaTiers.map((tier) => (
                    <div key={tier.id} className="rounded-lg border border-border/50 bg-muted/20 p-3 sm:p-4">
                      <p className="text-xs sm:text-sm font-semibold text-foreground mb-1">{tier.tier_name}</p>
                      <p className="text-[11px] sm:text-xs text-muted-foreground mb-2">
                        {tier.min_attainment}%{tier.max_attainment ? `–${tier.max_attainment}%` : "+"} attainment
                      </p>
                      <p className="text-xl sm:text-2xl font-bold text-foreground">{tier.rate_multiplier}x</p>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Rate multiplier</p>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="border-border/50">
          <CardHeader className="pb-3 px-4 sm:px-6">
            <div className="flex items-center gap-2">
              <Calculator className="h-4 w-4 text-primary" />
              <CardTitle className="text-xs sm:text-sm">Commission calculator</CardTitle>
            </div>
            <CardDescription className="text-xs sm:text-sm">Preview commission for a hypothetical deal</CardDescription>
          </CardHeader>
          <CardContent className="px-4 sm:px-6">
            <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-end gap-3 sm:gap-4">
              <div className="space-y-1.5 w-full sm:w-auto">
                <Label className="text-xs">Deal size ($)</Label>
                <Input type="number" placeholder="25000" value={previewDealSize} onChange={(e) => setPreviewDealSize(e.target.value)} className="h-10 sm:h-9 sm:w-40 text-sm" />
              </div>
              <div className="space-y-1.5 w-full sm:w-auto">
                <Label className="text-xs">Quota attainment (%)</Label>
                <Input type="number" placeholder="120" value={previewAttainment} onChange={(e) => setPreviewAttainment(e.target.value)} className="h-10 sm:h-9 sm:w-40 text-sm" />
              </div>
              {preview && (
                <div className="rounded-lg bg-primary/10 border border-primary/20 px-4 py-2.5 w-full sm:w-auto">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Estimated commission</p>
                  <p className="text-xs sm:text-sm font-semibold text-primary">{preview}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardHeader className="pb-3 px-4 sm:px-6">
            <CardTitle className="text-xs sm:text-sm">Rep quota targets</CardTitle>
            <CardDescription className="text-xs sm:text-sm">Current quota assignments for Q1 2026</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {/* Mobile card view */}
            <div className="space-y-0 md:hidden">
              {reps.map((rep) => (
                <div key={rep.id} className="flex items-center justify-between px-4 py-3 border-b border-border/30 last:border-0">
                  <div>
                    <p className="text-sm font-medium">{rep.name}</p>
                    <p className="text-[11px] text-muted-foreground">{rep.team} · {rep.quota_period}</p>
                  </div>
                  <p className="text-sm font-semibold">{formatCurrency(Number(rep.quota_target))}</p>
                </div>
              ))}
            </div>
            {/* Desktop table view */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    {["Rep", "Team", "Quota target", "Period"].map((h) => (
                      <th key={h} className="px-4 py-2.5 text-left text-[11px] font-medium text-muted-foreground uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {reps.map((rep) => (
                    <tr key={rep.id} className="border-b border-border/30">
                      <td className="px-4 py-3 font-medium">{rep.name}</td>
                      <td className="px-4 py-3 text-muted-foreground">{rep.team}</td>
                      <td className="px-4 py-3 font-semibold">{formatCurrency(Number(rep.quota_target))}</td>
                      <td className="px-4 py-3 text-muted-foreground capitalize">{rep.quota_period}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
