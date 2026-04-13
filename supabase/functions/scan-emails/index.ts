import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const NYLAS_API = "https://api.us.nylas.com/v3";

// Absolute minimum filters — everything else goes to AI
const ALWAYS_SKIP_CONTENT_TYPES = [
  "application/zip", "application/x-zip",
  "video/", "audio/",
  "application/vnd.openxmlformats-officedocument.presentationml",
  "application/vnd.ms-powerpoint",
];

function normalizeMimeType(contentType?: string | null) {
  return contentType?.split(";")[0]?.trim().toLowerCase() || "application/octet-stream";
}

function arrayBufferToBase64(buffer: ArrayBuffer) {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

async function classifyAttachmentByContent(
  attachment: { filename: string; content_type: string; size: number; bytes: Uint8Array },
  emailSubject: string,
  emailFrom: string,
  lovableApiKey: string,
): Promise<{ relevant: boolean; reason: string; signal: "visual" | "metadata" | "fallback" }> {
  const normalizedMimeType = normalizeMimeType(attachment.content_type);
  const canInspectVisually = normalizedMimeType === "application/pdf" || normalizedMimeType.startsWith("image/");

  if (!canInspectVisually) {
    const metaResult = await classifyAttachmentWithAI(attachment, emailSubject, emailFrom, lovableApiKey);
    return { ...metaResult, signal: "metadata" };
  }

  const filePart = normalizedMimeType === "application/pdf"
    ? { type: "input_file", file_url: `data:application/pdf;base64,${arrayBufferToBase64(attachment.bytes.buffer)}` }
    : { type: "image_url", image_url: { url: `data:${normalizedMimeType};base64,${arrayBufferToBase64(attachment.bytes.buffer)}` } };

  const prompt = `Si spoľahlivý AI agent účtovníckej firmy. Tvoj cieľ je prísne odfiltrovať nerelevantné obrázky a ponechať len skutočné účtovné doklady.

Kontext e-mailu:
- Predmet: "${emailSubject || "(žiadny)"}"
- Odosielateľ: "${emailFrom || "(neznámy)"}"
- Súbor: "${attachment.filename || "(bez názvu)"}"
- Typ: "${normalizedMimeType}"

Najprv si vizuálne prezri obsah prílohy. Rozhodnutie rob podľa SKUTOČNÉHO OBSAHU dokumentu, nie podľa názvu súboru.

Za relevantný účtovný doklad považuj len dokument, ktorý reálne obsahuje fakturačné / účtovné údaje ako napríklad:
- dodávateľ / odberateľ / partner
- IČO / DIČ / IČ DPH
- číslo faktúry alebo variabilný symbol
- dátum vystavenia / dodania / splatnosti
- sumy, DPH, mena
- položky, rozpis, pokladničný blok, bankový výpis

Označ ako relevant=false ak je to:
- screenshot administrácie, nastavení, dashboardu, reklamy alebo webu
- screenshot Facebook/Meta/Business Manager, reklamných nástrojov, analytiky, správ účtov
- obrázok bez účtovných polí
- ilustrácia, logo, podpis, fotka obrazovky bez fakturačných údajov

Ak na obrázku nie sú jasne viditeľné účtovné polia alebo finančné údaje, výsledok musí byť relevant=false.

Vráť IBA JSON:
{"relevant": true/false, "reason": "stručné vysvetlenie", "document_hint": "invoice|receipt|statement|other|none"}`;

  try {
    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [{ role: "user", content: [{ type: "text", text: prompt }, filePart] }],
        response_format: { type: "json_object" },
      }),
    });

    if (!resp.ok) {
      const metaResult = await classifyAttachmentWithAI(attachment, emailSubject, emailFrom, lovableApiKey);
      return { ...metaResult, signal: "fallback" };
    }

    const result = await resp.json();
    const content = result.choices?.[0]?.message?.content;
    const parsed = JSON.parse(content || "{}");
    return {
      relevant: Boolean(parsed.relevant),
      reason: parsed.reason || "visual-classification",
      signal: "visual",
    };
  } catch {
    const metaResult = await classifyAttachmentWithAI(attachment, emailSubject, emailFrom, lovableApiKey);
    return { ...metaResult, signal: "fallback" };
  }
}

