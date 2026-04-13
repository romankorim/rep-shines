import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Mail, Building2, ArrowLeft, Loader2, Upload, RefreshCw, Copy, Check, LinkIcon, Plus, Trash2, GripVertical, ChevronLeft, ChevronRight, X } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { clientQueryOptions } from "@/lib/query-options";
import { useState, useEffect, useCallback } from "react";
import { DocumentViewer } from "@/components/documents/DocumentViewer";
import { EmailConnectDialog } from "@/components/email/EmailConnectDialog";
import {
  exchangeNylasCode,
  triggerEmailScan,
  disconnectEmail,
  moveDocumentPeriod,
} from "@/lib/server-functions";
import {
  initBankConnection,
  completeBankConnection,
  syncBankTransactions,
} from "@/lib/server-functions/bank";
import { createInvitation } from "@/lib/server-functions/invitations";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/clients/$clientId")({
  component: ClientDetailPage,
  validateSearch: (search: Record<string, unknown>) => ({
    nylas_code: (search.nylas_code as string) || undefined,
    bank_connected: (search.bank_connected as string) || undefined,
    connection_id: (search.connection_id as string) || undefined,
  } as { nylas_code?: string; bank_connected?: string; connection_id?: string }),
});

const statusConfig: Record<string, { label: string; class: string }> = {
  processing: { label: "Spracováva sa", class: "bg-primary/15 text-primary" },
  pending_approval: { label: "Na schválenie", class: "bg-warning/15 text-warning-foreground" },
  approved: { label: "Schválené", class: "bg-success/15 text-success" },
  rejected: { label: "Zamietnuté", class: "bg-destructive/15 text-destructive" },
  duplicate: { label: "Duplikát", class: "bg-muted text-muted-foreground" },
  error: { label: "Chyba", class: "bg-destructive/15 text-destructive" },
};

const docTypeLabels: Record<string, string> = {
  received_invoice: "Prijatá faktúra",
  issued_invoice: "Vydaná faktúra",
  receipt: "Účtenka",
  credit_note: "Dobropis",
  advance_invoice: "Zálohová faktúra",
  bank_statement: "Bankový výpis",
  other: "Iné",
};

const MONTH_NAMES = [
  "Január", "Február", "Marec", "Apríl", "Máj", "Jún",
  "Júl", "August", "September", "Október", "November", "December",
];

