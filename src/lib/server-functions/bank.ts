import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

async function callSaltEdge(supabaseUrl: string, anonKey: string, action: string, params: Record<string, unknown>) {
  const res = await fetch(`${supabaseUrl}/functions/v1/salt-edge`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${anonKey}`,
    },
    body: JSON.stringify({ action, ...params }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || "Salt Edge call failed");
  return data;
}

// Initiate bank connection for a client
export const initBankConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ clientId: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL!;
    const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY!;

    // Get office for this client
    const { data: client } = await supabase
      .from("clients")
      .select("office_id")
      .eq("id", data.clientId)
      .single();

    if (!client) throw new Error("Client not found");

    // 1. Create Salt Edge customer
    const customerResult = await callSaltEdge(supabaseUrl, anonKey, "create_customer", {
      clientId: data.clientId,
    });
    const customerId = customerResult.data.id;

    // 2. Create connect session
    const returnUrl = `${import.meta.env.VITE_SUPABASE_URL ? "" : ""}${typeof globalThis !== "undefined" ? "" : ""}/clients/${data.clientId}?bank_connected=true`;
    const connectResult = await callSaltEdge(supabaseUrl, anonKey, "create_connect_session", {
      customerId: String(customerId),
      returnUrl: `https://id-preview--e35fe031-9c7f-4f24-ac03-1474b0aafb32.lovable.app/clients/${data.clientId}?bank_connected=true`,
    });

    // 3. Create/update bank_integrations record
    const { data: existing } = await supabase
      .from("bank_integrations")
      .select("id")
      .eq("client_id", data.clientId)
      .limit(1);

    if (!existing || existing.length === 0) {
      await supabase.from("bank_integrations").insert({
        client_id: data.clientId,
        office_id: client.office_id,
        provider: "salt_edge",
        status: "disconnected",
      });
    }

    return { connectUrl: connectResult.data.connect_url };
  });

// Complete bank connection after callback
export const completeBankConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({
    clientId: z.string().uuid(),
    connectionId: z.string().min(1).max(100),
  }))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL!;
    const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY!;

    // Get connection details from Salt Edge
    const connResult = await callSaltEdge(supabaseUrl, anonKey, "get_connection", {
      connectionId: data.connectionId,
    });

    const conn = connResult.data;

    // Update bank_integrations
    await supabase
      .from("bank_integrations")
      .update({
        salt_edge_connection_id: data.connectionId,
        bank_name: conn.provider_name || "Neznáma banka",
        status: "connected",
        consent_expires_at: conn.consent?.expires_at || null,
      })
      .eq("client_id", data.clientId);

    return { success: true, bankName: conn.provider_name };
  });

// Sync bank transactions
export const syncBankTransactions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ clientId: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL!;
    const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY!;

    // Get bank integration
    const { data: integration } = await supabase
      .from("bank_integrations")
      .select("*")
      .eq("client_id", data.clientId)
      .eq("status", "connected")
      .single();

    if (!integration?.salt_edge_connection_id) {
      throw new Error("No connected bank integration found");
    }

    // Get client's office_id
    const { data: client } = await supabase
      .from("clients")
      .select("office_id")
      .eq("id", data.clientId)
      .single();

    if (!client) throw new Error("Client not found");

    const result = await callSaltEdge(supabaseUrl, anonKey, "fetch_transactions", {
      connectionId: integration.salt_edge_connection_id,
      clientId: data.clientId,
      officeId: client.office_id,
    });

    return { synced: result.data?.synced || 0 };
  });
