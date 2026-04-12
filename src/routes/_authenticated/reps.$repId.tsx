import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { repQueryOptions } from "@/lib/query-options";

export const Route = createFileRoute("/_authenticated/reps/$repId")({
  loader: ({ params, context }) => context.queryClient.ensureQueryData(repQueryOptions(params.repId)),
  component: RepProfilePage,
  notFoundComponent: () => (
    <AppLayout>
      <div className="text-center py-20">
        <p className="text-muted-foreground">Rep not found</p>
        <Link to="/reps" className="text-primary text-sm mt-2 inline-block">Back to reps</Link>
      </div>
    </AppLayout>
  ),
  errorComponent: ({ error }) => (
    <AppLayout>
      <div className="text-center py-20">
        <p className="text-destructive">{error.message}</p>
        <Link to="/reps" className="text-primary text-sm mt-2 inline-block">Back to reps</Link>
      </div>
    </AppLayout>
  ),
});

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);
}
function formatPercent(value: number): string {
  return `${Math.round(value)}%`;
}

const tierColorMap: Record<string, string> = {
  destructive: "bg-destructive/15 text-destructive border-destructive/20",
  warning: "bg-warning/15 text-warning-foreground border-warning/20",
  success: "bg-success/15 text-success border-success/20",
  primary: "bg-primary/15 text-primary border-primary/20",
};

const progressColorMap: Record<string, string> = {
  destructive: "[&>[data-slot=indicator]]:bg-destructive",
  warning: "[&>[data-slot=indicator]]:bg-warning",
  success: "[&>[data-slot=indicator]]:bg-success",
  primary: "[&>[data-slot=indicator]]:bg-primary",
};

function RepProfilePage() {
  const { repId } = Route.useParams();
  const { data } = useSuspenseQuery(repQueryOptions(repId));
  const { rep, deals, totalRevenue, totalCommission, attainment, quotaTier, quotaTiers } = data;

  const closedDeals = deals.filter((d) => d.status === "closed");

  const byType = closedDeals.reduce<Record<string, { count: number; revenue: number; commission: number }>>((acc, d) => {
    if (!acc[d.deal_type]) acc[d.deal_type] = { count: 0, revenue: 0, commission: 0 };
    acc[d.deal_type].count++;
    acc[d.deal_type].revenue += Number(d.deal_size);
    acc[d.deal_type].commission += Number(d.commission_amount);
    return acc;
  }, {});

  return (
    <AppLayout>
      <div className="space-y-6">
        <Link to="/reps">
          <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground -ml-2">
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to reps
          </Button>
        </Link>

        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary text-lg font-bold text-secondary-foreground">
            {rep.name.split(" ").map((n: string) => n[0]).join("")}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold tracking-tight">{rep.name}</h1>
              <Badge variant="outline" className={cn("text-[10px] font-medium border", tierColorMap[quotaTier.color])}>
                {quotaTier.tier_name}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">{rep.team} · {rep.email}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            { label: "Total revenue", value: formatCurrency(totalRevenue) },
            { label: "Commission earned", value: formatCurrency(totalCommission) },
            { label: "Quota attainment", value: formatPercent(attainment) },
            { label: "Deals closed", value: String(closedDeals.length) },
          ].map((stat) => (
            <div key={stat.label} className="rounded-lg border border-border/50 bg-card p-4">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">{stat.label}</p>
              <p className="text-lg font-bold text-card-foreground">{stat.value}</p>
            </div>
          ))}
        </div>

        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Quota progress</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{formatCurrency(totalRevenue)} of {formatCurrency(Number(rep.quota_target))}</span>
              <span className="font-semibold">{formatPercent(attainment)}</span>
            </div>
            <Progress value={Math.min(attainment, 100)} className={cn("h-2.5 bg-secondary", progressColorMap[quotaTier.color])} />
            <div className="grid grid-cols-4 gap-2">
              {quotaTiers.map((qt) => (
                <div key={qt.id} className={cn("rounded-md p-2 text-center text-[10px]", quotaTier.id === qt.id ? "bg-primary/10 ring-1 ring-primary/30" : "bg-muted/30")}>
                  <p className="font-medium text-foreground">{qt.tier_name}</p>
                  <p className="text-muted-foreground">{qt.min_attainment}%{qt.max_attainment ? `–${qt.max_attainment}%` : "+"}</p>
                  <p className="text-muted-foreground">{qt.rate_multiplier}x rate</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Earnings by deal type</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(byType).map(([type, d]) => (
                <div key={type} className="flex items-center justify-between py-2 border-b border-border/30 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-foreground">{type}</p>
                    <p className="text-xs text-muted-foreground">{d.count} deals · {formatCurrency(d.revenue)} revenue</p>
                  </div>
                  <p className="text-sm font-semibold text-success">{formatCurrency(d.commission)}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Deal history</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    {["Deal size", "Close date", "Type", "Tier", "Commission"].map((h) => (
                      <th key={h} className="px-4 py-2.5 text-left text-[11px] font-medium text-muted-foreground uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {deals.map((deal) => (
                    <tr key={deal.id} className="border-b border-border/30">
                      <td className="px-4 py-3 font-semibold">{formatCurrency(Number(deal.deal_size))}</td>
                      <td className="px-4 py-3 text-muted-foreground">{new Date(deal.close_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</td>
                      <td className="px-4 py-3 text-muted-foreground">{deal.deal_type}</td>
                      <td className="px-4 py-3"><Badge variant="outline" className="text-[10px]">{deal.tier_applied}</Badge></td>
                      <td className="px-4 py-3 font-semibold text-success">{formatCurrency(Number(deal.commission_amount))}</td>
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