function ClientDetailPage() {
  const { clientId } = Route.useParams();
  const { nylas_code, bank_connected, connection_id } = Route.useSearch();
  const { data, isLoading } = useQuery(clientQueryOptions(clientId));
  const [selectedDoc, setSelectedDoc] = useState<any>(null);
  const [exchangingCode, setExchangingCode] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [connectingBank, setConnectingBank] = useState(false);
  const [syncingBank, setSyncingBank] = useState(false);
  const [inviteCopied, setInviteCopied] = useState(false);
  const [creatingInvite, setCreatingInvite] = useState(false);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [draggedDocId, setDraggedDocId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth() + 1);

  // Handle Nylas OAuth callback
  useEffect(() => {
    if (nylas_code && !exchangingCode) {
      setExchangingCode(true);
      console.log("[Nylas] Starting code exchange, code length:", nylas_code.length);
      exchangeNylasCode({ data: { code: nylas_code, clientId } })
        .then((result) => {
          console.log("[Nylas] Exchange success:", result);
          queryClient.invalidateQueries({ queryKey: ["client", clientId] });
          window.history.replaceState({}, "", `/clients/${clientId}`);
          toast.success(`E-mailový účet ${result?.email || ""} úspešne pripojený`);
        })
        .catch((err) => {
          console.error("[Nylas] Exchange failed:", err);
          toast.error(err?.message || "Nepodarilo sa pripojiť e-mail");
          window.history.replaceState({}, "", `/clients/${clientId}`);
        })
        .finally(() => setExchangingCode(false));
    }
  }, [nylas_code]);

  // Handle Salt Edge bank callback
  useEffect(() => {
    if (bank_connected && connection_id) {
      completeBankConnection({ data: { clientId, connectionId: connection_id } })
        .then(() => {
          queryClient.invalidateQueries({ queryKey: ["client", clientId] });
          return syncBankTransactions({ data: { clientId } });
        })
        .then(() => {
          queryClient.invalidateQueries({ queryKey: ["client", clientId] });
          window.history.replaceState({}, "", `/clients/${clientId}`);
        })
        .catch((err: unknown) => console.error("Bank connection failed:", err));
    }
  }, [bank_connected, connection_id]);

  const handleDropOnPeriod = useCallback(async (docId: string, targetMonth: number, targetYear: number) => {
    try {
      await moveDocumentPeriod({ data: { documentId: docId, targetMonth, targetYear } });
      queryClient.invalidateQueries({ queryKey: ["client", clientId] });
      toast.success("Doklad presunutý");
    } catch {
      toast.error("Nepodarilo sa presunúť doklad");
    }
  }, [clientId, queryClient]);

  if (isLoading || !data) {
    return <DashboardLayout><div className="text-sm text-muted-foreground">Načítavam...</div></DashboardLayout>;
  }

  const { client, docCount, txCount, emailIntegrations, bankIntegration, documents } = data;
  const connectedEmails = emailIntegrations.filter((e: any) => e.status === "connected");
  const existingEmailAddresses = connectedEmails.map((e: any) => e.email_address?.toLowerCase()).filter(Boolean);

  // Group documents by month/year (using tax_period or created_at)
  const getDocPeriod = (doc: any) => {
    if (doc.tax_period_month && doc.tax_period_year) {
      return { month: doc.tax_period_month, year: doc.tax_period_year };
    }
    const d = new Date(doc.issue_date || doc.created_at);
    return { month: d.getMonth() + 1, year: d.getFullYear() };
  };

  const currentPeriodDocs = documents.filter((doc: any) => {
    const p = getDocPeriod(doc);
    return p.month === viewMonth && p.year === viewYear;
  });

  function prevMonth() {
    if (viewMonth === 1) { setViewMonth(12); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  }
  function nextMonth() {
    if (viewMonth === 12) { setViewMonth(1); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/clients" className="text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div>
              <h1 className="text-lg sm:text-xl font-semibold tracking-tight">{client.name}</h1>
              <p className="text-xs text-muted-foreground">{client.company_name || client.email}</p>
            </div>
          </div>
          {!client.user_id && (
            <Button
              size="sm"
              variant="outline"
              disabled={creatingInvite}
              onClick={async () => {
                setCreatingInvite(true);
                try {
                  const result = await createInvitation({ data: { clientId } });
                  const inviteUrl = `${window.location.origin}/invite?token=${result.token}`;
                  await navigator.clipboard.writeText(inviteUrl);
                  setInviteCopied(true);
                  setTimeout(() => setInviteCopied(false), 3000);
                } catch (err: unknown) {
                  console.error("Failed to create invitation:", err);
                } finally {
                  setCreatingInvite(false);
                }
              }}
            >
              {creatingInvite ? (
                <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> Generujem...</>
              ) : inviteCopied ? (
                <><Check className="h-3.5 w-3.5 mr-1 text-primary" /> Link skopírovaný!</>
              ) : (
                <><LinkIcon className="h-3.5 w-3.5 mr-1" /> Pozvať klienta</>
              )}
            </Button>
          )}
          {client.user_id && (
            <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-medium bg-success/15 text-success rounded-none">
              Klient registrovaný
            </span>
          )}
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
            <p className="text-2xl font-bold">{connectedEmails.length}</p>
            <p className="text-xs text-muted-foreground">E-maily</p>
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
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2"><Mail className="h-4 w-4" /> E-mailové účty</CardTitle>
                <Button size="sm" variant="outline" onClick={() => setEmailDialogOpen(true)}>
                  <Plus className="h-3.5 w-3.5 mr-1" /> Pridať
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {connectedEmails.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Pripojte e-mail pre automatické sťahovanie dokladov z príloh.
                </p>
              ) : (
                <div className="space-y-1.5">
                  {connectedEmails.map((ei: any) => {
                    const providerLogo = ei.provider === "google" ? (
                      <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" xmlns="http://www.w3.org/2000/svg">
                        <path d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 0 1 0 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L5.455 4.64 12 9.548l6.545-4.91 1.528-1.145C21.69 2.28 24 3.434 24 5.457z" fill="#EA4335"/>
                      </svg>
                    ) : ei.provider === "microsoft" ? (
                      <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" xmlns="http://www.w3.org/2000/svg">
                        <path d="M0 0h11.377v11.372H0zm12.623 0H24v11.372H12.623zM0 12.623h11.377V24H0zm12.623 0H24V24H12.623z" fill="#0078D4"/>
                      </svg>
                    ) : (
                      <Mail className="h-4 w-4 shrink-0 text-muted-foreground" />
                    );
                    return (
                      <div key={ei.id} className="flex items-center justify-between gap-3 px-2 py-1.5 border border-border bg-muted/20">
                        <div className="flex items-center gap-2 min-w-0 basis-1/2 max-w-1/2 shrink">
                          {providerLogo}
                          <span className="text-xs font-medium truncate">{ei.email_address || "Neznámy"}</span>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {ei.last_sync_at && (
                            <span className="text-[9px] text-muted-foreground shrink-0 mr-1">
                              {new Date(ei.last_sync_at).toLocaleDateString("sk-SK")}
                            </span>
                          )}
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6 shrink-0 text-muted-foreground hover:text-foreground"
                            title="Synchronizovať e-maily"
                            onClick={async () => {
                              try {
                                const result = await triggerEmailScan({ data: { clientId } });
                                queryClient.invalidateQueries({ queryKey: ["client", clientId] });
                                toast.success(`Synchronizácia dokončená (${result.processed} dokladov)`);
                              } catch {
                                toast.error("Nepodarilo sa synchronizovať e-maily");
                              }
                            }}
                          >
                            <RefreshCw className="h-3 w-3" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6 shrink-0 text-destructive hover:text-destructive"
                            title="Odpojiť e-mail"
                            onClick={async () => {
                              try {
                                await disconnectEmail({ data: { clientId } });
                                queryClient.invalidateQueries({ queryKey: ["client", clientId] });
                                toast.success("E-mail odpojený");
                              } catch {
                                toast.error("Nepodarilo sa odpojiť e-mail");
                              }
                            }}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
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
                    {bankIntegration.last_sync_at && (
                      <span className="text-[10px] text-muted-foreground">
                        Posledný sync: {new Date(bankIntegration.last_sync_at).toLocaleString("sk-SK")}
                      </span>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={syncingBank}
                    onClick={async () => {
                      setSyncingBank(true);
                      try {
                        await syncBankTransactions({ data: { clientId } });
                        queryClient.invalidateQueries({ queryKey: ["client", clientId] });
                      } catch (err: unknown) {
                        console.error("Bank sync failed:", err);
                      } finally {
                        setSyncingBank(false);
                      }
                    }}
                  >
                    {syncingBank ? (
                      <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> Synchronizujem...</>
                    ) : (
                      <><RefreshCw className="h-3.5 w-3.5 mr-1" /> Synchronizovať</>
                    )}
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs text-muted-foreground">Tatra banka, SLSP, VÚB, ČSOB, mBank a ďalšie SK/CZ banky</p>
                  <Button
                    size="sm"
                    disabled={connectingBank}
                    onClick={async () => {
                      setConnectingBank(true);
                      try {
                        const result = await initBankConnection({ data: { clientId } });
                        if (result?.connectUrl) {
                          window.open(result.connectUrl, '_blank', 'noopener');
                        }
                      } catch (err: unknown) {
                        console.error("Bank connect failed:", err);
                        setConnectingBank(false);
                      }
                    }}
                  >
                    {connectingBank ? (
                      <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> Pripájam...</>
                    ) : (
                      <><Building2 className="h-3.5 w-3.5 mr-1" /> Pripojiť banku</>
                    )}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Documents by month with drag&drop */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold">Doklady klienta</h2>
            <div className="flex items-center gap-2">
              <button onClick={prevMonth} className="p-1 min-h-[44px] min-w-[44px] flex items-center justify-center hover:bg-muted transition-colors">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-sm font-medium min-w-[120px] text-center">{MONTH_NAMES[viewMonth - 1]} {viewYear}</span>
              <button onClick={nextMonth} className="p-1 min-h-[44px] min-w-[44px] flex items-center justify-center hover:bg-muted transition-colors">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div
            className="min-h-[100px] border-2 border-dashed border-transparent transition-colors"
            onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add("border-primary/40", "bg-primary/5"); }}
            onDragLeave={(e) => { e.currentTarget.classList.remove("border-primary/40", "bg-primary/5"); }}
            onDrop={(e) => {
              e.preventDefault();
              e.currentTarget.classList.remove("border-primary/40", "bg-primary/5");
              const docId = e.dataTransfer.getData("text/plain");
              if (docId) handleDropOnPeriod(docId, viewMonth, viewYear);
            }}
          >
            {currentPeriodDocs.length === 0 ? (
              <Card>
                <CardContent className="p-6 text-center">
                  <FileText className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground">
                    Žiadne doklady za {MONTH_NAMES[viewMonth - 1].toLowerCase()} {viewYear}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-1">Presuňte doklad sem pomocou drag & drop</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
                {currentPeriodDocs.map((doc: any) => {
                  const status = statusConfig[doc.status] || { label: doc.status, class: "bg-muted text-muted-foreground" };
                  const isImage = doc.file_type?.startsWith("image/");
                  const isPdf = doc.file_type?.includes("pdf");
                  return (
                    <Card
                      key={doc.id}
                      draggable
                      className="cursor-grab active:cursor-grabbing hover:shadow-md transition-all overflow-hidden"
                      onDragStart={(e) => {
                        e.dataTransfer.setData("text/plain", doc.id);
                        setDraggedDocId(doc.id);
                      }}
                      onDragEnd={() => setDraggedDocId(null)}
                      onClick={() => setSelectedDoc(doc)}
                    >
                      {/* Thumbnail */}
                      <div className="aspect-[4/3] bg-muted/30 flex items-center justify-center overflow-hidden border-b border-border">
                        {doc.file_url && isImage ? (
                          <img src={doc.file_url} alt={doc.file_name || "Document"} className="w-full h-full object-cover" />
                        ) : doc.file_url && isPdf ? (
                          <div className="w-full h-full flex flex-col items-center justify-center bg-destructive/5">
                            <FileText className="h-8 w-8 text-destructive/60" />
                            <span className="text-[9px] text-muted-foreground mt-1 uppercase font-medium">PDF</span>
                          </div>
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center">
                            <FileText className="h-8 w-8 text-muted-foreground/40" />
                          </div>
                        )}
                      </div>
                      <CardContent className="p-2.5">
                        <div className="flex items-center justify-between mb-1">
                          <span className={`inline-flex items-center px-1.5 py-0.5 text-[8px] font-medium rounded-none ${status.class}`}>
                            {status.label}
                          </span>
                          <div className="flex items-center gap-1">
                            {doc.source === "email" && <Mail className="h-2.5 w-2.5 text-muted-foreground" />}
                            <GripVertical className="h-2.5 w-2.5 text-muted-foreground" />
                          </div>
                        </div>
                        <p className="text-xs font-medium truncate">{doc.supplier_name || doc.file_name || "Neznámy"}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {doc.total_amount ? `${Number(doc.total_amount).toLocaleString("sk-SK")} €` : "—"}
                        </p>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>

          {/* Adjacent months drop zones when dragging */}
          {draggedDocId && (
            <div className="grid grid-cols-2 gap-3 mt-3">
              <div
                className="border-2 border-dashed border-muted p-3 text-center text-xs text-muted-foreground hover:border-primary/40 hover:bg-primary/5 transition-colors"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const docId = e.dataTransfer.getData("text/plain");
                  const pm = viewMonth === 1 ? 12 : viewMonth - 1;
                  const py = viewMonth === 1 ? viewYear - 1 : viewYear;
                  if (docId) handleDropOnPeriod(docId, pm, py);
                }}
              >
                ← {MONTH_NAMES[(viewMonth - 2 + 12) % 12]} {viewMonth === 1 ? viewYear - 1 : viewYear}
              </div>
              <div
                className="border-2 border-dashed border-muted p-3 text-center text-xs text-muted-foreground hover:border-primary/40 hover:bg-primary/5 transition-colors"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const docId = e.dataTransfer.getData("text/plain");
                  const nm = viewMonth === 12 ? 1 : viewMonth + 1;
                  const ny = viewMonth === 12 ? viewYear + 1 : viewYear;
                  if (docId) handleDropOnPeriod(docId, nm, ny);
                }}
              >
                {MONTH_NAMES[viewMonth % 12]} {viewMonth === 12 ? viewYear + 1 : viewYear} →
              </div>
            </div>
          )}
        </div>
      </div>

      <DocumentViewer
        document={selectedDoc}
        open={!!selectedDoc}
        onOpenChange={(open) => { if (!open) setSelectedDoc(null); }}
      />

      <EmailConnectDialog
        open={emailDialogOpen}
        onOpenChange={setEmailDialogOpen}
        clientId={clientId}
        existingEmails={existingEmailAddresses}
      />
    </DashboardLayout>
  );
}
