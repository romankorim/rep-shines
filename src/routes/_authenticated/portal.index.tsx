import { createFileRoute } from "@tanstack/react-router";
import { PortalLayout } from "@/components/layout/PortalLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Camera, Upload, FileText, AlertTriangle } from "lucide-react";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/portal/")({
  component: PortalOverview,
});

function PortalOverview() {
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
          <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold">0</p><p className="text-xs text-muted-foreground">Doklady</p></CardContent></Card>
          <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold">0</p><p className="text-xs text-muted-foreground">Schválené</p></CardContent></Card>
          <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold">0</p><p className="text-xs text-muted-foreground">Chýbajúce</p></CardContent></Card>
        </div>
      </div>
    </PortalLayout>
  );
}
