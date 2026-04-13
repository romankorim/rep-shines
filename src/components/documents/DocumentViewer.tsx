import { useState, useEffect } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Download, ExternalLink, X, Mail, Upload, Building2, FileText, CheckCircle, XCircle, RotateCcw, Pencil, Save } from "lucide-react";
import { updateDocumentStatus, updateDocumentFields } from "@/lib/server-functions";
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

const docTypeOptions = [
  { value: "received_invoice", label: "Prijatá faktúra" },
  { value: "issued_invoice", label: "Vydaná faktúra" },
  { value: "receipt", label: "Účtenka" },
  { value: "credit_note", label: "Dobropis" },
  { value: "advance_invoice", label: "Zálohová faktúra" },
  { value: "bank_statement", label: "Bankový výpis" },
  { value: "other", label: "Iné" },
];

function EditableField({ label, value, editing, onChange, type = "text" }: {
  label: string; value: string; editing: boolean; onChange: (v: string) => void; type?: string;
}) {
  return (
    <div>
      <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</Label>
      {editing ? (
        <Input value={value} onChange={(e) => onChange(e.target.value)} className="mt-0.5 h-7 text-xs" type={type} />
      ) : (
        <p className="text-xs mt-0.5">{value || "—"}</p>
      )}
    </div>
  );
}

