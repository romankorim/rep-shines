import { createFileRoute } from "@tanstack/react-router";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { vatQueryOptions } from "@/lib/query-options";

export const Route = createFileRoute("/_authenticated/vat")({
  component: VatPage,
});

function VatPage() {
  const now = new Date();
  const currentMonth = now.getMonth() + 1; // 1-indexed for DB
  const currentYear = now.getFullYear();
  const deadline = new Date(currentYear, now.getMonth(), 25);
  const daysLeft = Math.max(0, Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));

  const deadlineColor = daysLeft <= 5 ? "bg-destructive/15 text-destructive" : daysLeft <= 10 ? "bg-warning/15 text-warning-foreground" : "bg-success/15 text-success";

  const monthNames = ["Január", "Február", "Marec", "Apríl", "Máj", "Jún", "Júl", "August", "September", "Október", "November", "December"];

  const { data } = useQuery(vatQueryOptions(currentMonth, currentYear));

  const clientStats = data?.clients ?? [];
  const complete = data?.complete ?? 0;
  const pendingCount = data?.pending ?? 0;
  const noneCount = data?.none ?? 0;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-lg sm:text-xl font-semibold tracking-tight">DPH priznania</h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
              {monthNames[now.getMonth()]} {currentYear}
            </p>
          </div>
          <span className={`inline-flex items-center px-3 py-1 text-xs font-medium rounded-none ${deadlineColor}`}>
            {daysLeft} dní do uzávierky (25. v mesiaci)
          </span>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <Card><CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-success">{complete}</p>
            <p className="text-xs text-muted-foreground">Kompletné</p>
          </CardContent></Card>
          <Card><CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-warning-foreground">{pendingCount}</p>
            <p className="text-xs text-muted-foreground">Čakajúce</p>
          </CardContent></Card>
          <Card><CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-muted-foreground">{noneCount}</p>
            <p className="text-xs text-muted-foreground">Bez dokladov</p>
          </CardContent></Card>
        </div>

        <div className="space-y-2">
          {clientStats.map((client: any) => (
            <Card key={client.id} className={`transition-colors ${
              client.vatStatus === "complete" ? "border-success/30 bg-success/5" :
              client.vatStatus === "pending" ? "border-warning/30 bg-warning/5" :
              ""
            }`}>
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-none bg-secondary text-[10px] font-medium text-secondary-foreground">
                    {client.name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{client.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{client.company_name || ""} {client.ic_dph ? `· ${client.ic_dph}` : ""}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-xs">{client.approved}/{client.total} dokladov</p>
                    <p className="text-[10px] text-muted-foreground">{client.completeness}% kompletné</p>
                  </div>
                  {client.vatStatus === "complete" && (
                    <Button size="sm" variant="outline">Generovať DPH</Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}
