import { createFileRoute } from "@tanstack/react-router";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, FileText, Clock, Link2, Plus } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { clientsQueryOptions, dashboardStatsQueryOptions } from "@/lib/query-options";
import { createOffice } from "@/lib/server-functions";
import { useAuth } from "@/hooks/use-auth";
import { useEffect, useRef } from "react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardPage,
});

function DashboardPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const officeCreated = useRef(false);

  // Auto-create office from pending registration data
  useEffect(() => {
    if (officeCreated.current || typeof window === "undefined") return;
    const pending = localStorage.getItem("fantozzi_pending_office");
    if (pending && user) {
      officeCreated.current = true;
      try {
        const officeData = JSON.parse(pending);
        createOffice({ data: { name: officeData.name || "Moja kancelária", ico: officeData.ico, dic: officeData.dic } })
          .then(() => {
            localStorage.removeItem("fantozzi_pending_office");
            queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
            queryClient.invalidateQueries({ queryKey: ["current-user"] });
          })
          .catch(() => {});
      } catch {}
    }
  }, [user]);

  const { data: stats } = useQuery(dashboardStatsQueryOptions());
  const { data: clients = [] } = useQuery(clientsQueryOptions());

  const statCards = [
    { label: "Celkový počet klientov", value: stats?.totalClients ?? 0, icon: Users },
    { label: "Doklady tento mesiac", value: stats?.docsThisMonth ?? 0, icon: FileText },
    { label: "Čakajúce na schválenie", value: stats?.pendingApproval ?? 0, icon: Clock },
    { label: "Čakajú na pripojenie", value: stats?.pendingConnection ?? 0, icon: Link2 },
  ];

  const statusColors: Record<string, string> = {
    invited: "bg-warning/15 text-warning-foreground border-warning/30",
    active: "bg-success/15 text-success border-success/30",
    paused: "bg-muted text-muted-foreground border-border",
    archived: "bg-muted text-muted-foreground border-border",
  };

  const statusLabels: Record<string, string> = {
    invited: "Pozvaný",
    active: "Aktívny",
    paused: "Pozastavený",
    archived: "Archivovaný",
  };

  const displayClients = clients.slice(0, 10);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-lg sm:text-xl font-semibold tracking-tight">Prehľad</h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">Váš dashboard účtovníka</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {statCards.map((s) => (
            <Card key={s.label}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <s.icon className="h-4 w-4 text-muted-foreground" />
                </div>
                <p className="mt-2 text-2xl font-bold">{s.value}</p>
                <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Client list */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold">Klienti</h2>
            <div className="flex items-center gap-2">
              {clients.length > 10 && (
                <Link to="/clients" className="text-xs text-primary hover:underline">
                  Zobraziť všetkých
                </Link>
              )}
              <Button asChild size="sm" variant="outline">
                <Link to="/clients/new">
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Pridať klienta
                </Link>
              </Button>
            </div>
          </div>

          {displayClients.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Users className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                <h3 className="text-sm font-semibold">Žiadni klienti</h3>
                <p className="text-xs text-muted-foreground mt-1">Pridajte prvého klienta a začnite zbierať doklady.</p>
                <Button asChild size="sm" className="mt-4">
                  <Link to="/clients/new">
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    Pridať prvého klienta
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {displayClients.map((client) => (
                <Link key={client.id} to="/clients/$clientId" params={{ clientId: client.id }}>
                  <Card className="hover:bg-muted/20 transition-colors cursor-pointer">
                    <CardContent className="p-3 flex items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-none bg-secondary text-xs font-medium text-secondary-foreground">
                        {client.name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{client.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{client.company_name || client.email}</p>
                      </div>
                      <span className={`inline-flex items-center px-2 py-0.5 text-[10px] font-medium border rounded-none ${statusColors[client.status] || ""}`}>
                        {statusLabels[client.status] || client.status}
                      </span>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
