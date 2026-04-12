import { createFileRoute, Link } from "@tanstack/react-router";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Users } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/clients/")({
  component: ClientsPage,
});

function ClientsPage() {
  const { data: clients = [], isLoading } = useQuery({
    queryKey: ["clients"],
    queryFn: async () => {
      const { data } = await supabase.from("clients").select("*").order("created_at", { ascending: false });
      return data ?? [];
    },
  });

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

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg sm:text-xl font-semibold tracking-tight">Klienti</h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">{clients.length} klientov</p>
          </div>
          <Button asChild size="sm">
            <Link to="/clients/new">
              <Plus className="h-3.5 w-3.5 mr-1" />
              Pridať klienta
            </Link>
          </Button>
        </div>

        {clients.length === 0 && !isLoading ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Users className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <h3 className="text-sm font-semibold">Žiadni klienti</h3>
              <p className="text-xs text-muted-foreground mt-1">Pridajte prvého klienta.</p>
              <Button asChild size="sm" className="mt-4">
                <Link to="/clients/new">
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Pridať prvého klienta
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {clients.map((client) => (
              <Link key={client.id} to="/clients/$clientId" params={{ clientId: client.id }}>
                <Card className="h-full hover:shadow-lg hover:-translate-y-0.5 transition-all cursor-pointer relative">
                  <div className={`absolute top-3 right-3 inline-flex items-center px-2 py-0.5 text-[10px] font-medium border rounded-none ${statusColors[client.status] || ""}`}>
                    {statusLabels[client.status] || client.status}
                  </div>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-none bg-secondary text-xs font-medium text-secondary-foreground">
                        {client.name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)}
                      </div>
                      <div className="min-w-0 pr-16">
                        <p className="text-sm font-semibold truncate">{client.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{client.company_name || ""}</p>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{client.email}</p>
                    {client.ic_dph && (
                      <p className="text-xs text-muted-foreground mt-1">IČ DPH: {client.ic_dph}</p>
                    )}
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
