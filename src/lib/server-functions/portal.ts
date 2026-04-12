import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getPortalStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const { data: clientRecord } = await supabase
      .from("clients")
      .select("id, office_id")
      .eq("user_id", userId)
      .limit(1);

    const client = clientRecord?.[0];
    if (!client) return { clientId: null, officeId: null, totalDocs: 0, approvedDocs: 0, unmatchedTx: 0 };

    const [docsRes, approvedRes, txRes] = await Promise.all([
      supabase.from("documents").select("*", { count: "exact", head: true }).eq("client_id", client.id),
      supabase.from("documents").select("*", { count: "exact", head: true }).eq("client_id", client.id).eq("status", "approved"),
      supabase.from("bank_transactions").select("*", { count: "exact", head: true }).eq("client_id", client.id).is("matched_document_id", null),
    ]);

    return {
      clientId: client.id,
      officeId: client.office_id,
      totalDocs: docsRes.count ?? 0,
      approvedDocs: approvedRes.count ?? 0,
      unmatchedTx: txRes.count ?? 0,
    };
  });

export const getPortalDocuments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const { data: clientRecord } = await supabase
      .from("clients")
      .select("id")
      .eq("user_id", userId)
      .limit(1);

    const clientId = clientRecord?.[0]?.id;
    if (!clientId) return [];

    const { data, error } = await supabase
      .from("documents")
      .select("*")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);
    return data ?? [];
  });
