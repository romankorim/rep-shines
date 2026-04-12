import { createFileRoute } from "@tanstack/react-router";
import { PortalLayout } from "@/components/layout/PortalLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, Camera } from "lucide-react";
import { useState, useRef } from "react";

export const Route = createFileRoute("/_authenticated/portal/upload")({ component: UploadPage });

function UploadPage() {
  const [files, setFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFiles(newFiles: FileList | null) {
    if (newFiles) setFiles((prev) => [...prev, ...Array.from(newFiles)]);
  }

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
              <Upload className="h-3.5 w-3.5 mr-1" />Vybrať súbor
            </Button>
            <Button size="sm" variant="outline" onClick={() => { const input = fileInputRef.current; if (input) { input.setAttribute("capture", "environment"); input.click(); input.removeAttribute("capture"); } }}>
              <Camera className="h-3.5 w-3.5 mr-1" />Odfotiť
            </Button>
          </div>
          <input ref={fileInputRef} type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.heic" className="hidden" onChange={(e) => handleFiles(e.target.files)} />
          <p className="text-[10px] text-muted-foreground mt-3">PDF, JPG, PNG, HEIC · Max 50 MB</p>
        </div>
        {files.length > 0 && (
          <div className="space-y-2">
            {files.map((f, i) => (
              <Card key={i}><CardContent className="p-3 flex items-center justify-between">
                <div><p className="text-sm truncate">{f.name}</p><p className="text-[10px] text-muted-foreground">{(f.size / 1024 / 1024).toFixed(1)} MB</p></div>
              </CardContent></Card>
            ))}
            <Button className="w-full">Nahrať všetky ({files.length})</Button>
          </div>
        )}
      </div>
    </PortalLayout>
  );
}
