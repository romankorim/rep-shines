import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Mail, Building2, ArrowLeft, Loader2, Upload } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { clientQueryOptions } from "@/lib/query-options";
import { useState, useEffect } from "react";
import { DocumentViewer } from "@/components/documents/DocumentViewer";
import { getNylasConnectUrl, exchangeNylasCode } from "@/lib/server-functions";

export const Route = createFileRoute("/_authenticated/clients/$clientId")({
  component: ClientDetailPage,
  validateSearch: (search: Record<string, unknown>) => ({
    nylas_code: (search.nylas_code as string) || undefined,
  } as { nylas_code?: string }),
});

const statusConfig: Record<string, { label: string; class: string }> = {
  processing: { label: "Spracováva sa", class: "bg-primary/15 text-primary" },
  pending_approval: { label: "Na schválenie", class: "bg-warning/15 text-warning-foreground" },
  approved: { label: "Schválené", class: "bg-success/15 text-success" },
  rejected: { label: "Zamietnuté", class: "bg-destructive/15 text-destructive" },
  duplicate: { label: "Duplikát", class: "bg-muted text-muted-foreground" },
  error: { label: "Chyba", class: "bg-destructive/15 text-destructive" },
};

function ClientDetailPage() {
  const { clientId } = Route.useParams();
  const { nylas_code } = Route.useSearch();
  const { data, isLoading } = useQuery(clientQueryOptions(clientId));
  const [selectedDoc, setSelectedDoc] = useState<any>(null);
  const [connectingEmail, setConnectingEmail] = useState(false);
  const [exchangingCode, setExchangingCode] = useState(false);
  const queryClient = useQueryClient();

  // Handle Nylas OAuth callback
  useEffect(() => {
    if (nylas_code && !exchangingCode) {
      setExchangingCode(true);
      exchangeNylasCode({ data: { code: nylas_code, clientId } })
        .then(() => {
          queryClient.invalidateQueries({ queryKey: ["client", clientId] });
          // Clean URL
          window.history.replaceState({}, "", `/clients/${clientId}`);
        })
        .catch((err) => {
          console.error("Nylas exchange failed:", err);
        })
        .finally(() => setExchangingCode(false));
    }
  }, [nylas_code]);

  if (isLoading || !data) {
    return <DashboardLayout><div className="text-sm text-muted-foreground">Načítavam...</div></DashboardLayout>;
  }

  const { client, docCount, txCount, emailIntegration, bankIntegration, documents } = data;

  async function handleConnectEmail() {
    setConnectingEmail(true);
    try {
      const result = await getNylasConnectUrl({ data: { clientId } });
      if (result?.url) {
        window.location.href = result.url;
      }
    } catch (err) {
      console.error("Failed to get Nylas URL:", err);
      setConnectingEmail(false);
    }
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Link to="/clients" className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-lg sm:text-xl font-semibold tracking-tight">{client.name}</h1>
            <p className="text-xs text-muted-foreground">{client.company_name || client.email}</p>
          </div>
        </div>

        {exchangingCode && (
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="p-4 flex items-center gap-3">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <p className="text-sm">Pripájam e-mailový účet...</p>
            </CardContent>
          </Card>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Card><CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{docCount}</p>
            <p className="text-xs text-muted-foreground">Doklady</p>
          </CardContent></Card>
          <Card><CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{txCount}</p>
            <p className="text-xs text-muted-foreground">Transakcie</p>
          </CardContent></Card>
          <Card><CardContent className="p-4 text-center">
            <div className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-none ${emailIntegration?.status === "connected" ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"}`}>
              {emailIntegration?.status === "connected" ? "Pripojený" : "Nepripojený"}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Email</p>
          </CardContent></Card>
          <Card><CardContent className="p-4 text-center">
            <div className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-none ${bankIntegration?.status === "connected" ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"}`}>
              {bankIntegration?.status === "connected" ? "Pripojená" : "Nepripojená"}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Banka</p>
          </CardContent></Card>
        </div>

        {/* Integration cards */}
        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2"><Mail className="h-4 w-4" /> E-mailová integrácia</CardTitle>
            </CardHeader>
            <CardContent>
              {emailIntegration?.status === "connected" ? (
                <div className="space-y-2">
                  <p className="text-sm">{emailIntegration.email_address}</p>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-medium bg-success/15 text-success rounded-none">Aktívne</span>
                    {emailIntegration.last_sync_at && (
                      <span className="text-[10px] text-muted-foreground">
                        Posledný sken: {new Date(emailIntegration.last_sync_at).toLocaleString("sk-SK")}
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    Automaticky skenuje nové emaily s prílohami (PDF, obrázky) a spúšťa AI extrakciu.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs text-muted-foreground">
                    Pripojte e-mail klienta (Gmail, Outlook) pre automatické skenovanie faktúr z príloh.
                  </p>
                  <Button size="sm" onClick={handleConnectEmail} disabled={connectingEmail}>
                    {connectingEmail ? (
                      <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> Pripájam...</>
                    ) : (
                      <><Mail className="h-3.5 w-3.5 mr-1" /> Pripojiť e-mail</>
                    )}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2"><Building2 className="h-4 w-4" /> Banková integrácia</CardTitle>
            </CardHeader>
            <CardContent>
              {bankIntegration?.status === "connected" ? (
                <div className="space-y-2">
                  <p className="text-sm">{bankIntegration.bank_name}</p>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-medium bg-success/15 text-success rounded-none">Aktívne</span>
                    <Button size="sm" variant="outline">Synchronizovať</Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs text-muted-foreground">Tatra banka, SLSP, VÚB, ČSOB, mBank a ďalšie SK/CZ banky</p>
                  <Button size="sm">Pripojiť banku</Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Documents */}
        <div>
          <h2 className="text-sm font-semibold mb-3">Doklady klienta</h2>
          {documents.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center">
                <FileText className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">Zatiaľ žiadne doklady</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {documents.map((doc) => {
                const status = statusConfig[doc.status] || { label: doc.status, class: "bg-muted text-muted-foreground" };
                return (
                  <Card
                    key={doc.id}
                    className="cursor-pointer hover:shadow-md transition-all"
                    onClick={() => setSelectedDoc(doc)}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-start justify-between mb-2">
                        <span className={`inline-flex items-center px-1.5 py-0.5 text-[9px] font-medium rounded-none ${status.class}`}>
                          {status.label}
                        </span>
                        {doc.source === "email" && (
                          <Mail className="h-3 w-3 text-muted-foreground" />
                        )}
                      </div>
                      <p className="text-sm font-medium truncate">{doc.supplier_name || doc.file_name || "Neznámy"}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {doc.total_amount ? `${Number(doc.total_amount).toLocaleString("sk-SK")} €` : "Suma neextrahovaná"}
                      </p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <DocumentViewer
        document={selectedDoc}
        open={!!selectedDoc}
        onOpenChange={(open) => { if (!open) setSelectedDoc(null); }}
      />
    </DashboardLayout>
  );
}
