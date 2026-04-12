import { createFileRoute } from "@tanstack/react-router";
import { PortalLayout } from "@/components/layout/PortalLayout";
import { Card, CardContent } from "@/components/ui/card";
import { FileText } from "lucide-react";

export const Route = createFileRoute("/_authenticated/portal/documents")({ component: PortalDocuments });

function PortalDocuments() {
  return (
    <PortalLayout>
      <div className="space-y-6">
        <h1 className="text-lg sm:text-xl font-semibold tracking-tight">Moje doklady</h1>
        <Card><CardContent className="p-8 text-center">
          <FileText className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Zatiaľ žiadne doklady</p>
        </CardContent></Card>
      </div>
    </PortalLayout>
  );
}
