import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef } from "react";
import { useSuspenseQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/AppLayout";
import { RepCard } from "@/components/dashboard/RepCard";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { LayoutList, LayoutGrid, Download, Upload, Pencil, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { repsQueryOptions } from "@/lib/query-options";
import { createRep, updateRep } from "@/lib/server-functions";
import { exportToCSV, parseCSVFile } from "@/lib/csv-utils";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/reps/")({
  loader: ({ context }) => context.queryClient.ensureQueryData(repsQueryOptions()),
  component: RepsPage,
});

import { formatCurrency } from "@/lib/format-utils";

const tierColorMap: Record<string, string> = {
  destructive: "bg-destructive/15 text-destructive border-destructive/20",
  warning: "bg-warning/15 text-warning-foreground border-warning/20",
  success: "bg-success/15 text-success border-success/20",
  primary: "bg-primary/15 text-primary border-primary/20",
};

const progressColorMap: Record<string, string> = {
  destructive: "[&>[data-slot=indicator]]:bg-destructive",
  warning: "[&>[data-slot=indicator]]:bg-warning",
  success: "[&>[data-slot=indicator]]:bg-success",
  primary: "[&>[data-slot=indicator]]:bg-primary",
};

type RepData = {
  id: string;
  name: string;
  email: string | null;
  team: string;
  quota_target: number;
  quota_period: string;
  totalRevenue: number;
  totalCommission: number;
  attainment: number;
  dealCount: number;
  quotaTier: { tier_name: string; color: string; rate_multiplier: number };
};

