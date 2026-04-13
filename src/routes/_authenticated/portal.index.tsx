import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Mail, Building2, Loader2, CheckCircle, Upload, Camera,
  ChevronLeft, ChevronRight, FileText, AlertCircle, Check,
} from "lucide-react";
import { useState, useRef, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getPortalStats, getPortalDocumentsByMonth, createDocumentRecord } from "@/lib/server-functions";
import { getNylasConnectUrl } from "@/lib/server-functions/nylas";
import { initBankConnection } from "@/lib/server-functions/bank";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { PortalLayout } from "@/components/layout/PortalLayout";

export const Route = createFileRoute("/_authenticated/portal/")({
  component: PortalDashboard,
});

const MONTH_NAMES = [
  "Január", "Február", "Marec", "Apríl", "Máj", "Jún",
  "Júl", "August", "September", "Október", "November", "December",
];

const statusConfig: Record<string, { label: string; class: string }> = {
  processing: { label: "Spracováva sa", class: "bg-primary/15 text-primary" },
  pending_approval: { label: "Na schválenie", class: "bg-warning/15 text-warning-foreground" },
  approved: { label: "Schválené", class: "bg-success/15 text-success" },
  rejected: { label: "Zamietnuté", class: "bg-destructive/15 text-destructive" },
  duplicate: { label: "Duplikát", class: "bg-muted text-muted-foreground" },
  error: { label: "Chyba", class: "bg-destructive/15 text-destructive" },
};

const sourceIcons: Record<string, typeof Mail> = { email: Mail, upload: Upload, bank: Building2 };

interface FileItem {
  file: File;
  status: "pending" | "uploading" | "done" | "error";
  error?: string;
}

