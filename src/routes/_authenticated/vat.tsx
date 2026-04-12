import { createFileRoute } from "@tanstack/react-router";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/vat")({
  component: VatPage,
});

function VatPage() {
  const now = new Date();
  const currentMonth = now.getMonth(); // 0-indexed
  const currentYear = now.getFullYear();
  const deadline = new Date(currentYear, currentMonth, 25);
  const daysLeft = Math.max(0, Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));

  const deadlineColor = daysLeft <= 5 ? "bg-destructive/15 text-destructive" : daysLeft <= 10 ? "bg-warning/15 text-warning-foreground" : "bg-success/15 text-success";

  const monthNames = ["Január", "Február", "Marec", "Apríl", "Máj", "Jún", "Júl", "August", "September", "Október", "November", "December"];

  const { data: clients = [] } = useQuery({
    queryKey: ["clients"],
    queryFn: async () => {
      const { data } = await supabase.from("clients").select("*").order("name");
      return data ?? [];
    },
  });

  const { data: documents = [] } = useQuery({
    queryKey: ["vat-documents"],
    queryFn: async () => {
      const { data } = await supabase
        .from("documents")
        .select("client_id, status")
        .eq("tax_period_month", currentMonth + 1)
        .eq("tax_period_year", currentYear);
      return data ?? [];
    },
  });

  // Group docs by client
  const clientStats = clients.map((client) => {
    const clientDocs = documents.filter((d) => d.client_id === client.id);
    const total = clientDocs.length;
    const approved = clientDocs.filter((d) => d.status === "approved").length;
    const pending = clientDocs.filter((d) => d.status === "pending_approval").length;
    const completeness = total > 0 ? Math.round((approved / total) * 100) : 0;
    const status = total === 0 ? "none" : approved === total ? "complete" : "pending";
    return { ...client, total, approved, pending, completeness, vatStatus: status };
  });

  const complete = clientStats.filter((c) => c.vatStatus === "complete").length;
  const pendingCount = clientStats.filter((c) => c.vatStatus === "pending").length;
  const noneCount = clientStats.filter((c) => c.vatStatus === "none").length;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-lg sm:text-xl font-semibold tracking-tight">DPH priznania</h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
              {monthNames[currentMonth]} {currentYear}
            </p>
          </div>
          <span className={`inline-flex items-center px-3 py-1 text-xs font-medium rounded-none ${deadlineColor}`}>
            {daysLeft} dní do uzávierky (25. v mesiaci)
          </span>
        </div>

        {/* Summary */}
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

        {/* Client list */}
        <div className="space-y-2">
          {clientStats.map((client) => (
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