function RepsPage() {
  const { data: reps } = useSuspenseQuery(repsQueryOptions());
  const queryClient = useQueryClient();
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [selectedRep, setSelectedRep] = useState<RepData | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isAddOpen, setIsAddOpen] = useState(false);

  function handleExport() {
    const rows = (reps as RepData[]).map((r) => ({
      name: r.name,
      email: r.email ?? "",
      team: r.team,
      quota_target: r.quota_target,
      quota_period: r.quota_period,
      total_revenue: r.totalRevenue,
      total_commission: r.totalCommission,
      attainment: Math.round(r.attainment),
      deals: r.dealCount,
      tier: r.quotaTier.tier_name,
    }));
    exportToCSV(rows, "reps-export.csv");
    toast.success("Reps exported successfully");
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const rows = await parseCSVFile<Record<string, string>>(file);
      let success = 0;
      const results = await Promise.allSettled(
        rows.map((row) =>
          createRep({
            data: {
              name: row.name?.trim() ?? "",
              email: row.email?.trim() || undefined,
              team: row.team?.trim() || undefined,
              quotaTarget: row.quota_target ? parseFloat(row.quota_target) : undefined,
              quotaPeriod: (row.quota_period as "month" | "quarter" | "year") || undefined,
            },
          })
        )
      );
      results.forEach((r) => { if (r.status === "fulfilled") success++; });
      queryClient.invalidateQueries({ queryKey: ["reps"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success(`Imported ${success} of ${rows.length} reps`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Import failed");
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleSheetClose(open: boolean) {
    if (!open) {
      setSelectedRep(null);
      setIsEditing(false);
    }
  }

  return (
    <AppLayout>
      <div className="space-y-4 sm:space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-lg sm:text-xl font-bold tracking-tight">Reps</h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">{reps.length} sales representatives</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex border border-border">
              <Button
                size="sm"
                variant={viewMode === "list" ? "default" : "ghost"}
                className="px-2.5 min-h-[44px] sm:min-h-0"
                onClick={() => setViewMode("list")}
              >
                <LayoutList className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="sm"
                variant={viewMode === "grid" ? "default" : "ghost"}
                className="px-2.5 min-h-[44px] sm:min-h-0"
                onClick={() => setViewMode("grid")}
              >
                <LayoutGrid className="h-3.5 w-3.5" />
              </Button>
            </div>
            <Button size="sm" variant="outline" onClick={handleExport} className="min-h-[44px] sm:min-h-0 flex-1 sm:flex-none">
              <Download className="h-3.5 w-3.5 mr-1.5" />Export
            </Button>
            <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()} className="min-h-[44px] sm:min-h-0 flex-1 sm:flex-none">
              <Upload className="h-3.5 w-3.5 mr-1.5" />Import
            </Button>
            <Button size="sm" onClick={() => setIsAddOpen(true)} className="min-h-[44px] sm:min-h-0 flex-1 sm:flex-none">
              <Plus className="h-3.5 w-3.5 mr-1.5" />Add rep
            </Button>
            <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={handleImport} />
          </div>
        </div>

        {viewMode === "grid" ? (
          <div className="grid grid-cols-1 gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {(reps as RepData[]).map((rep) => (
              <div key={rep.id} onClick={() => setSelectedRep(rep)} className="cursor-pointer">
                <RepCard rep={rep} />
              </div>
            ))}
          </div>
        ) : (
          <>
            {/* Mobile card view */}
            <div className="space-y-3 md:hidden">
              {(reps as RepData[]).map((rep) => (
                <div
                  key={rep.id}
                  className="rounded-lg border border-border/50 bg-card p-3.5 cursor-pointer hover:bg-muted/20 transition-colors"
                  onClick={() => setSelectedRep(rep)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-[10px] font-medium text-secondary-foreground">
                        {rep.name.split(" ").map((n) => n[0]).join("")}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{rep.name}</p>
                        <p className="text-[11px] text-muted-foreground">{rep.team}</p>
                      </div>
                    </div>
                    <Badge variant="outline" className={cn("text-[10px] font-medium border", tierColorMap[rep.quotaTier.color])}>
                      {rep.quotaTier.tier_name}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center mt-2">
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase">Revenue</p>
                      <p className="text-xs font-semibold">{formatCurrency(rep.totalRevenue)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase">Commission</p>
                      <p className="text-xs font-semibold text-success">{formatCurrency(rep.totalCommission)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase">Attainment</p>
                      <p className="text-xs font-semibold">{Math.round(rep.attainment)}%</p>
                    </div>
                  </div>
                  <div className="mt-2">
                    <Progress
                      value={Math.min(rep.attainment, 100)}
                      className={cn("h-1.5 bg-secondary", progressColorMap[rep.quotaTier.color])}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop table view */}
            <Card className="hidden md:block overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="px-4 py-2.5 text-left text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Name</th>
                      <th className="px-4 py-2.5 text-left text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Team</th>
                      <th className="px-4 py-2.5 text-left text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Deals</th>
                      <th className="px-4 py-2.5 text-left text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Revenue</th>
                      <th className="px-4 py-2.5 text-left text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Commission</th>
                      <th className="px-4 py-2.5 text-left text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Attainment</th>
                      <th className="px-4 py-2.5 text-left text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Tier</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(reps as RepData[]).map((rep) => (
                      <tr
                        key={rep.id}
                        className="border-b border-border/30 hover:bg-muted/20 transition-colors cursor-pointer"
                        onClick={() => setSelectedRep(rep)}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-secondary text-[10px] font-medium text-secondary-foreground">
                              {rep.name.split(" ").map((n) => n[0]).join("")}
                            </div>
                            <span className="font-medium text-foreground">{rep.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{rep.team}</td>
                        <td className="px-4 py-3 text-foreground">{rep.dealCount}</td>
                        <td className="px-4 py-3 font-semibold text-foreground">{formatCurrency(rep.totalRevenue)}</td>
                        <td className="px-4 py-3 font-semibold text-success">{formatCurrency(rep.totalCommission)}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2 min-w-[120px]">
                            <Progress
                              value={Math.min(rep.attainment, 100)}
                              className={cn("h-1.5 flex-1 bg-secondary", progressColorMap[rep.quotaTier.color])}
                            />
                            <span className="text-xs font-medium text-foreground w-10 text-right">{Math.round(rep.attainment)}%</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant="outline" className={cn("text-[10px] font-medium border", tierColorMap[rep.quotaTier.color])}>
                            {rep.quotaTier.tier_name}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </>
        )}
      </div>

      {/* Rep detail sheet */}
      <Sheet open={!!selectedRep} onOpenChange={handleSheetClose}>
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <div className="flex items-center justify-between">
              <SheetTitle>Rep details</SheetTitle>
              {!isEditing && (
                <Button size="sm" variant="outline" onClick={() => setIsEditing(true)}>
                  <Pencil className="h-3.5 w-3.5 mr-1.5" />Edit
                </Button>
              )}
            </div>
            <SheetDescription>Full information for this sales rep</SheetDescription>
          </SheetHeader>
          {selectedRep && !isEditing && (
            <div className="space-y-6 mt-6">
              <div className="flex items-center gap-3 pb-4 border-b border-border/30">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary text-sm font-semibold text-secondary-foreground">
                  {selectedRep.name.split(" ").map((n) => n[0]).join("")}
                </div>
                <div>
                  <p className="text-base font-semibold">{selectedRep.name}</p>
                  <p className="text-sm text-muted-foreground">{selectedRep.team}</p>
                </div>
              </div>
              <div className="space-y-4">
                <DetailRow label="Email" value={selectedRep.email ?? "N/A"} />
                <DetailRow label="Quota target" value={formatCurrency(Number(selectedRep.quota_target))} />
                <DetailRow label="Quota period" value={selectedRep.quota_period} />
                <DetailRow label="Total revenue" value={formatCurrency(selectedRep.totalRevenue)} />
                <DetailRow label="Total commission" value={formatCurrency(selectedRep.totalCommission)} highlight />
                <DetailRow label="Attainment" value={`${Math.round(selectedRep.attainment)}%`} />
                <DetailRow label="Deals closed" value={String(selectedRep.dealCount)} />
                <DetailRow label="Tier" value={selectedRep.quotaTier.tier_name} />
                <DetailRow label="Rate multiplier" value={`${selectedRep.quotaTier.rate_multiplier}x`} />
              </div>
            </div>
          )}
          {selectedRep && isEditing && (
            <EditRepForm
              rep={selectedRep}
              onCancel={() => setIsEditing(false)}
              onSaved={() => {
                setIsEditing(false);
                setSelectedRep(null);
              }}
            />
          )}
        </SheetContent>
      </Sheet>

      {/* Add rep dialog */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add rep</DialogTitle>
            <DialogDescription>Create a new sales representative</DialogDescription>
          </DialogHeader>
          <AddRepForm onSuccess={() => setIsAddOpen(false)} />
        </DialogContent>
      </Dialog>
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

function EditRepForm({ rep, onCancel, onSaved }: { rep: RepData; onCancel: () => void; onSaved: () => void }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(rep.name);
  const [email, setEmail] = useState(rep.email ?? "");
  const [team, setTeam] = useState(rep.team);
  const [quotaTarget, setQuotaTarget] = useState(String(rep.quota_target));
  const [quotaPeriod, setQuotaPeriod] = useState(rep.quota_period);

  const mutation = useMutation({
    mutationFn: () =>
      updateRep({
        data: {
          repId: rep.id,
          name,
          email: email || undefined,
          team,
          quotaTarget: parseFloat(quotaTarget),
          quotaPeriod: quotaPeriod as "month" | "quarter" | "year",
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reps"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["deals"] });
      toast.success("Rep updated successfully");
      onSaved();
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <div className="space-y-4 mt-6">
      <div className="space-y-2">
        <Label className="text-xs">Name</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} className="h-9 text-sm" />
      </div>
      <div className="space-y-2">
        <Label className="text-xs">Email</Label>
        <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="h-9 text-sm" />
      </div>
      <div className="space-y-2">
        <Label className="text-xs">Team</Label>
        <Input value={team} onChange={(e) => setTeam(e.target.value)} className="h-9 text-sm" />
      </div>
      <div className="space-y-2">
        <Label className="text-xs">Quota target ($)</Label>
        <Input type="number" value={quotaTarget} onChange={(e) => setQuotaTarget(e.target.value)} className="h-9 text-sm" min="0" />
      </div>
      <div className="space-y-2">
        <Label className="text-xs">Quota period</Label>
        <Select value={quotaPeriod} onValueChange={setQuotaPeriod}>
          <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="month">Month</SelectItem>
            <SelectItem value="quarter">Quarter</SelectItem>
            <SelectItem value="year">Year</SelectItem>
          </SelectContent>
        </Select>
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

function AddRepForm({ onSuccess }: { onSuccess: () => void }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [team, setTeam] = useState("");
  const [quotaTarget, setQuotaTarget] = useState("100000");
  const [quotaPeriod, setQuotaPeriod] = useState("quarter");

  const mutation = useMutation({
    mutationFn: () =>
      createRep({
        data: {
          name,
          email: email || undefined,
          team: team || undefined,
          quotaTarget: parseFloat(quotaTarget) || 100000,
          quotaPeriod: quotaPeriod as "month" | "quarter" | "year",
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reps"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Rep created successfully");
      onSuccess();
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <div className="space-y-4 mt-2">
      <div className="space-y-2">
        <Label className="text-xs">Name</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} className="h-9 text-sm" placeholder="Full name" required />
      </div>
      <div className="space-y-2">
        <Label className="text-xs">Email</Label>
        <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="h-9 text-sm" placeholder="rep@company.com" />
      </div>
      <div className="space-y-2">
        <Label className="text-xs">Team</Label>
        <Input value={team} onChange={(e) => setTeam(e.target.value)} className="h-9 text-sm" placeholder="e.g. Enterprise" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label className="text-xs">Quota target ($)</Label>
          <Input type="number" value={quotaTarget} onChange={(e) => setQuotaTarget(e.target.value)} className="h-9 text-sm" min="0" />
        </div>
        <div className="space-y-2">
          <Label className="text-xs">Quota period</Label>
          <Select value={quotaPeriod} onValueChange={setQuotaPeriod}>
            <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="month">Month</SelectItem>
              <SelectItem value="quarter">Quarter</SelectItem>
              <SelectItem value="year">Year</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button size="sm" onClick={() => mutation.mutate()} disabled={mutation.isPending || !name.trim()}>
          {mutation.isPending ? "Creating..." : "Create rep"}
        </Button>
      </div>
    </div>
  );
}