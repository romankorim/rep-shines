import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const getPortalStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    // First check if user is a client
    const { data: clientRecord } = await supabase
      .from("clients")
      .select("id, office_id")
      .eq("user_id", userId)
      .limit(1);

    const client = clientRecord?.[0];

    // If no client record, check if user is an accountant (has an office)
    if (!client) {
      const { data: office } = await supabase
        .from("accountant_offices")
        .select("id")
        .eq("user_id", userId)
        .limit(1);

      return {
        clientId: null,
        officeId: office?.[0]?.id ?? null,
        isAccountant: !!office?.[0],
        totalDocs: 0,
        approvedDocs: 0,
        unmatchedTx: 0,
        emailConnected: false,
        bankConnected: false,
      };
    }

    const [docsRes, approvedRes, txRes, emailRes, bankRes] = await Promise.all([
      supabase.from("documents").select("*", { count: "exact", head: true }).eq("client_id", client.id),
      supabase.from("documents").select("*", { count: "exact", head: true }).eq("client_id", client.id).eq("status", "approved"),
      supabase.from("bank_transactions").select("*", { count: "exact", head: true }).eq("client_id", client.id).is("matched_document_id", null),
      supabase.from("email_integrations").select("id").eq("client_id", client.id).eq("status", "connected").limit(1),
      supabase.from("bank_integrations").select("id").eq("client_id", client.id).eq("status", "connected").limit(1),
    ]);

    return {
      clientId: client.id,
      officeId: client.office_id,
      isAccountant: false,
      totalDocs: docsRes.count ?? 0,
      approvedDocs: approvedRes.count ?? 0,
      unmatchedTx: txRes.count ?? 0,
      emailConnected: (emailRes.data?.length ?? 0) > 0,
      bankConnected: (bankRes.data?.length ?? 0) > 0,
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

export const getPortalDocumentsByMonth = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ year: z.number(), month: z.number().min(1).max(12) }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: clientRecord } = await supabase
      .from("clients")
      .select("id")
      .eq("user_id", userId)
      .limit(1);

    const clientId = clientRecord?.[0]?.id;
    if (!clientId) return [];

    const startDate = `${data.year}-${String(data.month).padStart(2, "0")}-01`;
    const nextMonth = data.month === 12 ? 1 : data.month + 1;
    const nextYear = data.month === 12 ? data.year + 1 : data.year;
    const endDate = `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`;

    const { data: docs, error } = await supabase
      .from("documents")
      .select("*")
      .eq("client_id", clientId)
      .gte("created_at", startDate)
      .lt("created_at", endDate)
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);
    return docs ?? [];
  });
