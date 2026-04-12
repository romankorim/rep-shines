import { createFileRoute } from "@tanstack/react-router";
import { PortalLayout } from "@/components/layout/PortalLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Mail, Building2, Loader2, RefreshCw } from "lucide-react";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getPortalStats, triggerEmailScan } from "@/lib/server-functions";

export const Route = createFileRoute("/_authenticated/portal/connections")({ component: ConnectionsPage });

function ConnectionsPage() {
  const [scanning, setScanning] = useState(false);
  const queryClient = useQueryClient();
  const { data: stats } = useQuery({
    queryKey: ["portal-stats"],
    queryFn: () => getPortalStats(),
  });

  return (
    <PortalLayout>
      <div className="space-y-6">
        <h1 className="text-lg sm:text-xl font-semibold tracking-tight">Pripojenia</h1>
        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><Mail className="h-4 w-4" /> E-mail</CardTitle></CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground mb-3">Pripojte email pre automatický zber faktúr</p>
              <Button size="sm">Pripojiť e-mail</Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><Building2 className="h-4 w-4" /> Banka</CardTitle></CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground mb-3">Tatra banka, SLSP, VÚB, ČSOB, mBank a ďalšie SK/CZ banky cez Salt Edge</p>
              <Button size="sm">Pripojiť banku</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </PortalLayout>
  );
}
