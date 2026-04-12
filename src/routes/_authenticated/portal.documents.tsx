import { createFileRoute } from "@tanstack/react-router";
import { PortalLayout } from "@/components/layout/PortalLayout";
import { Card, CardContent } from "@/components/ui/card";
import { FileText, Mail, Upload, Building2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { portalDocumentsQueryOptions } from "@/lib/query-options";

export const Route = createFileRoute("/_authenticated/portal/documents")({ component: PortalDocuments });

const statusConfig: Record<string, { label: string; class: string }> = {
  processing: { label: "Spracováva sa", class: "bg-primary/15 text-primary" },
  pending_approval: { label: "Na schválenie", class: "bg-warning/15 text-warning-foreground" },
  approved: { label: "Schválené", class: "bg-success/15 text-success" },
  rejected: { label: "Zamietnuté", class: "bg-destructive/15 text-destructive" },
  duplicate: { label: "Duplikát", class: "bg-muted text-muted-foreground" },
  error: { label: "Chyba", class: "bg-destructive/15 text-destructive" },
};

const sourceIcons: Record<string, typeof Mail> = {
  email: Mail,
  upload: Upload,
  bank: Building2,
};

function PortalDocuments() {
  const { data: documents = [] } = useQuery(portalDocumentsQueryOptions());

  return (
    <PortalLayout>
      <div className="space-y-6">
        <h1 className="text-lg sm:text-xl font-semibold tracking-tight">Moje doklady</h1>

        {documents.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <FileText className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">Zatiaľ žiadne doklady</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {documents.map((doc: any) => {
              const SourceIcon = sourceIcons[doc.source] || FileText;
              const status = statusConfig[doc.status] || { label: doc.status, class: "bg-muted text-muted-foreground" };

              return (
                <Card key={doc.id} className="hover:shadow-md transition-all">
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between mb-2">
                      <span className={`inline-flex items-center px-1.5 py-0.5 text-[9px] font-medium rounded-none ${status.class}`}>
                        {status.label}
                      </span>
                      <SourceIcon className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                    <p className="text-sm font-medium truncate">{doc.supplier_name || doc.file_name || "Neznámy"}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {doc.total_amount ? `${Number(doc.total_amount).toLocaleString("sk-SK")} €` : "Suma neextrahovaná"}
                    </p>
                    {doc.issue_date && (
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {new Date(doc.issue_date).toLocaleDateString("sk-SK")}
                      </p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </PortalLayout>
  );
}
