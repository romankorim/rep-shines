import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getDashboardStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const { data: offices } = await supabase
      .from("accountant_offices")
      .select("id")
      .eq("user_id", userId)
      .limit(1);

    const officeId = offices?.[0]?.id;
    if (!officeId) return { totalClients: 0, docsThisMonth: 0, pendingApproval: 0, pendingConnection: 0 };

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const [clientsRes, docsRes, pendingRes] = await Promise.all([
      supabase.from("clients").select("id, status", { count: "exact" }).eq("office_id", officeId),
      supabase.from("documents").select("*", { count: "exact", head: true }).eq("office_id", officeId).gte("created_at", startOfMonth),
      supabase.from("documents").select("*", { count: "exact", head: true }).eq("office_id", officeId).eq("status", "pending_approval"),
    ]);

    const clients = clientsRes.data ?? [];
    const pendingConnection = clients.filter((c) => c.status === "invited").length;

    return {
      totalClients: clients.length,
      docsThisMonth: docsRes.count ?? 0,
      pendingApproval: pendingRes.count ?? 0,
      pendingConnection,
    };
  });
