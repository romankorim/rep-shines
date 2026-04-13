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

/**
 * Batch-classify multiple attachments from the same email in one AI call.
 */
async function classifyAttachmentsBatch(
  attachments: Array<{ filename: string; content_type: string; size: number; id: string }>,
  emailSubject: string,
  emailFrom: string,
  lovableApiKey: string,
): Promise<Map<string, { relevant: boolean; reason: string }>> {
  const results = new Map<string, { relevant: boolean; reason: string }>();

  if (attachments.length === 0) return results;

  // For a single attachment, use the simple call
  if (attachments.length === 1) {
    const att = attachments[0];
    const result = await classifyAttachmentWithAI(att, emailSubject, emailFrom, lovableApiKey);
    results.set(att.id, result);
    return results;
  }

  // For multiple attachments, batch them in one prompt
  const attachmentList = attachments
    .map((a, i) => `${i + 1}. Súbor: "${a.filename || "(bez názvu)"}", Typ: "${a.content_type}", Veľkosť: ${a.size || 0}B`)
    .join("\n");

  const prompt = `Si AI agent pre účtovnícku firmu. Rozhodneš, ktoré prílohy e-mailu sú účtovné doklady.

E-mail:
- Predmet: "${emailSubject || "(žiadny)"}"
- Odosielateľ: "${emailFrom || "(neznámy)"}"

Prílohy:
${attachmentList}

Pre KAŽDÚ prílohu rozhodneš či je relevantná pre účtovníctvo (faktúra, účtenka, dobropis, výpis, zmluva, poistka, daňový doklad, mzdový doklad, avízo, zálohová faktúra, proforma, dodací list, objednávka, potvrdenie platby, alebo iný finančný/účtovný dokument).

Odpovedz IBA v JSON formáte:
{"results": [{"index": 1, "relevant": true/false, "reason": "..."}]}

Pravidlá:
- PDF → takmer vždy relevant=true (pokiaľ to nie je zjavne prezentácia/návod/marketing)
- Obrázky s účtovným kontextom (fotka účtenky, scan faktúry) → relevant=true
- Logá, podpisy, screenshoty, profilové obrázky, marketingové materiály → relevant=false
- Ak si nie si istý → relevant=true (radšej zahrnieš než vynecháš)`;

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
      // Default: accept all
      for (const att of attachments) {
        results.set(att.id, { relevant: true, reason: "AI unavailable, accepting by default" });
      }
      return results;
    }

    const result = await resp.json();
    const content = result.choices?.[0]?.message?.content;
    const parsed = JSON.parse(content || "{}");

    if (parsed.results && Array.isArray(parsed.results)) {
      for (const r of parsed.results) {
        const idx = (r.index || 1) - 1;
        if (idx >= 0 && idx < attachments.length) {
          results.set(attachments[idx].id, {
            relevant: Boolean(r.relevant),
            reason: r.reason || "",
          });
        }
      }
    }

    // Fill in any missing results as relevant (safe default)
    for (const att of attachments) {
      if (!results.has(att.id)) {
        results.set(att.id, { relevant: true, reason: "Not classified, accepting by default" });
      }
    }

    return results;
  } catch (e) {
    console.error("Batch AI classify error:", e);
    for (const att of attachments) {
      results.set(att.id, { relevant: true, reason: "AI error, accepting by default" });
    }
    return results;
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
          const receivedAfter = Math.floor(Date.UTC(year, month - 1, 1, 0, 0, 0) / 1000);
          const receivedBefore = Math.floor(Date.UTC(year, month, 1, 0, 0, 0) / 1000);
          params.set("received_after", String(receivedAfter));
          params.set("received_before", String(receivedBefore));
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

    for (const msg of messagesToProcess) {
      if (!msg.attachments || msg.attachments.length === 0) continue;

      const emailSubject = msg.subject || "";
      const emailFrom = msg.from?.[0]?.email || msg.from?.[0]?.name || "";

      // Step 1: Quick pre-filter (remove obviously irrelevant stuff before sending to AI)
      const candidateAttachments: typeof msg.attachments = [];

      for (const att of msg.attachments) {
        const filename = att.filename || "";
        const contentType = normalizeMimeType(att.content_type);

        // Skip inline images (email signatures, logos embedded in HTML)
        if (att.content_disposition === "inline") {
          skippedCount++;
          continue;
        }

        // Skip obviously non-document types (video, audio, zip, pptx)
        if (ALWAYS_SKIP_CONTENT_TYPES.some((t) => contentType.includes(t))) {
          console.log(`Pre-filter skip: ${filename} (${contentType})`);
          skippedCount++;
          continue;
        }

        // Skip extremely tiny files (< 3KB — tracking pixels, tiny icons)
        if (att.size && att.size < 3000) {
          console.log(`Pre-filter skip tiny: ${filename} (${att.size}B)`);
          skippedCount++;
          continue;
        }

        candidateAttachments.push(att);
      }

      if (candidateAttachments.length === 0) continue;

      // Step 2: AI classification for all candidates in this email
      const classifications = await classifyAttachmentsBatch(
        candidateAttachments.map((a: any) => ({
          filename: a.filename || "",
          content_type: a.content_type || "",
          size: a.size || 0,
          id: a.id,
        })),
        emailSubject,
        emailFrom,
        lovableApiKey,
      );

      // Step 3: Process relevant attachments
      for (const att of candidateAttachments) {
        const classification = classifications.get(att.id);
        if (!classification?.relevant) {
          console.log(`AI skip: ${att.filename} — ${classification?.reason}`);
          skippedCount++;
          continue;
        }

        // Check for duplicates; on refresh retry failed extractions
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
              const retryResp = await fetch(`${supabaseUrl}/functions/v1/extract-document`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${anonKey}`,
                },
                body: JSON.stringify({ documentId: existingDoc.id }),
              });
              if (!retryResp.ok) console.error("Retry extraction failed:", existingDoc.id, retryResp.status, await retryResp.text());
              processedCount++;
            }
          } else if (["pending_approval", "approved", "rejected"].includes(existingDoc.status)) {
            const normalizedMimeType = normalizeMimeType(att.content_type);
            const canInspectVisually = normalizedMimeType === "application/pdf" || normalizedMimeType.startsWith("image/");

            if (canInspectVisually) {
              const dlResp = await fetch(
                `${NYLAS_API}/grants/${grantId}/attachments/${att.id}/download?message_id=${msg.id}`,
                { headers: { Authorization: `Bearer ${nylasApiKey}` } },
              );

              if (dlResp.ok) {
                const fileBuffer = await dlResp.arrayBuffer();
                const fileBytes = new Uint8Array(fileBuffer);
                const review = await classifyAttachmentByContent(
                  {
                    filename: att.filename || "",
                    content_type: normalizedMimeType,
                    size: att.size || fileBytes.length,
                    bytes: fileBytes,
                  },
                  emailSubject,
                  emailFrom,
                  lovableApiKey,
                );

                if (!review.relevant) {
                  await supabase
                    .from("documents")
                    .update({
                      status: "rejected",
                      document_type: null,
                      supplier_name: null,
                      supplier_ico: null,
                      supplier_dic: null,
                      supplier_ic_dph: null,
                      document_number: null,
                      variable_symbol: null,
                      issue_date: null,
                      due_date: null,
                      delivery_date: null,
                      total_amount: null,
                      currency: null,
                      tax_base: null,
                      vat_amount: null,
                      vat_rate: null,
                      vat_breakdown: null,
                      expense_category: null,
                      ai_confidence: 0,
                      ai_raw_data: { reason: review.reason, filtered_by_agent: true },
                    })
                    .eq("id", existingDoc.id);
                  skippedCount++;
                }
              }
            }
          }
          continue;
        }

        // Download attachment from Nylas
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
        const filename = att.filename || "";
        const ext = filename.split(".").pop() || "pdf";
        const storagePath = `${clientId}/${Date.now()}_email_${Math.random().toString(36).slice(2)}.${ext}`;
        const normalizedMimeType = normalizeMimeType(att.content_type);

        const visualClassification = await classifyAttachmentByContent(
          {
            filename,
            content_type: normalizedMimeType,
            size: att.size || fileBytes.length,
            bytes: fileBytes,
          },
          emailSubject,
          emailFrom,
          lovableApiKey,
        );

        if (!visualClassification.relevant) {
          console.log(`AI skip after visual inspection: ${filename} — ${visualClassification.reason}`);
          skippedCount++;
          continue;
        }

        console.log(`AI accepted: ${filename} — ${visualClassification.reason} (${visualClassification.signal})`);

        const { error: uploadError } = await supabase.storage
          .from("documents")
          .upload(storagePath, fileBytes, {
            contentType: normalizedMimeType,
          });

        if (uploadError) {
          console.error("Storage upload failed:", uploadError);
          continue;
        }

        const { data: urlData } = supabase.storage.from("documents").getPublicUrl(storagePath);

        const { data: doc, error: insertError } = await supabase
          .from("documents")
          .insert({
            client_id: clientId,
            office_id: officeId,
            file_name: filename || `email_attachment.${ext}`,
            file_size: att.size || fileBytes.length,
            file_type: normalizedMimeType,
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

        if (doc) {
          const anonKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY");
          if (anonKey) {
            const extractResp = await fetch(`${supabaseUrl}/functions/v1/extract-document`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${anonKey}`,
              },
              body: JSON.stringify({ documentId: doc.id }),
            });
            if (!extractResp.ok) console.error("Failed to trigger extraction:", doc.id, extractResp.status, await extractResp.text());
          }
        }

        processedCount++;
        console.log(`Processed: ${filename} from "${emailSubject}"`);
      }
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
