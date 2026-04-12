import { createFileRoute } from "@tanstack/react-router";
import { PortalLayout } from "@/components/layout/PortalLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Mail, Building2, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getPortalStats } from "@/lib/server-functions";
import { getNylasConnectUrl } from "@/lib/server-functions/nylas";
import { initBankConnection } from "@/lib/server-functions/bank";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/portal/connections")({ component: ConnectionsPage });

function ConnectionsPage() {
  const [connectingEmail, setConnectingEmail] = useState(false);
  const [connectingBank, setConnectingBank] = useState(false);

  const { data: stats } = useQuery({
    queryKey: ["portal-stats"],
    queryFn: () => getPortalStats(),
  });

  const clientId = stats?.clientId;

  const handleConnectEmail = async () => {
    if (!clientId) {
      toast.error("Najskôr musíte byť priradený ku klientovi");
      return;
    }
    setConnectingEmail(true);
    try {
      const result = await getNylasConnectUrl({ data: { clientId } });
      if (result?.url) {
        window.open(result.url, '_blank', 'noopener');
      } else {
        toast.error("Nepodarilo sa získať odkaz na pripojenie emailu");
      }
    } catch (e: any) {
      console.error("Email connect error:", e);
      toast.error(e?.message || "Chyba pri pripájaní emailu");
    } finally {
      setConnectingEmail(false);
    }
  };

  const handleConnectBank = async () => {
    if (!clientId) {
      toast.error("Najskôr musíte byť priradený ku klientovi");
      return;
    }
    setConnectingBank(true);
    try {
      const result = await initBankConnection({ data: { clientId } });
      if (result?.connectUrl) {
        window.open(result.connectUrl, '_blank', 'noopener');
      } else {
        toast.error("Nepodarilo sa získať odkaz na pripojenie banky");
      }
    } catch (e: any) {
      console.error("Bank connect error:", e);
      toast.error(e?.message || "Chyba pri pripájaní banky");
    } finally {
      setConnectingBank(false);
    }
  };

  return (
    <PortalLayout>
      <div className="space-y-6">
        <h1 className="text-lg sm:text-xl font-semibold tracking-tight">Pripojenia</h1>

        {!clientId && stats !== undefined && (
          <div className="flex items-center gap-2 text-sm text-destructive">
            <AlertCircle className="h-4 w-4" />
            Váš účet ešte nie je priradený ku klientovi. Kontaktujte svojho účtovníka.
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><Mail className="h-4 w-4" /> E-mail</CardTitle></CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground mb-3">Pripojte email pre automatický zber faktúr</p>
              <Button size="sm" onClick={handleConnectEmail} disabled={connectingEmail || !clientId}>
                {connectingEmail && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Pripojiť e-mail
              </Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><Building2 className="h-4 w-4" /> Banka</CardTitle></CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground mb-3">Tatra banka, SLSP, VÚB, ČSOB, mBank a ďalšie SK/CZ banky cez Salt Edge</p>
              <Button size="sm" onClick={handleConnectBank} disabled={connectingBank || !clientId}>
                {connectingBank && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Pripojiť banku
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </PortalLayout>
  );
}
