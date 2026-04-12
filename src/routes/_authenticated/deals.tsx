import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo, useRef } from "react";
import { useSuspenseQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Plus, Search, ArrowUpDown, Download, Upload, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import { dealsQueryOptions } from "@/lib/query-options";
import { createDeal, updateDeal } from "@/lib/server-functions";
import { exportToCSV, parseCSVFile } from "@/lib/csv-utils";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/deals")({
  loader: ({ context }) => context.queryClient.ensureQueryData(dealsQueryOptions()),
  component: DealsPage,
});

type SortKey = "closeDate" | "dealSize" | "commissionAmount" | "repId";

import { formatCurrency } from "@/lib/format-utils";

function DealsPage() {
  const { data } = useSuspenseQuery(dealsQueryOptions());
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [repFilter, setRepFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey>("closeDate");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedDeal, setSelectedDeal] = useState<typeof deals[0] | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { deals, reps } = data;

  const filtered = useMemo(() => {
    let result = [...deals];
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((d) => {
        const repName = reps.find((r) => r.id === d.rep_id)?.name.toLowerCase() ?? "";
        return repName.includes(q) || d.id.includes(q);
      });
    }
    if (repFilter !== "all") result = result.filter((d) => d.rep_id === repFilter);
    if (typeFilter !== "all") result = result.filter((d) => d.deal_type === typeFilter);
    result.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "closeDate") cmp = a.close_date.localeCompare(b.close_date);
      else if (sortKey === "dealSize") cmp = Number(a.deal_size) - Number(b.deal_size);
      else if (sortKey === "commissionAmount") cmp = Number(a.commission_amount) - Number(b.commission_amount);
      else if (sortKey === "repId") cmp = (reps.find((r) => r.id === a.rep_id)?.name ?? "").localeCompare(reps.find((r) => r.id === b.rep_id)?.name ?? "");
      return sortDir === "asc" ? cmp : -cmp;
    });
    return result;
  }, [search, repFilter, typeFilter, sortKey, sortDir, deals, reps]);

  const dealTypes = [...new Set(deals.map((d) => d.deal_type))];

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("desc"); }
  }

  function handleExport() {
    const rows = filtered.map((d) => ({
      rep: reps.find((r) => r.id === d.rep_id)?.name ?? "",
      deal_size: d.deal_size,
      close_date: d.close_date,
      deal_type: d.deal_type,
      tier_applied: d.tier_applied ?? "",
      commission_amount: d.commission_amount,
      status: d.status,
      notes: d.notes ?? "",
    }));
    exportToCSV(rows, "deals-export.csv");
    toast.success("Deals exported successfully");
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const rows = await parseCSVFile<Record<string, string>>(file);
      let success = 0;
      const results = await Promise.allSettled(
        rows.map((row) => {
          const repName = row.rep?.trim();
          const rep = reps.find((r) => r.name.toLowerCase() === repName?.toLowerCase());
          if (!rep) throw new Error(`Rep "${repName}" not found`);
          return createDeal({
            data: {
              repId: rep.id,
              dealSize: parseFloat(row.deal_size ?? "0"),
              closeDate: row.close_date ?? new Date().toISOString().split("T")[0],
              dealType: row.deal_type ?? "New business",
              notes: row.notes,
            },
          });
        })
      );
      results.forEach((r) => { if (r.status === "fulfilled") success++; });
      queryClient.invalidateQueries({ queryKey: ["deals"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["reps"] });
      toast.success(`Imported ${success} of ${rows.length} deals`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Import failed");
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  const tierColors: Record<string, string> = {
    Starter: "bg-muted text-muted-foreground",
    Growth: "bg-warning/15 text-warning-foreground border-warning/20",
    Enterprise: "bg-primary/15 text-primary border-primary/20",
  };

  const selectedRep = selectedDeal ? reps.find((r) => r.id === selectedDeal.rep_id) : null;

  function handleSheetClose(open: boolean) {
    if (!open) {
      setSelectedDeal(null);
      setIsEditing(false);
    }
  }

  return (
    <AppLayout>
      <div className="space-y-4 sm:space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-lg sm:text-xl font-bold tracking-tight">Deals</h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">{deals.length} total deals</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" onClick={handleExport} className="min-h-[44px] sm:min-h-0 flex-1 sm:flex-none">
              <Download className="h-3.5 w-3.5 mr-1.5" />Export
            </Button>
            <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()} className="min-h-[44px] sm:min-h-0 flex-1 sm:flex-none">
              <Upload className="h-3.5 w-3.5 mr-1.5" />Import
            </Button>
            <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={handleImport} />
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="min-h-[44px] sm:min-h-0 w-full sm:w-auto"><Plus className="h-3.5 w-3.5 mr-1.5" />Add deal</Button>
              </DialogTrigger>
              <DialogContent className="max-w-[95vw] sm:max-w-lg">
                <DialogHeader><DialogTitle>Add new deal</DialogTitle></DialogHeader>
                <AddDealForm reps={reps} onClose={() => setDialogOpen(false)} />
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <Card className="p-3 sm:p-4">
          <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-3">
          <div className="relative w-full sm:flex-1 sm:min-w-[200px] sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input placeholder="Search by rep name..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-10 sm:h-8 text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:gap-3">
            <Select value={repFilter} onValueChange={setRepFilter}>
              <SelectTrigger className="h-10 sm:h-8 sm:w-[160px] text-sm"><SelectValue placeholder="All reps" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All reps</SelectItem>
                {reps.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="h-10 sm:h-8 sm:w-[160px] text-sm"><SelectValue placeholder="All types" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                {dealTypes.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          </div>
        </Card>

        {/* Mobile card view */}
        <div className="space-y-3 md:hidden">
          {filtered.map((deal) => {
            const rep = reps.find((r) => r.id === deal.rep_id);
            return (
              <div
                key={deal.id}
                className="rounded-lg border border-border/50 bg-card p-3.5 cursor-pointer hover:bg-muted/20 transition-colors"
                onClick={() => setSelectedDeal(deal)}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-secondary text-[10px] font-medium text-secondary-foreground">
                      {rep?.name.split(" ").map((n: string) => n[0]).join("")}
                    </div>
                    <span className="text-sm font-medium">{rep?.name}</span>
                  </div>
                  <Badge variant="outline" className={cn("text-[10px] font-medium border", tierColors[deal.tier_applied ?? ""] ?? "")}>
                    {deal.tier_applied}
                  </Badge>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center mt-2">
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase">Size</p>
                    <p className="text-xs font-semibold">{formatCurrency(Number(deal.deal_size))}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase">Commission</p>
                    <p className="text-xs font-semibold text-success">{formatCurrency(Number(deal.commission_amount))}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase">Date</p>
                    <p className="text-xs">{new Date(deal.close_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Desktop table view */}
        <Card className="hidden md:block overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  {[
                    { key: "repId" as SortKey, label: "Rep" },
                    { key: "dealSize" as SortKey, label: "Deal size" },
                    { key: "closeDate" as SortKey, label: "Close date" },
                    { key: null, label: "Type" },
                    { key: null, label: "Tier" },
                    { key: "commissionAmount" as SortKey, label: "Commission" },
                  ].map((col, i) => (
                    <th key={i} className="px-4 py-2.5 text-left text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                      {col.key ? (
                        <button onClick={() => toggleSort(col.key!)} className="flex items-center gap-1 hover:text-foreground transition-colors">
                          {col.label}
                          <ArrowUpDown className="h-3 w-3" />
                        </button>
                      ) : col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((deal) => {
                  const rep = reps.find((r) => r.id === deal.rep_id);
                  return (
                    <tr
                      key={deal.id}
                      className="border-b border-border/30 hover:bg-muted/20 transition-colors cursor-pointer"
                      onClick={() => setSelectedDeal(deal)}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-secondary text-[10px] font-medium text-secondary-foreground">
                            {rep?.name.split(" ").map((n: string) => n[0]).join("")}
                          </div>
                          <span className="font-medium text-foreground">{rep?.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-semibold text-foreground">{formatCurrency(Number(deal.deal_size))}</td>
                      <td className="px-4 py-3 text-muted-foreground">{new Date(deal.close_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</td>
                      <td className="px-4 py-3 text-muted-foreground">{deal.deal_type}</td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className={cn("text-[10px] font-medium border", tierColors[deal.tier_applied ?? ""] ?? "")}>
                          {deal.tier_applied}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 font-semibold text-success">{formatCurrency(Number(deal.commission_amount))}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* Deal detail sheet */}
      <Sheet open={!!selectedDeal} onOpenChange={handleSheetClose}>
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <div className="flex items-center justify-between">
              <SheetTitle>Deal details</SheetTitle>
              {!isEditing && (
                <Button size="sm" variant="outline" onClick={() => setIsEditing(true)}>
                  <Pencil className="h-3.5 w-3.5 mr-1.5" />Edit
                </Button>
              )}
            </div>
            <SheetDescription>Full information for this deal</SheetDescription>
          </SheetHeader>
          {selectedDeal && !isEditing && (
            <div className="space-y-6 mt-6">
              <div className="space-y-4">
                <DetailRow label="Rep" value={selectedRep?.name ?? "Unknown"} />
                <DetailRow label="Deal size" value={formatCurrency(Number(selectedDeal.deal_size))} />
                <DetailRow label="Close date" value={new Date(selectedDeal.close_date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })} />
                <DetailRow label="Deal type" value={selectedDeal.deal_type} />
                <DetailRow label="Tier applied" value={selectedDeal.tier_applied ?? "N/A"} />
                <DetailRow label="Commission" value={formatCurrency(Number(selectedDeal.commission_amount))} highlight />
                <DetailRow label="Status" value={selectedDeal.status} />
                {selectedDeal.notes && <DetailRow label="Notes" value={selectedDeal.notes} />}
                <DetailRow label="Created" value={new Date(selectedDeal.created_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })} />
              </div>
            </div>
          )}
          {selectedDeal && isEditing && (
            <EditDealForm
              deal={selectedDeal}
              onCancel={() => setIsEditing(false)}
              onSaved={(updated) => {
                setSelectedDeal(updated);
                setIsEditing(false);
              }}
            />
          )}
        </SheetContent>
      </Sheet>
    </AppLayout>
  );
}

function DetailRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex justify-between items-start py-2 border-b border-border/30">
      <span className="text-xs text-muted-foreground uppercase tracking-wider">{label}</span>
      <span className={cn("text-sm font-medium text-right max-w-[60%]", highlight && "text-success font-semibold")}>{value}</span>
    </div>
  );
}

function EditDealForm({ deal, onCancel, onSaved }: { deal: any; onCancel: () => void; onSaved: (d: any) => void }) {
  const queryClient = useQueryClient();
  const [dealSize, setDealSize] = useState(String(deal.deal_size));
  const [closeDate, setCloseDate] = useState(deal.close_date);
  const [dealType, setDealType] = useState(deal.deal_type);
  const [notes, setNotes] = useState(deal.notes ?? "");
  const [status, setStatus] = useState(deal.status);

  const mutation = useMutation({
    mutationFn: () =>
      updateDeal({
        data: {
          dealId: deal.id,
          dealSize: parseFloat(dealSize),
          closeDate,
          dealType,
          notes: notes || undefined,
          status,
        },
      }),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ["deals"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["reps"] });
      toast.success("Deal updated successfully");
      onSaved(updated);
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <div className="space-y-4 mt-6">
      <div className="space-y-2">
        <Label className="text-xs">Deal size ($)</Label>
        <Input type="number" value={dealSize} onChange={(e) => setDealSize(e.target.value)} className="h-9 text-sm" min="1" />
      </div>
      <div className="space-y-2">
        <Label className="text-xs">Close date</Label>
        <Input type="date" value={closeDate} onChange={(e) => setCloseDate(e.target.value)} className="h-9 text-sm" />
      </div>
      <div className="space-y-2">
        <Label className="text-xs">Deal type</Label>
        <Select value={dealType} onValueChange={setDealType}>
          <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="New business">New business</SelectItem>
            <SelectItem value="Expansion">Expansion</SelectItem>
            <SelectItem value="Renewal">Renewal</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label className="text-xs">Status</Label>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="closed">Closed</SelectItem>
            <SelectItem value="open">Open</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label className="text-xs">Notes</Label>
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="text-sm min-h-[80px]" />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>
        <Button size="sm" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
          {mutation.isPending ? "Saving..." : "Save changes"}
        </Button>
      </div>
    </div>
  );
}

function AddDealForm({ reps, onClose }: { reps: { id: string; name: string }[]; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [repId, setRepId] = useState("");
  const [dealSize, setDealSize] = useState("");
  const [closeDate, setCloseDate] = useState("");
  const [dealType, setDealType] = useState("");

  const mutation = useMutation({
    mutationFn: (input: { repId: string; dealSize: number; closeDate: string; dealType: string }) =>
      createDeal({ data: input }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deals"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["reps"] });
      toast.success("Deal added successfully");
      onClose();
    },
    onError: (err) => toast.error(err.message),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!repId || !dealSize || !closeDate || !dealType) return;
    mutation.mutate({ repId, dealSize: parseFloat(dealSize), closeDate, dealType });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 mt-2">
      <div className="space-y-2">
        <Label className="text-xs">Rep</Label>
        <Select value={repId} onValueChange={setRepId}>
          <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select rep" /></SelectTrigger>
          <SelectContent className="max-h-[200px] overflow-y-auto">
            {reps.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label className="text-xs">Deal size ($)</Label>
          <Input type="number" placeholder="25000" value={dealSize} onChange={(e) => setDealSize(e.target.value)} className="h-9 text-sm" required min="1" />
        </div>
        <div className="space-y-2">
          <Label className="text-xs">Close date</Label>
          <Input type="date" value={closeDate} onChange={(e) => setCloseDate(e.target.value)} className="h-9 text-sm" required />
        </div>
      </div>
      <div className="space-y-2">
        <Label className="text-xs">Deal type</Label>
        <Select value={dealType} onValueChange={setDealType}>
          <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="New business">New business</SelectItem>
            <SelectItem value="Expansion">Expansion</SelectItem>
            <SelectItem value="Renewal">Renewal</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
        <Button type="submit" size="sm" disabled={mutation.isPending}>{mutation.isPending ? "Adding..." : "Add deal"}</Button>
      </div>
    </form>
  );
}
