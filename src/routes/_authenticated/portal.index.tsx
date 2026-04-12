import { createFileRoute } from "@tanstack/react-router";
import { PortalLayout } from "@/components/layout/PortalLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Camera, Upload, AlertTriangle } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { portalStatsQueryOptions } from "@/lib/query-options";

export const Route = createFileRoute("/_authenticated/portal/")({
  component: PortalOverview,
});

function PortalOverview() {
  const { data: stats } = useQuery(portalStatsQueryOptions());

  return (
    <PortalLayout>
      <div className="space-y-6">
        <h1 className="text-lg sm:text-xl font-semibold tracking-tight">Prehľad</h1>

        <div className="grid grid-cols-2 gap-3">
          <Button asChild size="lg" className="h-20 flex-col gap-2">
            <Link to="/portal/upload"><Camera className="h-5 w-5" />Odfotiť doklad</Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="h-20 flex-col gap-2">
            <Link to="/portal/upload"><Upload className="h-5 w-5" />Nahrať súbor</Link>
          </Button>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <Card><CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{stats?.totalDocs ?? 0}</p>
            <p className="text-xs text-muted-foreground">Doklady</p>
          </CardContent></Card>
          <Card><CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{stats?.approvedDocs ?? 0}</p>
            <p className="text-xs text-muted-foreground">Schválené</p>
          </CardContent></Card>
          <Card><CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{stats?.unmatchedTx ?? 0}</p>
            <p className="text-xs text-muted-foreground">Chýbajúce</p>
          </CardContent></Card>
        </div>

        {(stats?.unmatchedTx ?? 0) > 0 && (
          <Card className="border-warning/30 bg-warning/5">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-warning-foreground shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium">{stats!.unmatchedTx} transakcií bez dokladu</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Vaša banka zaznamenala platby, ku ktorým nemáme faktúru. Odfotťe alebo nahrajte chýbajúce doklady.
                  </p>
                  <Button asChild size="sm" className="mt-3">
                    <Link to="/portal/upload">Nahrať chýbajúce doklady</Link>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </PortalLayout>
  );
}
