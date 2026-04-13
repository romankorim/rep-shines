import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import dns from "node:dns";

// Detect email provider via MX records (server-side DNS lookup)
export const detectEmailProvider = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ email: z.string().email() }))
  .handler(async ({ data }) => {
    const domain = data.email.split("@")[1]?.toLowerCase();
    if (!domain) return { provider: "imap" as const };

    // Quick domain check first
    const knownGoogle = ["gmail.com", "googlemail.com"];
    const knownMicrosoft = ["outlook.com", "hotmail.com", "live.com", "msn.com", "outlook.sk", "outlook.cz"];

    if (knownGoogle.includes(domain)) return { provider: "google" as const, confidence: "domain" };
    if (knownMicrosoft.includes(domain) || domain.endsWith(".onmicrosoft.com")) return { provider: "microsoft" as const, confidence: "domain" };

    // For custom domains, check MX records
    try {
      const mxRecords = await new Promise<dns.MxRecord[]>((resolve, reject) => {
        dns.resolveMx(domain, (err, addresses) => {
          if (err) reject(err);
          else resolve(addresses || []);
        });
      });

      const mxHosts = mxRecords.map(r => r.exchange.toLowerCase());
      const mxString = mxHosts.join(" ");

      // Google Workspace MX records contain google.com or googlemail.com
      if (mxString.includes("google.com") || mxString.includes("googlemail.com") || mxString.includes("smtp.google.com")) {
        return { provider: "google" as const, confidence: "mx" };
      }

      // Microsoft 365 MX records contain outlook.com or protection.outlook.com
      if (mxString.includes("outlook.com") || mxString.includes("protection.outlook.com") || mxString.includes("mail.protection.outlook")) {
        return { provider: "microsoft" as const, confidence: "mx" };
      }

      return { provider: "imap" as const, confidence: "mx" };
    } catch {
      // DNS lookup failed, fallback to IMAP
      return { provider: "imap" as const, confidence: "fallback" };
    }
  });

// Generate Nylas OAuth connect URL for a client
export const getNylasConnectUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({
    clientId: z.string().uuid(),
    provider: z.enum(["google", "microsoft", "imap"]).optional(),
    loginHint: z.string().email().optional(),
  }))
  .handler(async ({ data, context }) => {
    const clientId = process.env.NYLAS_CLIENT_ID;
    if (!clientId) throw new Error("NYLAS_CLIENT_ID not configured");

    const appUrl = process.env.APP_URL || `https://id-preview--e35fe031-9c7f-4f24-ac03-1474b0aafb32.lovable.app`;
    const callbackUri = `${appUrl}/api/nylas/callback`;

    const authUrl = new URL("https://api.us.nylas.com/v3/connect/auth");
    authUrl.searchParams.set("client_id", clientId);
    authUrl.searchParams.set("redirect_uri", callbackUri);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("access_type", "offline");
    authUrl.searchParams.set("state", data.clientId);

    // Minimal scopes - only email reading and attachments
    if (data.provider === "google") {
      authUrl.searchParams.set("provider", "google");
      authUrl.searchParams.set("scope", "https://www.googleapis.com/auth/gmail.readonly");
      if (data.loginHint) authUrl.searchParams.set("login_hint", data.loginHint);
    } else if (data.provider === "microsoft") {
      authUrl.searchParams.set("provider", "microsoft");
      authUrl.searchParams.set("scope", "https://graph.microsoft.com/Mail.Read");
      if (data.loginHint) authUrl.searchParams.set("login_hint", data.loginHint);
    } else {
      // IMAP - Nylas handles IMAP natively
      authUrl.searchParams.set("provider", "imap");
      if (data.loginHint) authUrl.searchParams.set("login_hint", data.loginHint);
    }

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

    const appUrl = process.env.APP_URL || `https://id-preview--e35fe031-9c7f-4f24-ac03-1474b0aafb32.lovable.app`;

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
