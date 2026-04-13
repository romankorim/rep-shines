import { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, Loader2, Search } from "lucide-react";
import { getNylasConnectUrl, detectEmailProvider } from "@/lib/server-functions/nylas";
import { toast } from "sonner";

type Provider = "google" | "microsoft" | "imap";

interface EmailConnectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
  existingEmails?: string[];
}

const PROVIDER_INFO: Record<Provider, { label: string; icon: string }> = {
  google: { label: "Gmail / Google Workspace", icon: "📧" },
  microsoft: { label: "Outlook / Microsoft 365", icon: "📬" },
  imap: { label: "Iný e-mail (IMAP)", icon: "✉️" },
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function EmailConnectDialog({ open, onOpenChange, clientId, existingEmails = [] }: EmailConnectDialogProps) {
  const [email, setEmail] = useState("");
  const [detectedProvider, setDetectedProvider] = useState<Provider | null>(null);
  const [detecting, setDetecting] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [detected, setDetected] = useState(false);

  const normalizedEmail = email.trim().toLowerCase();
  const hasValidEmail = EMAIL_PATTERN.test(email.trim());

  useEffect(() => {
    if (!open) {
      setEmail("");
      setDetectedProvider(null);
      setDetecting(false);
      setDetected(false);
    }
  }, [open]);

  const handleDetect = useCallback(async () => {
    if (!hasValidEmail) return;

    setDetecting(true);
    setDetected(false);
    try {
      const result = await detectEmailProvider({ data: { email: normalizedEmail } });
      setDetectedProvider(result.provider);
      setDetected(true);
    } catch {
      setDetectedProvider("imap");
      setDetected(true);
    } finally {
      setDetecting(false);
    }
  }, [hasValidEmail, normalizedEmail]);

  useEffect(() => {
    if (!hasValidEmail) {
      setDetected(false);
      setDetectedProvider(null);
      return;
    }

    const timer = setTimeout(handleDetect, 600);
    return () => clearTimeout(timer);
  }, [hasValidEmail, handleDetect]);

  const handleConnect = async () => {
    if (!detectedProvider || !hasValidEmail) return;

    if (existingEmails.includes(normalizedEmail)) {
      toast.error("Tento email je už pripojený");
      return;
    }

    setConnecting(true);
    try {
      const result = await getNylasConnectUrl({
        data: { clientId, provider: detectedProvider, loginHint: normalizedEmail || undefined },
      });
      if (result?.url) {
        window.open(result.url, "_blank", "noopener");
        onOpenChange(false);
      } else {
        toast.error("Nepodarilo sa získať odkaz na pripojenie");
      }
    } catch (err: any) {
      toast.error(err?.message || "Chyba pri pripájaní emailu");
    } finally {
      setConnecting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" /> Pripojiť e-mail
          </DialogTitle>
          <DialogDescription>
            Zadajte e-mailovú adresu — automaticky zistíme typ služby podľa MX záznamov domény.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="connect-email">E-mailová adresa</Label>
            <Input
              id="connect-email"
              type="email"
              placeholder="meno@firma.sk"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          {detecting && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground p-3 border border-border bg-muted/30">
              <Search className="h-4 w-4 animate-pulse" />
              Overujem typ e-mailovej služby...
            </div>
          )}

          {detected && detectedProvider && !detecting && (
            <div className="space-y-2">
              <Label>Rozpoznaná služba</Label>
              <div className="flex items-center gap-3 p-3 border border-primary bg-primary/5">
                <span className="text-xl">{PROVIDER_INFO[detectedProvider].icon}</span>
                <div>
                  <p className="text-sm font-medium">{PROVIDER_INFO[detectedProvider].label}</p>
                  <p className="text-xs text-muted-foreground">
                    Zistené podľa MX záznamov domény
                  </p>
                </div>
              </div>
            </div>
          )}

          <Button
            className="w-full"
            onClick={handleConnect}
            disabled={!detected || !detectedProvider || !hasValidEmail || connecting}
          >
            {connecting ? (
              <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Pripájam...</>
            ) : (
              "Pripojiť e-mail"
            )}
          </Button>

          <p className="text-[10px] text-muted-foreground text-center">
            Požiadame len o prístup na <strong>čítanie</strong> e-mailov a príloh. Nebudeme mať prístup ku kontaktom, kalendáru ani iným dátam.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
