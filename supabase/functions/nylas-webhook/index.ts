import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.1";
import { encode as hexEncode } from "https://deno.land/std@0.168.0/encoding/hex.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-nylas-signature",
};

// Verify Nylas webhook signature
async function verifySignature(body: string, signature: string, secret: string): Promise<boolean> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  const computed = new TextDecoder().decode(hexEncode(new Uint8Array(sig)));
  return computed === signature;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Handle Nylas webhook challenge
    const url = new URL(req.url);
    const challenge = url.searchParams.get("challenge");
    if (challenge && req.method === "GET") {
      return new Response(challenge, { status: 200, headers: { ...corsHeaders, "Content-Type": "text/plain" } });
    }

    const body = await req.text();
    const signature = req.headers.get("x-nylas-signature") || "";
    const webhookSecret = Deno.env.get("NYLAS_WEBHOOK_SECRET")!;

    // Verify signature (skip in dev if no secret)
    if (webhookSecret && signature) {
      const valid = await verifySignature(body, signature, webhookSecret);
      if (!valid) {
        console.error("Invalid Nylas webhook signature");
        return new Response("Unauthorized", { status: 401, headers: corsHeaders });
      }
    }

    const payload = JSON.parse(body);
    console.log("Nylas webhook received:", payload.type);

    // We care about message.created events
    if (payload.type !== "message.created") {
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const grantId = payload.data?.grant_id;
    if (!grantId) {
      console.log("No grant_id in webhook payload");
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find the email integration for this grant
    const { data: integration } = await supabase
      .from("email_integrations")
      .select("client_id, office_id")
      .eq("nylas_grant_id", grantId)
      .eq("status", "connected")
      .single();

    if (!integration) {
      console.log("No active integration for grant:", grantId);
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Trigger email scan for this grant
    const anonKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY")!;
    await fetch(`${supabaseUrl}/functions/v1/scan-emails`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${anonKey}`,
      },
      body: JSON.stringify({
        grantId,
        clientId: integration.client_id,
        officeId: integration.office_id,
        messageId: payload.data?.object?.id,
      }),
    });

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Nylas webhook error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
