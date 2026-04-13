import { useState, useEffect } from "react";
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
import { Mail, Loader2 } from "lucide-react";
import { getNylasConnectUrl } from "@/lib/server-functions/nylas";
import { toast } from "sonner";

type Provider = "google" | "microsoft" | "imap";

interface EmailConnectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
  existingEmails?: string[];
}

function detectProvider(email: string): Provider | null {
  const domain = email.split("@")[1]?.toLowerCase();
  if (!domain) return null;
  if (["gmail.com", "googlemail.com"].includes(domain) || domain.endsWith(".google.com")) return "google";
  if (["outlook.com", "hotmail.com", "live.com", "msn.com", "outlook.sk", "outlook.cz"].includes(domain) || domain.endsWith(".onmicrosoft.com")) return "microsoft";
  return "imap";
}

const PROVIDERS: { id: Provider; label: string; desc: string; icon: string }[] = [
  { id: "google", label: "Gmail", desc: "Google e-mailové účty", icon: "📧" },
  { id: "microsoft", label: "Outlook", desc: "Microsoft / Office 365", icon: "📬" },
  { id: "imap", label: "Iný e-mail (IMAP)", desc: "Vlastný server, Zoznam, Centrum, atď.", icon: "✉️" },
];

export function EmailConnectDialog({ open, onOpenChange, clientId, existingEmails = [] }: EmailConnectDialogProps) {
  const [email, setEmail] = useState("");
  const [detectedProvider, setDetectedProvider] = useState<Provider | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<Provider | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [step, setStep] = useState<"email" | "provider">("email");

  useEffect(() => {
    if (!open) {
      setEmail("");
      setDetectedProvider(null);
      setSelectedProvider(null);
      setStep("email");
    }
  }, [open]);

  useEffect(() => {
    if (email.includes("@")) {
      const detected = detectProvider(email);
      setDetectedProvider(detected);
      setSelectedProvider(detected);
    } else {
      setDetectedProvider(null);
      setSelectedProvider(null);
    }
  }, [email]);

  const handleConnect = async () => {
    const provider = selectedProvider;
    if (!provider) return;

    if (existingEmails.includes(email.toLowerCase())) {
      toast.error("Tento email je už pripojený");
      return;
    }

    setConnecting(true);
    try {
      const result = await getNylasConnectUrl({
        data: { clientId, provider, loginHint: email || undefined },
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
            Zadajte e-mailovú adresu a vyberte typ služby. Požiadame len o prístup na čítanie e-mailov a príloh.
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

          {email.includes("@") && (
            <div className="space-y-2">
              {detectedProvider && detectedProvider !== "imap" ? (
                <>
                  <Label>Rozpoznaná služba</Label>
                  <div className="flex items-center gap-3 p-3 border border-primary bg-primary/5">
                    <span className="text-xl">{PROVIDERS.find(p => p.id === detectedProvider)?.icon}</span>
                    <div>
                      <p className="text-sm font-medium">{PROVIDERS.find(p => p.id === detectedProvider)?.label}</p>
                      <p className="text-xs text-muted-foreground">Automaticky rozpoznané podľa domény</p>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <Label>Typ e-mailovej služby</Label>
                  <p className="text-xs text-muted-foreground">
                    Nepodarilo sa automaticky rozpoznať poskytovateľa. Vyberte manuálne:
                  </p>
                  <div className="grid gap-2">
                    {PROVIDERS.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setSelectedProvider(p.id)}
                        className={`flex items-center gap-3 p-3 text-left border transition-colors ${
                          selectedProvider === p.id
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-muted-foreground/30"
                        }`}
                      >
                        <span className="text-xl">{p.icon}</span>
                        <div>
                          <p className="text-sm font-medium">{p.label}</p>
                          <p className="text-xs text-muted-foreground">{p.desc}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          <Button
            className="w-full"
            onClick={handleConnect}
            disabled={!selectedProvider || !email.includes("@") || connecting}
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
