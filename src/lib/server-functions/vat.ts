import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const getVatOverview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ month: z.number().min(1).max(12), year: z.number() }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: offices } = await supabase
      .from("accountant_offices")
      .select("id")
      .eq("user_id", userId)
      .limit(1);

    const officeId = offices?.[0]?.id;
    if (!officeId) return { clients: [], complete: 0, pending: 0, none: 0 };

    const [clientsRes, docsRes] = await Promise.all([
      supabase.from("clients").select("*").eq("office_id", officeId).order("name"),
      supabase.from("documents").select("client_id, status").eq("office_id", officeId).eq("tax_period_month", data.month).eq("tax_period_year", data.year),
    ]);

    const clients = clientsRes.data ?? [];
    const docs = docsRes.data ?? [];

    const clientStats = clients.map((client) => {
      const clientDocs = docs.filter((d) => d.client_id === client.id);
      const total = clientDocs.length;
      const approved = clientDocs.filter((d) => d.status === "approved").length;
      const completeness = total > 0 ? Math.round((approved / total) * 100) : 0;
      const vatStatus = total === 0 ? "none" as const : approved === total ? "complete" as const : "pending" as const;
      return { ...client, total, approved, completeness, vatStatus };
    });

    return {
      clients: clientStats,
      complete: clientStats.filter((c) => c.vatStatus === "complete").length,
      pending: clientStats.filter((c) => c.vatStatus === "pending").length,
      none: clientStats.filter((c) => c.vatStatus === "none").length,
    };
  });
