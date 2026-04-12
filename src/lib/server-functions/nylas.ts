import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

// Generate Nylas OAuth connect URL for a client
export const getNylasConnectUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ clientId: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const clientId = process.env.NYLAS_CLIENT_ID;
    if (!clientId) throw new Error("NYLAS_CLIENT_ID not configured");

    const appUrl = process.env.APP_URL || import.meta.env.VITE_SUPABASE_URL?.replace("supabase.co", "lovable.app") || "https://localhost:3000";
    const callbackUri = `${appUrl}/api/nylas/callback`;

    const authUrl = new URL("https://api.us.nylas.com/v3/connect/auth");
    authUrl.searchParams.set("client_id", clientId);
    authUrl.searchParams.set("redirect_uri", callbackUri);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("access_type", "offline");
    authUrl.searchParams.set("state", data.clientId);
    authUrl.searchParams.set("scope", "https://www.googleapis.com/auth/gmail.readonly,https://graph.microsoft.com/Mail.Read");

    return { url: authUrl.toString() };
  });

// Exchange Nylas OAuth code for grant
export const exchangeNylasCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({
    code: z.string().min(1).max(2000),
    clientId: z.string().uuid(),
  }))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const nylasClientId = process.env.NYLAS_CLIENT_ID;
    const nylasApiKey = process.env.NYLAS_API_KEY;
    if (!nylasClientId || !nylasApiKey) throw new Error("Nylas not configured");

    const appUrl = process.env.APP_URL || "https://localhost:3000";

    const tokenResp = await fetch("https://api.us.nylas.com/v3/connect/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${nylasApiKey}`,
      },
      body: JSON.stringify({
        client_id: nylasClientId,
        code: data.code,
        redirect_uri: `${appUrl}/api/nylas/callback`,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenResp.ok) {
      const err = await tokenResp.text();
      console.error("Nylas token exchange failed:", err);
      throw new Error("Failed to connect email account");
    }

    const tokenData = await tokenResp.json();
    const grantId = tokenData.grant_id;
    const email = tokenData.email;

    if (!grantId) throw new Error("No grant_id returned from Nylas");

    const { data: client } = await supabase
      .from("clients")
      .select("office_id")
      .eq("id", data.clientId)
      .single();

    if (!client) throw new Error("Client not found");

    const { error: upsertError } = await supabase
      .from("email_integrations")
      .upsert(
        {
          client_id: data.clientId,
          office_id: client.office_id,
          nylas_grant_id: grantId,
          email_address: email || null,
          provider: tokenData.provider || "unknown",
          status: "connected",
          last_sync_at: null,
        },
        { onConflict: "client_id,office_id" }
      );

    if (upsertError) {
      await supabase.from("email_integrations").insert({
        client_id: data.clientId,
        office_id: client.office_id,
        nylas_grant_id: grantId,
        email_address: email || null,
        provider: tokenData.provider || "unknown",
        status: "connected",
      });
    }

    // Trigger initial scan
    const supabaseUrl = process.env.SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL;
    const anonKey = process.env.SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    if (supabaseUrl && anonKey) {
      fetch(`${supabaseUrl}/functions/v1/scan-emails`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${anonKey}`,
        },
        body: JSON.stringify({ grantId, clientId: data.clientId, officeId: client.office_id }),
      }).catch((err) => console.error("Failed to trigger initial scan:", err));
    }

    return { success: true, email };
  });

// Trigger manual email scan for a specific client
export const triggerEmailScan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ clientId: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const { data: integration } = await supabase
      .from("email_integrations")
      .select("nylas_grant_id, office_id")
      .eq("client_id", data.clientId)
      .eq("status", "connected")
      .single();

    if (!integration?.nylas_grant_id) {
      throw new Error("No connected email integration for this client");
    }

    const supabaseUrl = process.env.SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL;
    const anonKey = process.env.SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

    if (!supabaseUrl || !anonKey) throw new Error("Supabase not configured");

    const resp = await fetch(`${supabaseUrl}/functions/v1/scan-emails`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${anonKey}`,
      },
      body: JSON.stringify({
        grantId: integration.nylas_grant_id,
        clientId: data.clientId,
        officeId: integration.office_id,
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      console.error("Scan failed:", errText);
      throw new Error("Email scan failed");
    }

    const result = await resp.json();
    return { success: true, processed: result.processed || 0 };
  });

// Disconnect email integration
export const disconnectEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ clientId: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const { error } = await supabase
      .from("email_integrations")
      .update({ status: "disconnected", nylas_grant_id: null })
      .eq("client_id", data.clientId);

    if (error) throw new Error(error.message);
    return { success: true };
  });
