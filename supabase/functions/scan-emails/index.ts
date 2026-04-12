import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const NYLAS_API = "https://api.us.nylas.com/v3";

// File types we consider as potential invoices/receipts
const INVOICE_CONTENT_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/heic",
  "image/tiff",
];

const INVOICE_EXTENSIONS = [".pdf", ".jpg", ".jpeg", ".png", ".heic", ".tiff"];

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { grantId, clientId, officeId, messageId } = await req.json();
    if (!grantId || !clientId || !officeId) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const nylasApiKey = Deno.env.get("NYLAS_API_KEY")!;
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    let messagesToProcess: any[] = [];

    if (messageId) {
      // Process specific message from webhook
      const msgResp = await fetch(`${NYLAS_API}/grants/${grantId}/messages/${messageId}`, {
        headers: { Authorization: `Bearer ${nylasApiKey}`, Accept: "application/json" },
      });
      if (msgResp.ok) {
        const msgData = await msgResp.json();
        messagesToProcess = [msgData.data];
      }
    } else {
      // Initial scan - get recent messages with attachments
      const params = new URLSearchParams({
        has_attachment: "true",
        limit: "50",
        fields: "id,subject,from,date,attachments",
      });

      const listResp = await fetch(`${NYLAS_API}/grants/${grantId}/messages?${params}`, {
        headers: { Authorization: `Bearer ${nylasApiKey}`, Accept: "application/json" },
      });

      if (!listResp.ok) {
        const errText = await listResp.text();
        console.error("Nylas list messages failed:", listResp.status, errText);
        throw new Error(`Nylas API error: ${listResp.status}`);
      }

      const listData = await listResp.json();
      messagesToProcess = listData.data || [];
    }

    console.log(`Processing ${messagesToProcess.length} messages for client ${clientId}`);
    let processedCount = 0;

    for (const msg of messagesToProcess) {
      if (!msg.attachments || msg.attachments.length === 0) continue;

      for (const att of msg.attachments) {
        // Filter by content type or extension
        const isRelevantType = INVOICE_CONTENT_TYPES.some((t) => att.content_type?.includes(t));
        const isRelevantExt = INVOICE_EXTENSIONS.some((ext) =>
          att.filename?.toLowerCase().endsWith(ext)
        );

        if (!isRelevantType && !isRelevantExt) continue;

        // Skip tiny files (< 5KB, likely icons/signatures)
        if (att.size && att.size < 5000) continue;

        // Check for duplicates by source_email_id
        const sourceEmailId = `nylas:${msg.id}:${att.id}`;
        const { data: existing } = await supabase
          .from("documents")
          .select("id")
          .eq("source_email_id", sourceEmailId)
          .limit(1);

        if (existing && existing.length > 0) continue;

        // Download attachment from Nylas
        const dlResp = await fetch(
          `${NYLAS_API}/grants/${grantId}/attachments/${att.id}/download?message_id=${msg.id}`,
          { headers: { Authorization: `Bearer ${nylasApiKey}` } }
        );

        if (!dlResp.ok) {
          console.error(`Failed to download attachment ${att.id}:`, dlResp.status);
          continue;
        }

        const fileBuffer = await dlResp.arrayBuffer();
        const fileBytes = new Uint8Array(fileBuffer);

        // Upload to Supabase storage
        const ext = att.filename?.split(".").pop() || "pdf";
        const storagePath = `${clientId}/${Date.now()}_email_${Math.random().toString(36).slice(2)}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from("documents")
          .upload(storagePath, fileBytes, {
            contentType: att.content_type || "application/pdf",
          });

        if (uploadError) {
          console.error("Storage upload failed:", uploadError);
          continue;
        }

        const { data: urlData } = supabase.storage.from("documents").getPublicUrl(storagePath);

        // Create document record
        const { data: doc, error: insertError } = await supabase
          .from("documents")
          .insert({
            client_id: clientId,
            office_id: officeId,
            file_name: att.filename || `email_attachment.${ext}`,
            file_size: att.size || fileBytes.length,
            file_type: att.content_type || "application/pdf",
            file_url: urlData.publicUrl,
            source: "email",
            source_email_id: sourceEmailId,
            status: "processing",
          })
          .select()
          .single();

        if (insertError) {
          console.error("Document insert failed:", insertError);
          continue;
        }

        // Trigger AI extraction
        if (doc) {
          const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
          const anonKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY");
          if (anonKey) {
            fetch(`${supabaseUrl}/functions/v1/extract-document`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${anonKey}`,
              },
              body: JSON.stringify({ documentId: doc.id }),
            }).catch((err) => console.error("Failed to trigger extraction:", err));
          }
        }

        processedCount++;
        console.log(`Processed: ${att.filename} from ${msg.subject || "no subject"}`);
      }
    }

    // Update last_sync_at
    await supabase
      .from("email_integrations")
      .update({ last_sync_at: new Date().toISOString() })
      .eq("nylas_grant_id", grantId);

    return new Response(
      JSON.stringify({ success: true, processed: processedCount }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("scan-emails error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
