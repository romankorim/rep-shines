import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/AppLayout";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, FileText, Users, TrendingUp } from "lucide-react";
import { dashboardQueryOptions } from "@/lib/query-options";
import { cn } from "@/lib/utils";
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";

export const Route = createFileRoute("/_authenticated/dashboard")({
  loader: ({ context }) => context.queryClient.ensureQueryData(dashboardQueryOptions()),
  component: DashboardPage,
});

import { formatCurrency } from "@/lib/format-utils";

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

const DONUT_COLORS = ["#159A9C", "#002333", "#B4BEC9", "#DEEFE7"];

function DashboardPage() {
  const { data } = useSuspenseQuery(dashboardQueryOptions());

  const donutData = data.tierCounts.map((tier) => ({
    name: tier.tier_name,
    value: tier.count,
  }));

  const barData = [...data.reps]
    .sort((a, b) => b.totalRevenue - a.totalRevenue)
    .slice(0, 8)
    .map((rep) => ({
      name: rep.name.split(" ")[0],
      revenue: Math.round(rep.totalRevenue),
      commission: Math.round(rep.totalCommission),
    }));

  return (
    <AppLayout>
      <div className="space-y-4 sm:space-y-6">
        <div className="animate-fade-in">
          <h1 className="text-lg sm:text-xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">Q1 2026 commission overview</p>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4 animate-fade-in" style={{ animationDelay: "0.05s", animationFillMode: "both" }}>
          <MetricCard title="Total commissions" value={formatCurrency(data.totalCommissions)} subtitle="Q1 2026 YTD" icon={DollarSign} trend={{ value: "12% vs Q4", positive: true }} />
          <MetricCard title="Deals closed" value={String(data.totalDeals)} subtitle="Across all reps" icon={FileText} />
          <MetricCard title="Avg deal size" value={formatCurrency(data.avgDealSize)} icon={TrendingUp} />
          <MetricCard title="Active reps" value={String(data.reps.length)} subtitle={`${data.tierCounts.find((t) => t.tier_name === "On target")?.count ?? 0} on target`} icon={Users} />
        </div>

        {/* Charts row */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 animate-fade-in" style={{ animationDelay: "0.1s", animationFillMode: "both" }}>
          <Card>
            <CardHeader className="pb-2 px-4 sm:px-6">
              <CardTitle className="text-xs sm:text-sm font-semibold">Tier distribution</CardTitle>
            </CardHeader>
            <CardContent className="px-2 sm:px-6">
              <div className="h-[200px] sm:h-[240px] flex items-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={donutData}
                      cx="50%"
                      cy="50%"
                      innerRadius="40%"
                      outerRadius="65%"
                      paddingAngle={3}
                      dataKey="value"
                      stroke="none"
                    >
                      {donutData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={DONUT_COLORS[index % DONUT_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => [`${value} reps`, ""]} />
                    <Legend wrapperStyle={{ fontSize: "11px" }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2 px-4 sm:px-6">
              <CardTitle className="text-xs sm:text-sm font-semibold">Revenue vs commission</CardTitle>
            </CardHeader>
            <CardContent className="px-2 sm:px-6">
              <div className="h-[200px] sm:h-[240px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barData} barGap={2}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} width={45} />
                    <Tooltip formatter={(value: number) => [formatCurrency(value), ""]} />
                    <Legend wrapperStyle={{ fontSize: "11px" }} />
                    <Bar dataKey="revenue" name="Revenue" fill="#159A9C" />
                    <Bar dataKey="commission" name="Commission" fill="#002333" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Rep performance list view */}
        <div className="animate-fade-in" style={{ animationDelay: "0.15s", animationFillMode: "both" }}>
          <h2 className="text-xs sm:text-sm font-semibold mb-3">Rep performance</h2>

          {/* Mobile card view */}
          <div className="space-y-3 md:hidden">
            {data.reps.map((rep) => (
              <Link key={rep.id} to="/reps/$repId" params={{ repId: rep.id }} className="block">
                <div className="rounded-lg border border-border/50 bg-card p-3.5 hover:bg-muted/20 transition-colors">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-[10px] font-medium text-secondary-foreground">
                        {rep.name.split(" ").map((n: string) => n[0]).join("")}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{rep.name}</p>
                        <p className="text-[11px] text-muted-foreground">{rep.team}</p>
                      </div>
                    </div>
                    <Badge variant="outline" className={cn("text-[10px] font-medium border", tierColorMap[rep.quotaTier?.color ?? "primary"])}>
                      {rep.quotaTier?.tier_name ?? "Unknown"}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center mt-3">
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase">Revenue</p>
                      <p className="text-xs font-semibold">{formatCurrency(rep.totalRevenue)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase">Commission</p>
                      <p className="text-xs font-semibold text-success">{formatCurrency(rep.totalCommission)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase">Attainment</p>
                      <p className="text-xs font-semibold">{Math.round(rep.attainment)}%</p>
                    </div>
                  </div>
                  <div className="mt-2">
                    <Progress
                      value={Math.min(rep.attainment, 100)}
                      className={cn("h-1.5 bg-secondary", progressColorMap[rep.quotaTier?.color ?? "primary"])}
                    />
                  </div>
                </div>
              </Link>
            ))}
          </div>

          {/* Desktop table view */}
          <Card className="hidden md:block overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="px-4 py-2.5 text-left text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Name</th>
                    <th className="px-4 py-2.5 text-left text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Team</th>
                    <th className="px-4 py-2.5 text-left text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Deals</th>
                    <th className="px-4 py-2.5 text-left text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Revenue</th>
                    <th className="px-4 py-2.5 text-left text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Commission</th>
                    <th className="px-4 py-2.5 text-left text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Attainment</th>
                    <th className="px-4 py-2.5 text-left text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Tier</th>
                  </tr>
                </thead>
                <tbody>
                  {data.reps.map((rep) => (
                    <tr key={rep.id} className="border-b border-border/30 hover:bg-muted/20 transition-colors cursor-pointer">
                      <td className="px-4 py-3">
                        <Link to="/reps/$repId" params={{ repId: rep.id }} className="flex items-center gap-2.5">
                          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-secondary text-[10px] font-medium text-secondary-foreground">
                            {rep.name.split(" ").map((n: string) => n[0]).join("")}
                          </div>
                          <span className="font-medium text-foreground">{rep.name}</span>
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{rep.team}</td>
                      <td className="px-4 py-3 text-foreground">{rep.dealCount}</td>
                      <td className="px-4 py-3 font-semibold text-foreground">{formatCurrency(rep.totalRevenue)}</td>
                      <td className="px-4 py-3 font-semibold text-success">{formatCurrency(rep.totalCommission)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 min-w-[120px]">
                          <Progress
                            value={Math.min(rep.attainment, 100)}
                            className={cn("h-1.5 flex-1 bg-secondary", progressColorMap[rep.quotaTier?.color ?? "primary"])}
                          />
                          <span className="text-xs font-medium text-foreground w-10 text-right">{Math.round(rep.attainment)}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className={cn("text-[10px] font-medium border", tierColorMap[rep.quotaTier?.color ?? "primary"])}>
                          {rep.quotaTier?.tier_name ?? "Unknown"}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