function PortalDashboard() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [connectingEmail, setConnectingEmail] = useState(false);
  const [connectingBank, setConnectingBank] = useState(false);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const { data: stats } = useQuery({
    queryKey: ["portal-stats"],
    queryFn: () => getPortalStats(),
  });

  const { data: documents = [], isLoading: docsLoading } = useQuery({
    queryKey: ["portal-docs-month", year, month],
    queryFn: () => getPortalDocumentsByMonth({ data: { year, month } }),
  });

  const clientId = stats?.clientId;

  function prevMonth() {
    if (month === 1) { setMonth(12); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  }
  function nextMonth() {
    if (month === 12) { setMonth(1); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  }

  const handleConnectEmail = async () => {
    if (!clientId) { toast.error("Najskôr musíte byť priradený ku klientovi"); return; }
    setConnectingEmail(true);
    try {
      const result = await getNylasConnectUrl({ data: { clientId } });
      if (result?.url) window.open(result.url, "_blank", "noopener");
      else toast.error("Nepodarilo sa získať odkaz na pripojenie emailu");
    } catch (e: any) {
      toast.error(e?.message || "Chyba pri pripájaní emailu");
    } finally { setConnectingEmail(false); }
  };

  const handleConnectBank = async () => {
    if (!clientId) { toast.error("Najskôr musíte byť priradený ku klientovi"); return; }
    setConnectingBank(true);
    try {
      const result = await initBankConnection({ data: { clientId } });
      if (result?.connectUrl) window.open(result.connectUrl, "_blank", "noopener");
      else toast.error("Nepodarilo sa získať odkaz na pripojenie banky");
    } catch (e: any) {
      toast.error(e?.message || "Chyba pri pripájaní banky");
    } finally { setConnectingBank(false); }
  };

  // Upload logic
  function handleFiles(newFiles: FileList | null) {
    if (!newFiles) return;
    setFiles(prev => [...prev, ...Array.from(newFiles).map(f => ({ file: f, status: "pending" as const }))]);
  }

  async function uploadAll() {
    if (!stats?.clientId || !stats?.officeId) return;
    setUploading(true);
    for (let i = 0; i < files.length; i++) {
      if (files[i].status === "done") continue;
      setFiles(prev => prev.map((f, idx) => idx === i ? { ...f, status: "uploading" } : f));
      try {
        const ext = files[i].file.name.split(".").pop() || "pdf";
        const path = `${stats.clientId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
        const { error: uploadError } = await supabase.storage.from("documents").upload(path, files[i].file, { contentType: files[i].file.type });
        if (uploadError) throw uploadError;
        const { data: urlData } = supabase.storage.from("documents").getPublicUrl(path);
        await createDocumentRecord({
          data: { clientId: stats.clientId, officeId: stats.officeId, fileName: files[i].file.name, fileSize: files[i].file.size, fileType: files[i].file.type, fileUrl: urlData.publicUrl, source: "upload" },
        });
        setFiles(prev => prev.map((f, idx) => idx === i ? { ...f, status: "done" } : f));
      } catch (err: any) {
        setFiles(prev => prev.map((f, idx) => idx === i ? { ...f, status: "error", error: err.message } : f));
      }
    }
    await queryClient.invalidateQueries({ queryKey: ["portal-docs-month"] });
    await queryClient.invalidateQueries({ queryKey: ["portal-stats"] });
    setUploading(false);
  }

  const pendingCount = files.filter(f => f.status !== "done").length;
  const allDone = files.length > 0 && files.every(f => f.status === "done");

  return (
    <PortalLayout>
      <div className="space-y-6">
        {/* Connections */}
        <section>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Prepojenia</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <Card>
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Mail className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">E-mail</p>
                    <p className="text-xs text-muted-foreground">Automatický zber faktúr</p>
                  </div>
                </div>
                {stats?.emailConnected ? (
                  <span className="flex items-center gap-1 text-xs text-success"><CheckCircle className="h-3.5 w-3.5" /> Pripojené</span>
                ) : (
                  <Button size="sm" variant="outline" onClick={handleConnectEmail} disabled={connectingEmail || !clientId}>
                    {connectingEmail && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
                    Pripojiť
                  </Button>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Building2 className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Banka</p>
                    <p className="text-xs text-muted-foreground">SK/CZ banky cez Salt Edge</p>
                  </div>
                </div>
                {stats?.bankConnected ? (
                  <span className="flex items-center gap-1 text-xs text-success"><CheckCircle className="h-3.5 w-3.5" /> Pripojené</span>
                ) : (
                  <Button size="sm" variant="outline" onClick={handleConnectBank} disabled={connectingBank || !clientId}>
                    {connectingBank && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
                    Pripojiť
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Upload */}
        <section>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Nahrať doklady</h2>
          <div
            className="border-2 border-dashed border-border p-6 text-center hover:border-primary/50 transition-colors"
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); handleFiles(e.dataTransfer.files); }}
          >
            <div className="flex items-center justify-center gap-3">
              <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()}>
                <Upload className="h-3.5 w-3.5 mr-1" /> Vybrať súbor
              </Button>
              <Button size="sm" variant="outline" onClick={() => {
                const input = fileInputRef.current;
                if (input) { input.setAttribute("capture", "environment"); input.click(); input.removeAttribute("capture"); }
              }}>
                <Camera className="h-3.5 w-3.5 mr-1" /> Odfotiť
              </Button>
            </div>
            <input ref={fileInputRef} type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.heic" className="hidden" onChange={e => { handleFiles(e.target.files); if (e.target) e.target.value = ""; }} />
            <p className="text-[10px] text-muted-foreground mt-2">PDF, JPG, PNG, HEIC · Max 50 MB</p>
          </div>

          {files.length > 0 && (
            <div className="mt-3 space-y-2">
              {files.map((item, i) => (
                <div key={i} className="flex items-center justify-between border border-border p-2 text-sm">
                  <div className="flex items-center gap-2 min-w-0">
                    {item.status === "uploading" && <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />}
                    {item.status === "done" && <Check className="h-3.5 w-3.5 text-success" />}
                    {item.status === "error" && <AlertCircle className="h-3.5 w-3.5 text-destructive" />}
                    <span className="truncate">{item.file.name}</span>
                  </div>
                  {item.status !== "uploading" && (
                    <button onClick={() => setFiles(prev => prev.filter((_, idx) => idx !== i))} className="text-xs text-muted-foreground hover:text-foreground p-1 min-h-[44px] min-w-[44px] flex items-center justify-center">✕</button>
                  )}
                </div>
              ))}
              {!allDone && (
                <Button className="w-full" onClick={uploadAll} disabled={uploading || pendingCount === 0 || !clientId}>
                  {uploading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Nahrávam...</> : `Nahrať (${pendingCount})`}
                </Button>
              )}
              {allDone && <p className="text-sm text-success text-center py-1">✓ Všetky doklady nahrané</p>}
            </div>
          )}
        </section>

        {/* Documents by month */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Doklady</h2>
            <div className="flex items-center gap-2">
              <button onClick={prevMonth} className="p-1 min-h-[44px] min-w-[44px] flex items-center justify-center hover:bg-muted transition-colors">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-sm font-medium min-w-[120px] text-center">{MONTH_NAMES[month - 1]} {year}</span>
              <button onClick={nextMonth} className="p-1 min-h-[44px] min-w-[44px] flex items-center justify-center hover:bg-muted transition-colors">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          {docsLoading ? (
            <div className="text-center py-8"><Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" /></div>
          ) : documents.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <FileText className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Žiadne doklady za {MONTH_NAMES[month - 1].toLowerCase()} {year}</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {documents.map((doc: any) => {
                const SourceIcon = sourceIcons[doc.source] || FileText;
                const status = statusConfig[doc.status] || { label: doc.status, class: "bg-muted text-muted-foreground" };
                return (
                  <Card key={doc.id}>
                    <CardContent className="p-3 flex items-center justify-between">
                      <div className="flex items-center gap-3 min-w-0">
                        <SourceIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{doc.supplier_name || doc.file_name || "Neznámy"}</p>
                          <p className="text-xs text-muted-foreground">
                            {doc.total_amount ? `${Number(doc.total_amount).toLocaleString("sk-SK")} €` : "–"}
                            {doc.issue_date && ` · ${new Date(doc.issue_date).toLocaleDateString("sk-SK")}`}
                          </p>
                        </div>
                      </div>
                      <span className={`inline-flex items-center px-2 py-0.5 text-[10px] font-medium ${status.class}`}>
                        {status.label}
                      </span>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </PortalLayout>
  );
}
