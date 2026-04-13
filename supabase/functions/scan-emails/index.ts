import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const NYLAS_API = "https://api.us.nylas.com/v3";

// Only these file types can be accounting documents
const ACCOUNTING_CONTENT_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/tiff",
];

const ACCOUNTING_EXTENSIONS = [".pdf", ".jpg", ".jpeg", ".png", ".tiff"];

// Filenames that are almost certainly NOT accounting documents
const JUNK_FILENAME_PATTERNS = [
  /^image\d*\.\w+$/i,           // image.png, image001.png
  /^photo\d*\.\w+$/i,           // photo.png
  /^img[-_]?\d*\.\w+$/i,        // img_001.png
  /^logo\.\w+$/i,               // logo.png
  /^banner\.\w+$/i,             // banner.png
  /^signature\.\w+$/i,          // signature.png
  /^header\.\w+$/i,             // header.png
  /^footer\.\w+$/i,             // footer.png
  /^icon\.\w+$/i,               // icon.png
  /^avatar\.\w+$/i,             // avatar.png
  /^screenshot/i,               // screenshot*, Zrzut ekranu*
  /^zrzut/i,                    // Zrzut ekranu (Polish for screenshot)
  /^snímka/i,                   // Snímka obrazovky (SK for screenshot)
  /^capture/i,                  // Screen capture
  /^popis/i,                    // "popis" = description (marketing images)
  /^kreativ/i,                  // "kreativa" = creative assets
  /^citatel/i,                  // "citatelne" = readability tests
  /^text.cez/i,                 // "text cez produkt" = text over product
  /^produkt/i,                  // product images
  /^cover/i,                    // cover images
  /^thumbnail/i,                // thumbnails
  /^preview/i,                  // preview images
];

// Subject keywords that indicate accounting-relevant emails
const ACCOUNTING_SUBJECT_KEYWORDS = [
  "faktúra", "faktura", "invoice",
  "dobropis", "credit note",
  "účtenka", "účet", "uctenka", "ucet", "receipt",
  "platba", "payment",
  "objednávka", "objednavka", "order",
  "zmluva", "contract",
  "výpis", "vypis", "statement",
  "daň", "dan", "tax",
  "dph", "vat",
  "poistenie", "insurance",
  "nájom", "najom", "rent",
  "mzda", "salary", "payroll",
  "výplata", "vyplata",
  "avízo", "avizo",
  "upomienka", "reminder",
  "penále", "penale", "penalty",
  "zálohová", "zalohova", "advance",
  "proforma",
];

// Filename keywords that suggest accounting documents
const ACCOUNTING_FILENAME_KEYWORDS = [
  "faktur", "invoice", "inv",
  "dobropis", "credit",
  "ucten", "receipt",
  "vypis", "statement",
  "zmluv", "contract",
  "dph", "vat",
  "poistk", "insur",
  "najom", "rent",
  "mzd", "payroll", "salary",
  "proforma",
  "avizo",
  "upomienk",
  "potvrd", "confirm",
  "dan", "tax",
];

function isJunkFilename(filename: string): boolean {
  if (!filename) return true;
  return JUNK_FILENAME_PATTERNS.some((p) => p.test(filename));
}

function isAccountingRelevantFilename(filename: string): boolean {
  if (!filename) return false;
  const lower = filename.toLowerCase();
  return ACCOUNTING_FILENAME_KEYWORDS.some((kw) => lower.includes(kw));
}

function isAccountingRelevantSubject(subject: string): boolean {
  if (!subject) return false;
  const lower = subject.toLowerCase();
  return ACCOUNTING_SUBJECT_KEYWORDS.some((kw) => lower.includes(kw));
}

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
    let skippedCount = 0;

    for (const msg of messagesToProcess) {
      if (!msg.attachments || msg.attachments.length === 0) continue;

      const subjectRelevant = isAccountingRelevantSubject(msg.subject || "");

      for (const att of msg.attachments) {
        const filename = att.filename || "";

        // 1. Skip inline images (email signatures, logos embedded in HTML)
        if (att.content_disposition === "inline") {
          console.log(`Skipped inline: ${filename}`);
          skippedCount++;
          continue;
        }

        // 2. Filter by content type or extension
        const isRelevantType = ACCOUNTING_CONTENT_TYPES.some((t) => att.content_type?.includes(t));
        const isRelevantExt = ACCOUNTING_EXTENSIONS.some((ext) => filename.toLowerCase().endsWith(ext));
        if (!isRelevantType && !isRelevantExt) {
          console.log(`Skipped non-doc type: ${filename} (${att.content_type})`);
          skippedCount++;
          continue;
        }

        // 3. Skip tiny files (< 10KB — likely icons, signatures, tracking pixels)
        if (att.size && att.size < 10000) {
          console.log(`Skipped tiny file: ${filename} (${att.size} bytes)`);
          skippedCount++;
          continue;
        }

        // 4. Skip known junk filenames
        if (isJunkFilename(filename)) {
          console.log(`Skipped junk filename: ${filename}`);
          skippedCount++;
          continue;
        }

        // 5. For images (non-PDF), require either accounting-relevant filename OR subject
        const isPdf = filename.toLowerCase().endsWith(".pdf") || att.content_type?.includes("pdf");
        if (!isPdf) {
          const filenameRelevant = isAccountingRelevantFilename(filename);
          if (!filenameRelevant && !subjectRelevant) {
            console.log(`Skipped non-accounting image: ${filename} (subject: ${msg.subject})`);
            skippedCount++;
            continue;
          }
        }

        // PDFs are almost always accounting documents, so we accept all PDFs that pass basic checks

        // Check for duplicates; on refresh retry failed extractions instead of skipping silently
        const sourceEmailId = `nylas:${msg.id}:${att.id}`;
        const { data: existing } = await supabase
          .from("documents")
          .select("id, status")
          .eq("source_email_id", sourceEmailId)
          .limit(1);

        if (existing && existing.length > 0) {
          const existingDoc = existing[0];
          if (existingDoc.status === "error") {
            const anonKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY");
            if (anonKey) {
              fetch(`${supabaseUrl}/functions/v1/extract-document`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${anonKey}`,
                },
                body: JSON.stringify({ documentId: existingDoc.id }),
              }).catch((err) => console.error("Failed to retry extraction:", err));
              processedCount++;
            }
          }
          continue;
        }

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
        const ext = filename.split(".").pop() || "pdf";
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
            file_name: filename || `email_attachment.${ext}`,
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
        console.log(`Processed: ${filename} from "${msg.subject || "no subject"}"`);
      }
    }

    console.log(`Done: processed=${processedCount}, skipped=${skippedCount}`);

    // Update last_sync_at
    await supabase
      .from("email_integrations")
      .update({ last_sync_at: new Date().toISOString() })
      .eq("nylas_grant_id", grantId);

    return new Response(
      JSON.stringify({ success: true, processed: processedCount, skipped: skippedCount }),
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