export function DocumentViewer({ document: doc, open, onOpenChange }: DocumentViewerProps) {
  const queryClient = useQueryClient();
  const [accountantNotes, setAccountantNotes] = useState("");
  const [expenseCategory, setExpenseCategory] = useState("");
  const [accountingCode, setAccountingCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(false);

  const [documentType, setDocumentType] = useState("");
  const [supplierName, setSupplierName] = useState("");
  const [supplierIco, setSupplierIco] = useState("");
  const [supplierDic, setSupplierDic] = useState("");
  const [supplierIcDph, setSupplierIcDph] = useState("");
  const [documentNumber, setDocumentNumber] = useState("");
  const [variableSymbol, setVariableSymbol] = useState("");
  const [issueDate, setIssueDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [totalAmount, setTotalAmount] = useState("");
  const [taxBase, setTaxBase] = useState("");
  const [vatAmount, setVatAmount] = useState("");
  const [vatRate, setVatRate] = useState("");

  useEffect(() => {
    if (doc) {
      setDocumentType(doc.document_type || "");
      setAccountantNotes(doc.accountant_notes || "");
      setExpenseCategory(doc.expense_category || "");
      setAccountingCode(doc.accounting_code || "");
      setSupplierName(doc.supplier_name || "");
      setSupplierIco(doc.supplier_ico || "");
      setSupplierDic(doc.supplier_dic || "");
      setSupplierIcDph(doc.supplier_ic_dph || "");
      setDocumentNumber(doc.document_number || "");
      setVariableSymbol(doc.variable_symbol || "");
      setIssueDate(doc.issue_date || "");
      setDueDate(doc.due_date || "");
      setDeliveryDate(doc.delivery_date || "");
      setTotalAmount(doc.total_amount?.toString() || "");
      setTaxBase(doc.tax_base?.toString() || "");
      setVatAmount(doc.vat_amount?.toString() || "");
      setVatRate(doc.vat_rate?.toString() || "");
      setEditing(false);
    }
  }, [doc]);

  if (!doc) return null;

  const status = statusConfig[doc.status] || { label: doc.status, class: "bg-muted text-muted-foreground" };
  const source = sourceLabels[doc.source] || { label: doc.source, icon: FileText };
  const SourceIcon = source.icon;
  const previewUrl = doc.file_url || doc.thumbnail_url;
  const isPdf = doc.file_type?.includes("pdf");
  const isImage = doc.file_type?.startsWith("image/");
  const hasExtractedData = Boolean(
    doc.document_type || doc.supplier_name || doc.document_number || doc.issue_date || doc.total_amount || doc.ai_raw_data
  );

  const overduedays = doc.due_date && new Date(doc.due_date) < new Date() && doc.status !== "approved"
    ? Math.ceil((new Date().getTime() - new Date(doc.due_date).getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  const confidenceColor = doc.ai_confidence >= 90 ? "text-success" : doc.ai_confidence >= 70 ? "text-warning-foreground" : "text-destructive";

  async function handleSaveFields() {
    setLoading(true);
    try {
      await updateDocumentFields({
        data: {
          documentId: doc.id,
          documentType: documentType as any || undefined,
          supplierName: supplierName || undefined,
          supplierIco: supplierIco || undefined,
          supplierDic: supplierDic || undefined,
          supplierIcDph: supplierIcDph || undefined,
          documentNumber: documentNumber || undefined,
          variableSymbol: variableSymbol || undefined,
          issueDate: issueDate || undefined,
          dueDate: dueDate || undefined,
          deliveryDate: deliveryDate || undefined,
          totalAmount: totalAmount ? parseFloat(totalAmount) : undefined,
          taxBase: taxBase ? parseFloat(taxBase) : undefined,
          vatAmount: vatAmount ? parseFloat(vatAmount) : undefined,
          vatRate: vatRate ? parseFloat(vatRate) : undefined,
        },
      });
      await queryClient.invalidateQueries({ queryKey: ["documents"] });
      await queryClient.invalidateQueries({ queryKey: ["client"] });
      setEditing(false);
    } catch {} finally {
      setLoading(false);
    }
  }

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
    } catch {} finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl w-[95vw] h-[90vh] p-0 gap-0 rounded-none">
        <div className="flex h-full">
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
              {previewUrl ? (
                isPdf ? (
                  <iframe src={previewUrl} className="h-full w-full border-0 bg-background" title="Document preview" />
                ) : isImage ? (
                  <img src={previewUrl} alt={doc.file_name || "Document"} className="max-w-full max-h-full object-contain" />
                ) : (
                  <div className="text-center">
                    <FileText className="mx-auto mb-3 h-16 w-16 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">{doc.file_name}</p>
                  </div>
                )
              ) : (
                <div className="space-y-3 text-center">
                  <FileText className="mx-auto h-16 w-16 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Náhľad nie je k dispozícii</p>
                </div>
              )}
            </div>
            {previewUrl && (
              <div className="flex items-center gap-2 border-t border-border p-3">
                <Button variant="outline" size="sm" asChild>
                  <a href={previewUrl} target="_blank" rel="noreferrer">
                    <ExternalLink className="mr-1 h-3.5 w-3.5" /> Otvoriť
                  </a>
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <a href={previewUrl} download={doc.file_name}>
                    <Download className="mr-1 h-3.5 w-3.5" /> Stiahnuť
                  </a>
                </Button>
              </div>
            )}
          </div>

          {/* Right panel - Metadata */}
          <div className="flex-[2] flex flex-col min-w-0">
            <Tabs defaultValue="details" className="flex-1 flex flex-col">
              <div className="flex items-center justify-between border-b border-border px-2">
                <TabsList className="justify-start rounded-none bg-transparent">
                  <TabsTrigger value="details" className="text-xs">Detaily</TabsTrigger>
                  <TabsTrigger value="vat" className="text-xs">DPH</TabsTrigger>
                  <TabsTrigger value="accounting" className="text-xs">Účtovanie</TabsTrigger>
                  <TabsTrigger value="source" className="text-xs">Zdroj</TabsTrigger>
                </TabsList>
                {!editing ? (
                  <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => setEditing(true)}>
                    <Pencil className="h-3 w-3" /> Upraviť
                  </Button>
                ) : (
                  <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 text-primary" onClick={handleSaveFields} disabled={loading}>
                    <Save className="h-3 w-3" /> Uložiť
                  </Button>
                )}
              </div>

              <div className="flex-1 overflow-y-auto">
                <TabsContent value="details" className="p-4 space-y-4 mt-0">
                  {!hasExtractedData && doc.status === "error" && (
                    <div className="border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
                      AI extrakcia tohto PDF zlyhala, ale doklad už sa dá otvoriť a polia môžete upraviť ručne.
                    </div>
                  )}
                  <div>
                    <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Druh dokladu</Label>
                    {editing ? (
                      <Select value={documentType} onValueChange={setDocumentType}>
                        <SelectTrigger className="mt-0.5 h-7 text-xs">
                          <SelectValue placeholder="Vyberte druh dokladu" />
                        </SelectTrigger>
                        <SelectContent>
                          {docTypeOptions.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value} className="text-xs">{opt.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <p className="text-xs mt-0.5 font-medium text-primary">
                        {docTypeOptions.find((o) => o.value === documentType)?.label || "—"}
                      </p>
                    )}
                  </div>
                  <EditableField label="Dodávateľ" value={supplierName} editing={editing} onChange={setSupplierName} />
                  <div className="grid grid-cols-3 gap-3">
                    <EditableField label="IČO" value={supplierIco} editing={editing} onChange={setSupplierIco} />
                    <EditableField label="DIČ" value={supplierDic} editing={editing} onChange={setSupplierDic} />
                    <EditableField label="IČ DPH" value={supplierIcDph} editing={editing} onChange={setSupplierIcDph} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <EditableField label="Číslo dokladu" value={documentNumber} editing={editing} onChange={setDocumentNumber} />
                    <EditableField label="Variabilný symbol" value={variableSymbol} editing={editing} onChange={setVariableSymbol} />
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <EditableField label="Vystavenie" value={issueDate} editing={editing} onChange={setIssueDate} type="date" />
                    <div>
                      {editing ? (
                        <EditableField label="Splatnosť" value={dueDate} editing onChange={setDueDate} type="date" />
                      ) : (
                        <div>
                          <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Splatnosť</Label>
                          <p className="text-xs mt-0.5">
                            {dueDate ? new Date(dueDate).toLocaleDateString("sk-SK") : "—"}
                            {overduedays > 0 && (
                              <span className="block text-[9px] text-destructive font-medium">{overduedays} dní po splatnosti</span>
                            )}
                          </p>
                        </div>
                      )}
                    </div>
                    <EditableField label="Dodanie" value={deliveryDate} editing={editing} onChange={setDeliveryDate} type="date" />
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
                      {editing ? (
                        <Input value={totalAmount} onChange={(e) => setTotalAmount(e.target.value)} className="mt-0.5 h-7 text-xs" type="number" step="0.01" />
                      ) : (
                        <p className="text-lg font-bold mt-0.5">
                          {totalAmount ? `${Number(totalAmount).toLocaleString("sk-SK")} ${doc.currency || "€"}` : "—"}
                        </p>
                      )}
                    </div>
                    <EditableField label="Sadzba DPH (%)" value={vatRate} editing={editing} onChange={setVatRate} type="number" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <EditableField label="Základ dane" value={taxBase} editing={editing} onChange={setTaxBase} type="number" />
                    <EditableField label="Suma DPH" value={vatAmount} editing={editing} onChange={setVatAmount} type="number" />
                  </div>
                  {!editing && doc.vat_breakdown && Array.isArray(doc.vat_breakdown) && doc.vat_breakdown.length > 0 && (
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
                  {doc.clients && (
                    <div>
                      <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Klient</Label>
                      <p className="text-xs mt-0.5">{doc.clients.name} {doc.clients.company_name ? `(${doc.clients.company_name})` : ""}</p>
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