/**
 * Uses AI to classify whether an email attachment is likely an accounting document.
 * Returns { relevant: boolean, reason: string }
 */
async function classifyAttachmentWithAI(
  attachment: { filename: string; content_type: string; size: number },
  emailSubject: string,
  emailFrom: string,
  lovableApiKey: string,
): Promise<{ relevant: boolean; reason: string }> {
  const prompt = `Rozhodneš, či príloha e-mailu je účtovný doklad relevantný pre účtovníctvo (faktúra, účtenka, dobropis, výpis, zmluva, poistka, daňový doklad, mzdový doklad, avízo, upomienka, zálohová faktúra, proforma, dodací list, objednávka, potvrdenie platby, alebo iný finančný/účtovný dokument).

E-mail:
- Predmet: "${emailSubject || "(žiadny)"}"
- Odosielateľ: "${emailFrom || "(neznámy)"}"

Príloha:
- Názov súboru: "${attachment.filename || "(bez názvu)"}"
- Typ: "${attachment.content_type || "neznámy"}"
- Veľkosť: ${attachment.size || 0} bytes

Odpovedz IBA v JSON formáte:
{"relevant": true/false, "reason": "stručné vysvetlenie prečo áno/nie"}

Pravidlá:
- PDF prílohy sú TAKMER VŽDY relevantné (faktúry, zmluvy, výpisy) — označ ako relevant=true pokiaľ nemáš silný dôvod prečo nie (napr. prezentácia, návod, marketingový materiál)
- Obrázky môžu byť fotky účteniek, dokladov — ak názov alebo kontext naznačuje účtovníctvo, označ relevant=true
- Logá, podpisy, screenshoty, profilové obrázky, marketingové materiály → relevant=false
- Ak si nie si istý, radšej označ relevant=true (falošné pozitívy sú lepšie než vynechané doklady)
- Prezentácie (.pptx), videá, audio súbory → relevant=false`;

  try {
    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
      }),
    });

    if (!resp.ok) {
      console.error("AI classification failed:", resp.status);
      // On AI failure, default to accepting the attachment (better safe than sorry)
      return { relevant: true, reason: "AI classification unavailable, accepting by default" };
    }

    const result = await resp.json();
    const content = result.choices?.[0]?.message?.content;
    if (!content) {
      return { relevant: true, reason: "Empty AI response, accepting by default" };
    }

    const parsed = JSON.parse(content);
    return {
      relevant: Boolean(parsed.relevant),
      reason: parsed.reason || "no reason given",
    };
  } catch (e) {
    console.error("AI classify error:", e);
    return { relevant: true, reason: "AI error, accepting by default" };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { grantId, clientId, officeId, messageId, month, year } = await req.json();
    if (!grantId || !clientId || !officeId) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const nylasApiKey = Deno.env.get("NYLAS_API_KEY")!;
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY")!;
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
      let nextCursor: string | null = null;

      do {
        const params = new URLSearchParams({
          has_attachment: "true",
          limit: "50",
          fields: "id,subject,from,date,attachments",
        });

        if (month && year) {
          // Search ±1 month around the target accounting period
          const fromDate = new Date(Date.UTC(year, month - 2, 1, 0, 0, 0)); // 1 month before
          const toDate = new Date(Date.UTC(year, month + 1, 1, 0, 0, 0));   // 1 month after (exclusive)
          params.set("received_after", String(Math.floor(fromDate.getTime() / 1000)));
          params.set("received_before", String(Math.floor(toDate.getTime() / 1000)));
        } else {
          // Default: scan emails from the last 3 months
          const threeMonthsAgo = Math.floor((Date.now() - 3 * 30 * 24 * 60 * 60 * 1000) / 1000);
          params.set("received_after", String(threeMonthsAgo));
        }

        if (nextCursor) {
          params.set("page_token", nextCursor);
        }

        const listResp = await fetch(`${NYLAS_API}/grants/${grantId}/messages?${params}`, {
          headers: { Authorization: `Bearer ${nylasApiKey}`, Accept: "application/json" },
        });

        if (!listResp.ok) {
          const errText = await listResp.text();
          console.error("Nylas list messages failed:", listResp.status, errText);
          throw new Error(`Nylas API error: ${listResp.status}`);
        }

        const listData = await listResp.json();
        messagesToProcess.push(...(listData.data || []));
        nextCursor = listData.next_cursor || null;
      } while (nextCursor);
    }

    console.log(`Processing ${messagesToProcess.length} messages for client ${clientId}`);
    let processedCount = 0;
    let skippedCount = 0;

    // Collect all candidate attachments across all messages first
    type CandidateAttachment = {
      msg: any;
      att: any;
      emailSubject: string;
      emailFrom: string;
      isPdf: boolean;
    };
    const allCandidates: CandidateAttachment[] = [];

    for (const msg of messagesToProcess) {
      if (!msg.attachments || msg.attachments.length === 0) continue;

      const emailSubject = msg.subject || "";
      const emailFrom = msg.from?.[0]?.email || msg.from?.[0]?.name || "";

      for (const att of msg.attachments) {
        const filename = att.filename || "";
        const contentType = normalizeMimeType(att.content_type);

        if (att.content_disposition === "inline") { skippedCount++; continue; }
        if (ALWAYS_SKIP_CONTENT_TYPES.some((t) => contentType.includes(t))) { skippedCount++; continue; }
        if (att.size && att.size < 3000) { skippedCount++; continue; }

        const isPdf = contentType === "application/pdf";
        allCandidates.push({ msg, att, emailSubject, emailFrom, isPdf });
      }
    }

    // Sort: PDFs first (they're most likely invoices and don't need vision AI)
    allCandidates.sort((a, b) => (b.isPdf ? 1 : 0) - (a.isPdf ? 1 : 0));

    console.log(`Candidates: ${allCandidates.length} (${allCandidates.filter(c => c.isPdf).length} PDFs)`);

    for (const candidate of allCandidates) {
      const { msg, att, emailSubject, emailFrom, isPdf } = candidate;
      const normalizedMimeType = normalizeMimeType(att.content_type);
      const filename = att.filename || "";
      const sourceEmailId = `nylas:${msg.id}:${att.id}`;

      // Check if already exists
      const { data: existing } = await supabase
        .from("documents")
        .select("id, status, document_type, supplier_name, total_amount, issue_date, ai_confidence")
        .eq("source_email_id", sourceEmailId)
        .limit(1);

      if (existing && existing.length > 0) {
        const existingDoc = existing[0];
        const shouldRefreshExisting =
          existingDoc.status === "error" ||
          existingDoc.status === "processing" ||
          existingDoc.status === "rejected" ||
          (existingDoc.status !== "approved" && (
            !existingDoc.document_type ||
            !existingDoc.supplier_name ||
            existingDoc.total_amount == null ||
            !existingDoc.issue_date ||
            (existingDoc.ai_confidence ?? 0) < 70
          ));

        if (shouldRefreshExisting) {
          const anonKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY");
          if (anonKey) {
            const retryResp = await fetch(`${supabaseUrl}/functions/v1/extract-document`, {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${anonKey}` },
              body: JSON.stringify({ documentId: existingDoc.id }),
            });
            if (!retryResp.ok) {
              console.error("Retry extraction failed:", existingDoc.id, retryResp.status);
            } else {
              processedCount++;
            }
          }
        }
        continue;
      }

      // For PDFs: skip AI classification entirely — accept by default
      // For images: use AI vision to classify
      let isRelevant = true;
      let skipReason = "";

      if (!isPdf) {
        // Download and classify with AI vision
        const dlResp = await fetch(
          `${NYLAS_API}/grants/${grantId}/attachments/${att.id}/download?message_id=${msg.id}`,
          { headers: { Authorization: `Bearer ${nylasApiKey}` } },
        );

        if (!dlResp.ok) {
          console.error(`Failed to download attachment ${att.id}:`, dlResp.status);
          continue;
        }

        const fileBuffer = await dlResp.arrayBuffer();
        const fileBytes = new Uint8Array(fileBuffer);
        const visualClassification = await classifyAttachmentByContent(
          { filename, content_type: normalizedMimeType, size: att.size || fileBytes.length, bytes: fileBytes },
          emailSubject, emailFrom, lovableApiKey,
        );

        if (!visualClassification.relevant) {
          console.log(`AI skip: ${filename} — ${visualClassification.reason}`);
          skippedCount++;
          continue;
        }

        // Upload the already-downloaded file
        const ext = filename.split(".").pop() || "bin";
        const storagePath = `${clientId}/${Date.now()}_email_${Math.random().toString(36).slice(2)}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from("documents")
          .upload(storagePath, fileBytes, { contentType: normalizedMimeType });

        if (uploadError) { console.error("Storage upload failed:", uploadError); continue; }

        const { data: urlData } = supabase.storage.from("documents").getPublicUrl(storagePath);

        const { data: doc, error: insertError } = await supabase
          .from("documents")
          .insert({
            client_id: clientId, office_id: officeId,
            file_name: filename || `email_attachment.${ext}`,
            file_size: att.size || fileBytes.length,
            file_type: normalizedMimeType,
            file_url: urlData.publicUrl,
            source: "email", source_email_id: sourceEmailId, status: "processing",
          })
          .select().single();

        if (insertError) { console.error("Document insert failed:", insertError); continue; }

        if (doc) {
          const anonKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY");
          if (anonKey) {
            fetch(`${supabaseUrl}/functions/v1/extract-document`, {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${anonKey}` },
              body: JSON.stringify({ documentId: doc.id }),
            }).catch(e => console.error("Extract trigger failed:", e));
          }
        }

        processedCount++;
        console.log(`Processed image: ${filename} from "${emailSubject}"`);
        continue;
      }

      // PDF path — download, upload, extract (no AI classification needed)
      const dlResp = await fetch(
        `${NYLAS_API}/grants/${grantId}/attachments/${att.id}/download?message_id=${msg.id}`,
        { headers: { Authorization: `Bearer ${nylasApiKey}` } },
      );

      if (!dlResp.ok) {
        console.error(`Failed to download PDF ${att.id}:`, dlResp.status);
        continue;
      }

      const fileBuffer = await dlResp.arrayBuffer();
      const fileBytes = new Uint8Array(fileBuffer);
      const ext = filename.split(".").pop() || "pdf";
      const storagePath = `${clientId}/${Date.now()}_email_${Math.random().toString(36).slice(2)}.${ext}`;

      console.log(`PDF accepted: ${filename} from "${emailSubject}"`);

      const { error: uploadError } = await supabase.storage
        .from("documents")
        .upload(storagePath, fileBytes, { contentType: normalizedMimeType });

      if (uploadError) { console.error("Storage upload failed:", uploadError); continue; }

      const { data: urlData } = supabase.storage.from("documents").getPublicUrl(storagePath);

      const { data: doc, error: insertError } = await supabase
        .from("documents")
        .insert({
          client_id: clientId, office_id: officeId,
          file_name: filename || `email_attachment.${ext}`,
          file_size: att.size || fileBytes.length,
          file_type: normalizedMimeType,
          file_url: urlData.publicUrl,
          source: "email", source_email_id: sourceEmailId, status: "processing",
        })
        .select().single();

      if (insertError) { console.error("Document insert failed:", insertError); continue; }

      if (doc) {
        const anonKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY");
        if (anonKey) {
          // Fire and forget extraction to save time
          fetch(`${supabaseUrl}/functions/v1/extract-document`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${anonKey}` },
            body: JSON.stringify({ documentId: doc.id }),
          }).catch(e => console.error("Extract trigger failed:", e));
        }
      }

      processedCount++;
      console.log(`Processed PDF: ${filename} from "${emailSubject}"`);
    }

    console.log(`Done: processed=${processedCount}, skipped=${skippedCount}`);

    await supabase
      .from("email_integrations")
      .update({ last_sync_at: new Date().toISOString() })
      .eq("nylas_grant_id", grantId);

    return new Response(
      JSON.stringify({ success: true, processed: processedCount, skipped: skippedCount }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("scan-emails error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
