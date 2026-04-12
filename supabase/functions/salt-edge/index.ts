import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.1";

const SALT_EDGE_BASE = "https://www.saltedge.com/api/v6";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

async function saltEdgeFetch(path: string, method: string, body?: unknown) {
  const appId = Deno.env.get("SALT_EDGE_APP_ID");
  const secret = Deno.env.get("SALT_EDGE_SECRET");
  if (!appId || !secret) throw new Error("Salt Edge credentials not configured");

  const res = await fetch(`${SALT_EDGE_BASE}${path}`, {
    method,
    headers: {
      "Accept": "application/json",
      "Content-Type": "application/json",
      "App-id": appId,
      "Secret": secret,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json();
  if (!res.ok) {
    console.error("Salt Edge error:", JSON.stringify(data));
    throw new Error(data?.error?.message || `Salt Edge API error ${res.status}`);
  }
  return data;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { action, ...params } = await req.json();

    switch (action) {
      // 1. Create Salt Edge customer for a client
      case "create_customer": {
        const { clientId } = params;
        const result = await saltEdgeFetch("/customers", "POST", {
          data: { identifier: clientId },
        });
        return Response.json({ data: result.data }, { headers: corsHeaders });
      }

      // 2. Create connect session (returns URL for bank auth widget)
      case "create_connect_session": {
        const { customerId, returnUrl } = params;
        const result = await saltEdgeFetch("/connect_sessions/create", "POST", {
          data: {
            customer_id: customerId,
            consent: {
              scopes: ["account_details", "transactions_details"],
              from_date: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
            },
            attempt: {
              return_to: returnUrl,
            },
            allowed_countries: ["SK", "CZ"],
          },
        });
        return Response.json({ data: result.data }, { headers: corsHeaders });
      }

      // 3. Fetch connection details (after callback)
      case "get_connection": {
        const { connectionId } = params;
        const result = await saltEdgeFetch(`/connections/${connectionId}`, "GET");
        return Response.json({ data: result.data }, { headers: corsHeaders });
      }

      // 4. Refresh connection (trigger new data fetch)
      case "refresh_connection": {
        const { connectionId } = params;
        const result = await saltEdgeFetch("/connect_sessions/refresh", "POST", {
          data: {
            connection_id: connectionId,
            attempt: { fetch_scopes: ["transactions"] },
          },
        });
        return Response.json({ data: result.data }, { headers: corsHeaders });
      }

      // 5. Fetch transactions and save to DB
      case "fetch_transactions": {
        const { connectionId, clientId, officeId, accountId } = params;

        // Get last sync date
        const { data: integration } = await supabase
          .from("bank_integrations")
          .select("last_sync_at")
          .eq("salt_edge_connection_id", connectionId)
          .single();

        const fromDate = integration?.last_sync_at
          ? new Date(integration.last_sync_at).toISOString().split("T")[0]
          : new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

        let allTransactions: any[] = [];
        let nextId: string | undefined;

        // Paginate through transactions
        do {
          const query = new URLSearchParams({
            connection_id: connectionId,
            from_date: fromDate,
            ...(accountId ? { account_id: accountId } : {}),
            ...(nextId ? { from_id: nextId } : {}),
          });

          const result = await saltEdgeFetch(`/transactions?${query}`, "GET");
          allTransactions = allTransactions.concat(result.data || []);
          nextId = result.meta?.next_id;
        } while (nextId);

        console.log(`Fetched ${allTransactions.length} transactions for connection ${connectionId}`);

        if (allTransactions.length > 0) {
          const rows = allTransactions.map((tx: any) => ({
            external_id: String(tx.id),
            client_id: clientId,
            office_id: officeId,
            amount: tx.amount,
            currency: tx.currency_code || "EUR",
            description: tx.description || null,
            transaction_date: tx.made_on,
            counterparty_name: tx.extra?.payee || tx.extra?.payer || null,
            variable_symbol: tx.extra?.variable_code || null,
            bank_name: tx.extra?.account_bank_name || null,
          }));

          // Upsert to avoid duplicates
          const { error } = await supabase
            .from("bank_transactions")
            .upsert(rows, { onConflict: "external_id" });

          if (error) {
            console.error("Insert transactions error:", error);
            throw new Error(error.message);
          }

          // Auto-match: match by variable_symbol
          for (const tx of rows) {
            if (tx.variable_symbol) {
              const { data: docs } = await supabase
                .from("documents")
                .select("id, total_amount")
                .eq("client_id", clientId)
                .eq("variable_symbol", tx.variable_symbol)
                .is("matched_transaction_id", null)
                .limit(1);

              if (docs && docs.length > 0) {
                const doc = docs[0];
                // Match if amounts are close (within 1 EUR)
                if (doc.total_amount && Math.abs(Number(doc.total_amount) - Math.abs(tx.amount)) < 1) {
                  // Get the transaction id from DB
                  const { data: savedTx } = await supabase
                    .from("bank_transactions")
                    .select("id")
                    .eq("external_id", tx.external_id)
                    .single();

                  if (savedTx) {
                    await supabase.from("documents").update({ matched_transaction_id: savedTx.id }).eq("id", doc.id);
                    await supabase.from("bank_transactions").update({ matched_document_id: doc.id }).eq("id", savedTx.id);
                  }
                }
              }
            }
          }
        }

        // Update last_sync_at
        await supabase
          .from("bank_integrations")
          .update({ last_sync_at: new Date().toISOString(), status: "connected" })
          .eq("salt_edge_connection_id", connectionId);

        return Response.json(
          { data: { synced: allTransactions.length } },
          { headers: corsHeaders }
        );
      }

      default:
        return Response.json({ error: "Unknown action" }, { status: 400, headers: corsHeaders });
    }
  } catch (error: any) {
    console.error("Salt Edge function error:", error);
    return Response.json(
      { error: error.message || "Internal error" },
      { status: 500, headers: corsHeaders }
    );
  }
});
