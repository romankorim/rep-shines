import { createFileRoute } from "@tanstack/react-router";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, Mail, Upload, Building2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { documentsQueryOptions } from "@/lib/query-options";
import { useState } from "react";
import { DocumentViewer } from "@/components/documents/DocumentViewer";
import { AccountantUploadDialog } from "@/components/documents/AccountantUploadDialog";

export const Route = createFileRoute("/_authenticated/documents")({
  component: DocumentsPage,
});

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

function DocumentsPage() {
  const [tab, setTab] = useState("pending");
  const { data: rawDocuments = [] } = useQuery(documentsQueryOptions());
  const documents = Array.isArray(rawDocuments) ? rawDocuments : [];
  const [selectedDoc, setSelectedDoc] = useState<any>(null);

  const pending = documents.filter((d: any) => d.status === "pending_approval");
  const approved = documents.filter((d: any) => d.status === "approved");
  const other = documents.filter((d: any) => !["pending_approval", "approved"].includes(d.status));

  const tabDocs = tab === "pending" ? pending : tab === "approved" ? approved : other;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg sm:text-xl font-semibold tracking-tight">Doklady</h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">Kontrola dokladov od všetkých klientov</p>
          </div>
          <AccountantUploadDialog />
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="pending">Na schválenie ({pending.length})</TabsTrigger>
            <TabsTrigger value="approved">Schválené ({approved.length})</TabsTrigger>
            <TabsTrigger value="other">Ostatné ({other.length})</TabsTrigger>
          </TabsList>

          <TabsContent value={tab} className="mt-4">
            {tabDocs.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <FileText className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">Žiadne doklady v tejto kategórii</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {tabDocs.map((doc: any) => {
                  const SourceIcon = sourceIcons[doc.source] || FileText;
                  const status = statusConfig[doc.status] || { label: doc.status, class: "bg-muted text-muted-foreground" };
                  const isOverdue = doc.due_date && new Date(doc.due_date) < new Date() && doc.status !== "approved";

                  return (
                    <Card
                      key={doc.id}
                      className="cursor-pointer hover:shadow-md transition-all relative"
                      onClick={() => setSelectedDoc(doc)}
                    >
                      <CardContent className="p-3">
                        <div className="relative bg-muted/30 rounded-none h-32 flex items-center justify-center mb-3">
                          {doc.thumbnail_url || (doc.file_type?.startsWith("image/") && doc.file_url) ? (
                            <img
                              src={doc.thumbnail_url || doc.file_url}
                              alt={doc.file_name || ""}
                              className="max-w-full max-h-full object-contain"
                            />
                          ) : (
                            <FileText className="h-8 w-8 text-muted-foreground/50" />
                          )}
                          <span className={`absolute top-2 left-2 inline-flex items-center px-1.5 py-0.5 text-[9px] font-medium rounded-none ${status.class}`}>
                            {status.label}
                          </span>
                          <SourceIcon className="absolute top-2 right-2 h-3.5 w-3.5 text-muted-foreground" />
                          {isOverdue && (
                            <span className="absolute bottom-2 left-2 inline-flex items-center px-1.5 py-0.5 text-[9px] font-medium bg-destructive/15 text-destructive rounded-none">
                              Po splatnosti
                            </span>
                          )}
                          {doc.ai_confidence != null && (
                            <div className="absolute bottom-0 left-0 right-0 h-1">
                              <div
                                className={`h-full ${Number(doc.ai_confidence) >= 90 ? "bg-success" : Number(doc.ai_confidence) >= 70 ? "bg-warning" : "bg-destructive"}`}
                                style={{ width: `${doc.ai_confidence}%` }}
                              />
                            </div>
                          )}
                        </div>

                        <p className="text-sm font-medium truncate">{doc.supplier_name || doc.file_name || "Neznámy dodávateľ"}</p>
                        <p className="text-xs font-semibold mt-1">
                          {doc.total_amount ? `${Number(doc.total_amount).toLocaleString("sk-SK")} €` : "Suma neextrahovaná"}
                        </p>
                        <div className="flex items-center justify-between mt-1">
                          <p className="text-[10px] text-muted-foreground">
                            {doc.issue_date ? new Date(doc.issue_date).toLocaleDateString("sk-SK") : ""}
                          </p>
                          {doc.document_number && (
                            <p className="text-[10px] text-muted-foreground">č. {doc.document_number}</p>
                          )}
                        </div>
                        <p className="text-[10px] text-primary mt-1 truncate">
                          {doc.clients?.name || ""}
                        </p>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      <DocumentViewer
        document={selectedDoc}
        open={!!selectedDoc}
        onOpenChange={(open) => { if (!open) setSelectedDoc(null); }}
      />
    </DashboardLayout>
  );
}
