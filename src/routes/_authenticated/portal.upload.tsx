import { createFileRoute } from "@tanstack/react-router";
import { PortalLayout } from "@/components/layout/PortalLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, Camera, Check, AlertCircle, Loader2 } from "lucide-react";
import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { createDocumentRecord } from "@/lib/server-functions";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { portalStatsQueryOptions } from "@/lib/query-options";

export const Route = createFileRoute("/_authenticated/portal/upload")({ component: UploadPage });

interface FileItem {
  file: File;
  status: "pending" | "uploading" | "done" | "error";
  error?: string;
}

function UploadPage() {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const { data: stats } = useQuery(portalStatsQueryOptions());

  function handleFiles(newFiles: FileList | null) {
    if (!newFiles) return;
    const items: FileItem[] = Array.from(newFiles).map((f) => ({ file: f, status: "pending" }));
    setFiles((prev) => [...prev, ...items]);
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  async function uploadAll() {
    if (!stats?.clientId || !stats?.officeId) return;
    setUploading(true);

    for (let i = 0; i < files.length; i++) {
      const item = files[i];
      if (item.status === "done") continue;

      setFiles((prev) => prev.map((f, idx) => idx === i ? { ...f, status: "uploading" } : f));

      try {
        const ext = item.file.name.split(".").pop() || "pdf";
        const path = `${stats.clientId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from("documents")
          .upload(path, item.file, { contentType: item.file.type });

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage.from("documents").getPublicUrl(path);

        await createDocumentRecord({
          data: {
            clientId: stats.clientId,
            officeId: stats.officeId,
            fileName: item.file.name,
            fileSize: item.file.size,
            fileType: item.file.type,
            fileUrl: urlData.publicUrl,
            source: "upload",
          },
        });

        setFiles((prev) => prev.map((f, idx) => idx === i ? { ...f, status: "done" } : f));
      } catch (err: any) {
        setFiles((prev) => prev.map((f, idx) => idx === i ? { ...f, status: "error", error: err.message || "Chyba" } : f));
      }
    }

    await queryClient.invalidateQueries({ queryKey: ["portal-documents"] });
    await queryClient.invalidateQueries({ queryKey: ["portal-stats"] });
    setUploading(false);
  }

  const pendingCount = files.filter((f) => f.status !== "done").length;
  const allDone = files.length > 0 && files.every((f) => f.status === "done");

  return (
    <PortalLayout>
      <div className="space-y-6 max-w-2xl">
        <h1 className="text-lg sm:text-xl font-semibold tracking-tight">Nahrať doklady</h1>

        <div
          className="border-2 border-dashed border-border rounded-none p-8 text-center hover:border-primary/50 transition-colors"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); handleFiles(e.dataTransfer.files); }}
        >
          <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Pretiahnite súbory sem alebo</p>
          <div className="flex items-center justify-center gap-3 mt-3">
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
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.jpg,.jpeg,.png,.heic"
            className="hidden"
            onChange={(e) => { handleFiles(e.target.files); if (e.target) e.target.value = ""; }}
          />
          <p className="text-[10px] text-muted-foreground mt-3">PDF, JPG, PNG, HEIC · Max 50 MB</p>
        </div>

        {files.length > 0 && (
          <div className="space-y-2">
            {files.map((item, i) => (
              <Card key={i}>
                <CardContent className="p-3 flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    {item.status === "uploading" && <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />}
                    {item.status === "done" && <Check className="h-4 w-4 text-success shrink-0" />}
                    {item.status === "error" && <AlertCircle className="h-4 w-4 text-destructive shrink-0" />}
                    <div className="min-w-0">
                      <p className="text-sm truncate">{item.file.name}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {(item.file.size / 1024 / 1024).toFixed(1)} MB
                        {item.error && <span className="text-destructive ml-2">{item.error}</span>}
                      </p>
                    </div>
                  </div>
                  {item.status !== "uploading" && (
                    <button onClick={() => removeFile(i)} className="text-xs text-muted-foreground hover:text-foreground p-1 min-h-[44px] min-w-[44px] flex items-center justify-center">✕</button>
                  )}
                </CardContent>
              </Card>
            ))}

            {!allDone && (
              <Button className="w-full" onClick={uploadAll} disabled={uploading || pendingCount === 0}>
                {uploading ? (
                  <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Nahrávam...</>
                ) : (
                  `Nahrať všetky (${pendingCount})`
                )}
              </Button>
            )}

            {allDone && (
              <div className="text-center py-2">
                <p className="text-sm text-success font-medium">✓ Všetky doklady nahrané</p>
              </div>
            )}
          </div>
        )}

        {!stats?.clientId && (
          <Card className="border-warning/30 bg-warning/5">
            <CardContent className="p-4 text-center">
              <p className="text-sm text-muted-foreground">Váš účet ešte nie je prepojený s účtovníkom. Kontaktujte svojho účtovníka.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </PortalLayout>
  );
}
