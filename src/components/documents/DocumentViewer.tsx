import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Download, X, Mail, Upload, Building2, FileText, CheckCircle, XCircle, RotateCcw } from "lucide-react";
import { updateDocumentStatus } from "@/lib/server-functions";
import { useQueryClient } from "@tanstack/react-query";

interface DocumentViewerProps {
  document: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const statusConfig: Record<string, { label: string; class: string }> = {
  processing: { label: "Spracováva sa", class: "bg-primary/15 text-primary" },
  pending_approval: { label: "Na schválenie", class: "bg-warning/15 text-warning-foreground" },
  approved: { label: "Schválené", class: "bg-success/15 text-success" },
  rejected: { label: "Zamietnuté", class: "bg-destructive/15 text-destructive" },
  duplicate: { label: "Duplikát", class: "bg-muted text-muted-foreground" },
  error: { label: "Chyba", class: "bg-destructive/15 text-destructive" },
};

const sourceLabels: Record<string, { label: string; icon: typeof Mail }> = {
  email: { label: "E-mail", icon: Mail },
  upload: { label: "Upload", icon: Upload },
  bank: { label: "Banka", icon: Building2 },
};

const expenseCategories = [
  "materiál", "služby", "cestovné", "telefón", "internet", "nájom", "poistenie", "ostatné",
];

export function DocumentViewer({ document: doc, open, onOpenChange }: DocumentViewerProps) {
  const queryClient = useQueryClient();
  const [accountantNotes, setAccountantNotes] = useState(doc?.accountant_notes || "");
  const [expenseCategory, setExpenseCategory] = useState(doc?.expense_category || "");
  const [accountingCode, setAccountingCode] = useState(doc?.accounting_code || "");
  const [loading, setLoading] = useState(false);

  if (!doc) return null;

  const status = statusConfig[doc.status] || { label: doc.status, class: "bg-muted text-muted-foreground" };
  const source = sourceLabels[doc.source] || { label: doc.source, icon: FileText };
  const SourceIcon = source.icon;

  const overduedays = doc.due_date && new Date(doc.due_date) < new Date() && doc.status !== "approved"
    ? Math.ceil((new Date().getTime() - new Date(doc.due_date).getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  async function handleStatusChange(newStatus: "approved" | "rejected" | "pending_approval") {
    setLoading(true);
    try {
      await updateDocumentStatus({
        data: {
          documentId: doc.id,
          status: newStatus,
          accountantNotes: accountantNotes || undefined,
          expenseCategory: expenseCategory || undefined,
          accountingCode: accountingCode || undefined,
        },
      });
      await queryClient.invalidateQueries({ queryKey: ["documents"] });
      await queryClient.invalidateQueries({ queryKey: ["client"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      onOpenChange(false);
    } catch {
    } finally {
      setLoading(false);
    }
  }

  const confidenceColor = doc.ai_confidence >= 90 ? "text-success" : doc.ai_confidence >= 70 ? "text-warning-foreground" : "text-destructive";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl w-[95vw] h-[90vh] p-0 gap-0 rounded-none">
        <div className="flex h-full">
          {/* Left panel - Preview */}
          <div className="flex-[3] bg-muted/20 flex flex-col border-r border-border">
            <div className="flex items-center justify-between p-3 border-b border-border">
              <span className={`inline-flex items-center px-2 py-0.5 text-[10px] font-medium rounded-none ${status.class}`}>
                {status.label}
              </span>
              <button onClick={() => onOpenChange(false)} className="p-1 hover:bg-muted rounded-none">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 flex items-center justify-center p-6">
              {doc.file_url ? (
                doc.file_type?.includes("pdf") ? (
                  <iframe src={doc.file_url} className="w-full h-full border-0" title="Document preview" />
                ) : doc.file_type?.startsWith("image/") ? (
                  <img src={doc.file_url} alt={doc.file_name || "Document"} className="max-w-full max-h-full object-contain" />
                ) : (
                  <div className="text-center">
                    <FileText className="h-16 w-16 text-muted-foreground mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">{doc.file_name}</p>
                  </div>
                )
              ) : (
                <div className="text-center">
                  <FileText className="h-16 w-16 text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">Náhľad nie je k dispozícii</p>
                </div>
              )}
            </div>
            {doc.file_url && (
              <div className="p-3 border-t border-border">
                <Button variant="outline" size="sm" asChild>
                  <a href={doc.file_url} download={doc.file_name}>
                    <Download className="h-3.5 w-3.5 mr-1" /> Stiahnuť
                  </a>
                </Button>
              </div>
            )}
          </div>

          {/* Right panel - Metadata */}
          <div className="flex-[2] flex flex-col min-w-0">
            <Tabs defaultValue="details" className="flex-1 flex flex-col">
              <TabsList className="w-full justify-start rounded-none border-b border-border bg-transparent px-2">
                <TabsTrigger value="details" className="text-xs">Detaily</TabsTrigger>
                <TabsTrigger value="vat" className="text-xs">DPH</TabsTrigger>
                <TabsTrigger value="accounting" className="text-xs">Účtovanie</TabsTrigger>
                <TabsTrigger value="source" className="text-xs">Zdroj</TabsTrigger>
              </TabsList>

              <div className="flex-1 overflow-y-auto">
                <TabsContent value="details" className="p-4 space-y-4 mt-0">
                  <div>
                    <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Dodávateľ</Label>
                    <p className="text-sm font-medium mt-0.5">{doc.supplier_name || "—"}</p>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">IČO</Label>
                      <p className="text-xs mt-0.5">{doc.supplier_ico || "—"}</p>
                    </div>
                    <div>
                      <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">DIČ</Label>
                      <p className="text-xs mt-0.5">{doc.supplier_dic || "—"}</p>
                    </div>
                    <div>
                      <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">IČ DPH</Label>
                      <p className="text-xs mt-0.5">{doc.supplier_ic_dph || "—"}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Číslo dokladu</Label>
                      <p className="text-xs mt-0.5">{doc.document_number || "—"}</p>
                    </div>
                    <div>
                      <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Variabilný symbol</Label>
                      <p className="text-xs mt-0.5">{doc.variable_symbol || "—"}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Vystavenie</Label>
                      <p className="text-xs mt-0.5">{doc.issue_date ? new Date(doc.issue_date).toLocaleDateString("sk-SK") : "—"}</p>
                    </div>
                    <div>
                      <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Splatnosť</Label>
                      <p className="text-xs mt-0.5">
                        {doc.due_date ? new Date(doc.due_date).toLocaleDateString("sk-SK") : "—"}
                        {overduedays > 0 && (
                          <span className="block text-[9px] text-destructive font-medium">{overduedays} dní po splatnosti</span>
                        )}
                      </p>
                    </div>
                    <div>
                      <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Dodanie</Label>
                      <p className="text-xs mt-0.5">{doc.delivery_date ? new Date(doc.delivery_date).toLocaleDateString("sk-SK") : "—"}</p>
                    </div>
                  </div>
                  <div>
                    <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Poznámka účtovníka</Label>
                    <textarea
                      value={accountantNotes}
                      onChange={(e) => setAccountantNotes(e.target.value)}
                      placeholder="Pridať poznámku..."
                      className="mt-1 w-full min-h-[60px] rounded-none border border-input bg-transparent px-3 py-2 text-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    />
                  </div>
                </TabsContent>

                <TabsContent value="vat" className="p-4 space-y-4 mt-0">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Celková suma</Label>
                      <p className="text-lg font-bold mt-0.5">
                        {doc.total_amount ? `${Number(doc.total_amount).toLocaleString("sk-SK")} ${doc.currency || "€"}` : "—"}
                      </p>
                    </div>
                    <div>
                      <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Sadzba DPH</Label>
                      <p className="text-sm mt-0.5">{doc.vat_rate != null ? `${doc.vat_rate} %` : "—"}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Základ dane</Label>
                      <p className="text-sm mt-0.5">{doc.tax_base ? `${Number(doc.tax_base).toLocaleString("sk-SK")} €` : "—"}</p>
                    </div>
                    <div>
                      <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Suma DPH</Label>
                      <p className="text-sm mt-0.5">{doc.vat_amount ? `${Number(doc.vat_amount).toLocaleString("sk-SK")} €` : "—"}</p>
                    </div>
                  </div>
                  {doc.vat_breakdown && Array.isArray(doc.vat_breakdown) && doc.vat_breakdown.length > 0 && (
                    <div>
                      <Label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2 block">Rozpis DPH</Label>
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-border">
                            <th className="text-left py-1">Sadzba</th>
                            <th className="text-right py-1">Základ</th>
                            <th className="text-right py-1">DPH</th>
                            <th className="text-right py-1">Spolu</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(doc.vat_breakdown as any[]).map((row: any, i: number) => (
                            <tr key={i} className="border-b border-border/50">
                              <td className="py-1">{row.rate}%</td>
                              <td className="text-right py-1">{Number(row.base).toLocaleString("sk-SK")} €</td>
                              <td className="text-right py-1">{Number(row.vat).toLocaleString("sk-SK")} €</td>
                              <td className="text-right py-1">{Number(row.total).toLocaleString("sk-SK")} €</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  <div>
                    <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Daňové obdobie</Label>
                    <p className="text-xs mt-0.5">
                      {doc.tax_period_month && doc.tax_period_year
                        ? `${doc.tax_period_month}/${doc.tax_period_year}`
                        : "—"}
                    </p>
                  </div>
                </TabsContent>

                <TabsContent value="accounting" className="p-4 space-y-4 mt-0">
                  <div>
                    <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Kategória výdavku</Label>
                    <Select value={expenseCategory} onValueChange={setExpenseCategory}>
                      <SelectTrigger className="mt-1 h-8 text-xs">
                        <SelectValue placeholder="Vyberte kategóriu" />
                      </SelectTrigger>
                      <SelectContent>
                        {expenseCategories.map((c) => (
                          <SelectItem key={c} value={c} className="text-xs">{c}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Účtovný kód</Label>
                    <Input
                      value={accountingCode}
                      onChange={(e) => setAccountingCode(e.target.value)}
                      placeholder="napr. 518"
                      className="mt-1 h-8 text-xs"
                    />
                  </div>
                  <div>
                    <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Párovanie s bankou</Label>
                    <div className="mt-1">
                      {doc.matched_transaction_id ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium bg-success/15 text-success rounded-none">
                          <CheckCircle className="h-3 w-3" /> Spárované
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium bg-warning/15 text-warning-foreground rounded-none">
                          Nespárované
                        </span>
                      )}
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="source" className="p-4 space-y-4 mt-0">
                  <div>
                    <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Zdroj</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <SourceIcon className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">{source.label}</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Súbor</Label>
                      <p className="text-xs mt-0.5 truncate">{doc.file_name || "—"}</p>
                    </div>
                    <div>
                      <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Typ</Label>
                      <p className="text-xs mt-0.5">{doc.file_type || "—"}</p>
                    </div>
                  </div>
                  <div>
                    <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Veľkosť</Label>
                    <p className="text-xs mt-0.5">
                      {doc.file_size ? `${(Number(doc.file_size) / 1024 / 1024).toFixed(2)} MB` : "—"}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Nahraté</Label>
                      <p className="text-xs mt-0.5">{new Date(doc.created_at).toLocaleString("sk-SK")}</p>
                    </div>
                    <div>
                      <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Upravené</Label>
                      <p className="text-xs mt-0.5">{new Date(doc.updated_at).toLocaleString("sk-SK")}</p>
                    </div>
                  </div>
                  {doc.ai_confidence != null && (
                    <div>
                      <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Dôveryhodnosť AI</Label>
                      <div className="mt-1 flex items-center gap-2">
                        <div className="flex-1 h-2 bg-muted rounded-none overflow-hidden">
                          <div
                            className={`h-full ${doc.ai_confidence >= 90 ? "bg-success" : doc.ai_confidence >= 70 ? "bg-warning" : "bg-destructive"}`}
                            style={{ width: `${doc.ai_confidence}%` }}
                          />
                        </div>
                        <span className={`text-xs font-medium ${confidenceColor}`}>{doc.ai_confidence}%</span>
                      </div>
                    </div>
                  )}
                </TabsContent>
              </div>
            </Tabs>

            {/* Action buttons */}
            <div className="border-t border-border p-3 flex items-center gap-2">
              {doc.status === "pending_approval" ? (
                <>
                  <Button
                    size="sm"
                    className="flex-1 bg-success text-success-foreground hover:bg-success/90"
                    disabled={loading}
                    onClick={() => handleStatusChange("approved")}
                  >
                    <CheckCircle className="h-3.5 w-3.5 mr-1" />
                    Schváliť
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    className="flex-1"
                    disabled={loading}
                    onClick={() => handleStatusChange("rejected")}
                  >
                    <XCircle className="h-3.5 w-3.5 mr-1" />
                    Zamietnuť
                  </Button>
                </>
              ) : (doc.status === "approved" || doc.status === "rejected") ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 border-warning text-warning-foreground"
                  disabled={loading}
                  onClick={() => handleStatusChange("pending_approval")}
                >
                  <RotateCcw className="h-3.5 w-3.5 mr-1" />
                  Vrátiť na schválenie
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
