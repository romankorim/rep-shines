import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Upload, Loader2, Check, AlertCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { createDocumentRecord } from "@/lib/server-functions";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { clientsQueryOptions } from "@/lib/query-options";

interface FileItem {
  file: File;
  status: "pending" | "uploading" | "done" | "error";
  error?: string;
}

export function AccountantUploadDialog() {
  const [open, setOpen] = useState(false);
  const [clientId, setClientId] = useState("");
  const [files, setFiles] = useState<FileItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const { data: rawClients = [] } = useQuery(clientsQueryOptions());
  const clients = Array.isArray(rawClients) ? rawClients : [];

  function handleFiles(newFiles: FileList | null) {
    if (!newFiles) return;
    setFiles((prev) => [...prev, ...Array.from(newFiles).map((f) => ({ file: f, status: "pending" as const }))]);
  }

  async function uploadAll() {
    const selectedClient = clients.find((c: any) => c.id === clientId);
    if (!selectedClient) return;
    setUploading(true);

    for (let i = 0; i < files.length; i++) {
      if (files[i].status === "done") continue;
      setFiles((prev) => prev.map((f, idx) => idx === i ? { ...f, status: "uploading" } : f));

      try {
        const ext = files[i].file.name.split(".").pop() || "pdf";
        const path = `${clientId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from("documents")
          .upload(path, files[i].file, { contentType: files[i].file.type });
        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage.from("documents").getPublicUrl(path);

        await createDocumentRecord({
          data: {
            clientId,
            officeId: selectedClient.office_id,
            fileName: files[i].file.name,
            fileSize: files[i].file.size,
            fileType: files[i].file.type,
            fileUrl: urlData.publicUrl,
            source: "upload",
          },
        });

        setFiles((prev) => prev.map((f, idx) => idx === i ? { ...f, status: "done" } : f));
      } catch (err: any) {
        setFiles((prev) => prev.map((f, idx) => idx === i ? { ...f, status: "error", error: err.message } : f));
      }
    }

    await queryClient.invalidateQueries({ queryKey: ["documents"] });
    await queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
    setUploading(false);
  }

  function handleClose(o: boolean) {
    if (!o) {
      setFiles([]);
      setClientId("");
    }
    setOpen(o);
  }

  const pendingCount = files.filter((f) => f.status !== "done").length;
  const allDone = files.length > 0 && files.every((f) => f.status === "done");

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Upload className="h-3.5 w-3.5 mr-1" /> Nahrať doklad
        </Button>
      </DialogTrigger>
      <DialogContent className="rounded-none max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold">Nahrať doklad pre klienta</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="text-xs">Klient</Label>
            <Select value={clientId} onValueChange={setClientId}>
              <SelectTrigger className="mt-1 h-8 text-xs">
                <SelectValue placeholder="Vyberte klienta" />
              </SelectTrigger>
              <SelectContent>
                {clients.map((c: any) => (
                  <SelectItem key={c.id} value={c.id} className="text-xs">
                    {c.name} {c.company_name ? `(${c.company_name})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div
            className="border-2 border-dashed border-border rounded-none p-6 text-center hover:border-primary/50 transition-colors"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); handleFiles(e.dataTransfer.files); }}
          >
            <Upload className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
            <p className="text-xs text-muted-foreground">Pretiahnite súbory sem</p>
            <Button size="sm" variant="outline" className="mt-2" onClick={() => fileInputRef.current?.click()}>
              Vybrať súbory
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.jpg,.jpeg,.png,.heic"
              className="hidden"
              onChange={(e) => { handleFiles(e.target.files); if (e.target) e.target.value = ""; }}
            />
          </div>

          {files.length > 0 && (
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {files.map((item, i) => (
                <Card key={i}>
                  <CardContent className="p-2 flex items-center gap-2">
                    {item.status === "uploading" && <Loader2 className="h-3.5 w-3.5 animate-spin text-primary shrink-0" />}
                    {item.status === "done" && <Check className="h-3.5 w-3.5 text-success shrink-0" />}
                    {item.status === "error" && <AlertCircle className="h-3.5 w-3.5 text-destructive shrink-0" />}
                    <span className="text-xs truncate flex-1">{item.file.name}</span>
                    <span className="text-[10px] text-muted-foreground">{(item.file.size / 1024 / 1024).toFixed(1)} MB</span>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {!allDone && (
            <Button
              className="w-full"
              size="sm"
              onClick={uploadAll}
              disabled={uploading || !clientId || pendingCount === 0}
            >
              {uploading ? <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> Nahrávam...</> : `Nahrať (${pendingCount})`}
            </Button>
          )}

          {allDone && (
            <p className="text-xs text-success text-center font-medium">✓ Všetky doklady nahrané a AI extrakcia spustená</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
