/**
 * EXTRACT-DOCUMENT v2
 *
 * Changes from v1:
 * - Gemini Flash instead of Pro (10x cheaper, same OCR quality)
 * - Retry with model cascade (2.5-flash → 2.0-flash)
 * - HTML body invoice support (email IS the invoice)
 * - Semantic dedup after extraction
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function normalizeMimeType(ct?: string | null) {
  return ct?.split(";")[0]?.trim().toLowerCase() || "application/octet-stream";
}

function arrayBufferToBase64(buf: ArrayBuffer) {
  let bin = "";
  const bytes = new Uint8Array(buf);
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

// Model cascade: try Flash first, fall back to 2.0
const MODELS = ["google/gemini-2.5-flash", "google/gemini-2.0-flash"];
const MAX_RETRIES = 2;

const TOOL_SCHEMA = {
  type: "function" as const,
  function: {
    name: "extract_document_data",
    description: "Extract structured data from an accounting document",
    parameters: {
      type: "object",
      properties: {
        document_type: {
          type: "string",
          enum: ["received_invoice", "issued_invoice", "receipt", "credit_note", "advance_invoice", "bank_statement", "other"],
        },
        supplier_name: { type: "string" },
        supplier_ico: { type: "string" },
        supplier_dic: { type: "string" },
        supplier_ic_dph: { type: "string" },
        document_number: { type: "string" },
        variable_symbol: { type: "string" },
        issue_date: { type: "string", description: "YYYY-MM-DD" },
        due_date: { type: "string", description: "YYYY-MM-DD" },
        delivery_date: { type: "string", description: "YYYY-MM-DD" },
        total_amount: { type: "number" },
        currency: { type: "string" },
        tax_base: { type: "number" },
        vat_amount: { type: "number" },
        vat_rate: { type: "number" },
        vat_breakdown: {
          type: "array",
          items: {
            type: "object",
            properties: {
              rate: { type: "number" },
              base: { type: "number" },
              vat: { type: "number" },
              total: { type: "number" },
            },
            required: ["rate", "base", "vat", "total"],
          },
        },
        expense_category: { type: "string" },
        confidence: { type: "number", description: "0-100" },
      },
      required: ["confidence"],
      additionalProperties: false,
    },
  },
};

const SYSTEM_PROMPT_VISUAL = `Si expert na OCR a extrahovanie dát z účtovných dokladov (faktúry, účtenky, dobropisy) pre slovenské a české firmy.

Analyzuj priložený doklad a extrahuj VŠETKY dostupné údaje. Použi tool calling na vrátenie štruktúrovaných dát.

Pravidlá:
- Ak je vstup fotka alebo sken, najprv sprav dôkladné OCR celého dokumentu a až potom extrahuj polia
- Ignoruj pozadie, tiene a perspektívu; čítaj aj slabšie viditeľný text
- Dátumy formátuj ako YYYY-MM-DD
- Sumy ako čísla (bez meny a medzier)
- IČO, DIČ, IČ DPH presne ako na doklade
- Ak údaj nie je na doklade, vráť null
- confidence je 0-100, podľa čitateľnosti a úplnosti
- document_type: received_invoice (prijatá), issued_invoice (vydaná), receipt (účtenka/blok), credit_note (dobropis), advance_invoice (zálohová), bank_statement (výpis), other
- vat_breakdown: pole objektov {rate, base, vat, total} pre každú sadzbu DPH
- Sadzby DPH na SK: 23%, 19%, 10%, 5%; CZ: 21%, 12%`;

const SYSTEM_PROMPT_HTML = `Si expert na extrahovanie účtovných dát z HTML emailov pre slovenské a české firmy.

Tento email JE účtovný doklad (faktúra, účtenka, potvrdenie platby od digitálnej služby ako Uber, Bolt, Booking, Apple, Google, AWS, atď.).

Prečítaj HTML zdrojový kód emailu a extrahuj VŠETKY účtovné údaje. Použi tool calling na vrátenie štruktúrovaných dát.

Pravidlá:
- Hľadaj v HTML: sumy, dátumy, IČO/DIČ/IČ DPH, číslo faktúry, variabilný symbol
- Hľadaj v tabuľkách (<table>), zoznamoch, a štruktúrovanom texte
- Ak je to potvrdenie platby (Uber, Bolt), document_type = "receipt"
- Ak je to faktúra za služby (SaaS, hosting), document_type = "received_invoice"
- Dátumy formátuj ako YYYY-MM-DD
- Sumy ako čísla
- confidence je 0-100
- Ak email neobsahuje účtovné údaje, nastav confidence = 10`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { documentId } = await req.json();
    if (!documentId) {
      return new Response(JSON.stringify({ error: "documentId is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Fetch document
    const { data: doc, error: docError } = await supabase
      .from("documents").select("*").eq("id", documentId).single();

    if (docError || !doc) {
      return new Response(JSON.stringify({ error: "Document not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const normalizedFileType = normalizeMimeType(doc.file_type);
    const isImage = normalizedFileType.startsWith("image/");
    const isPdf = normalizedFileType === "application/pdf";
    const isHtml = normalizedFileType === "text/html" || doc.extraction_strategy === "body_invoice";

    // ── BUILD AI INPUT ──

    let systemPrompt: string;
    const userMessage: any[] = [];

    if (isHtml) {
      // STRATEGY: Email body IS the invoice — send HTML as text
      systemPrompt = SYSTEM_PROMPT_HTML;

      let htmlContent = doc.original_email_html || "";

      // If not stored in column, try to fetch the HTML file
      if (!htmlContent && doc.file_url) {
        let fileUrl = doc.file_url;
        if (fileUrl.includes("/storage/v1/object/public/documents/")) {
          const path = fileUrl.split("/storage/v1/object/public/documents/")[1];
          if (path) {
            const { data: signed } = await supabase.storage.from("documents").createSignedUrl(path, 300);
            if (signed?.signedUrl) fileUrl = signed.signedUrl;
          }
        }
        const resp = await fetch(fileUrl);
        if (resp.ok) htmlContent = await resp.text();
      }

      if (!htmlContent) {
        await supabase.from("documents").update({ status: "error" }).eq("id", documentId);
        return new Response(JSON.stringify({ error: "No HTML content" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Truncate very long HTML to avoid token limits (keep first 15K chars)
      const truncated = htmlContent.length > 15000 ? htmlContent.slice(0, 15000) + "\n[...skrátené...]" : htmlContent;

      userMessage.push({
        type: "text",
        text: `Extrahuj účtovné dáta z tohto HTML emailu.\n\nNázov: ${doc.file_name || "email"}\n\n--- HTML ZAČIATOK ---\n${truncated}\n--- HTML KONIEC ---`,
      });

    } else {
      // STRATEGY: Visual extraction (PDF, image)
      systemPrompt = SYSTEM_PROMPT_VISUAL;

      let fileUrl = doc.file_url;
      if (fileUrl?.includes("/storage/v1/object/public/documents/")) {
        const path = fileUrl.split("/storage/v1/object/public/documents/")[1];
        if (path) {
          const { data: signed } = await supabase.storage.from("documents").createSignedUrl(path, 300);
          if (signed?.signedUrl) fileUrl = signed.signedUrl;
        }
      }

      userMessage.push({
        type: "text",
        text: `Extrahuj všetky dáta z tohto dokladu. Súbor: ${doc.file_name || "unknown"}`,
      });

      if (isImage && fileUrl) {
        try {
          const imgResp = await fetch(fileUrl);
          if (imgResp.ok) {
            const bytes = new Uint8Array(await imgResp.arrayBuffer());
            userMessage.push({
              type: "image_url",
              image_url: { url: `data:${normalizedFileType};base64,${arrayBufferToBase64(bytes.buffer)}` },
            });
          }
        } catch (e) {
          console.error("Image download failed:", e);
        }
      } else if (isPdf && fileUrl) {
        userMessage.push({
          type: "input_file",
          file_url: fileUrl,
        });
      }

      // If no visual content, add fallback text
      if (userMessage.length === 1) {
        userMessage.push({
          type: "text",
          text: "[Súbor nie je dostupný pre vizuálnu analýzu. Extrahuj čo sa dá z názvu súboru.]",
        });
      }
    }

    // ── CALL AI WITH RETRY + MODEL CASCADE ──

    let extracted: any = null;
    let lastError = "";
    let usedModel = "";

    for (const model of MODELS) {
      for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        if (attempt > 0) {
          // Exponential backoff
          await new Promise(r => setTimeout(r, (attempt * 15 + 5) * 1000));
        }

        try {
          const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${lovableApiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model,
              messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userMessage },
              ],
              tools: [TOOL_SCHEMA],
              tool_choice: { type: "function", function: { name: "extract_document_data" } },
            }),
          });

          if (!aiResponse.ok) {
            lastError = `${model} attempt ${attempt + 1}: ${aiResponse.status}`;
            console.warn(`AI failed: ${lastError}`);
            // On 429 rate limit, switch model immediately
            if (aiResponse.status === 429) break;
            continue;
          }

          const aiResult = await aiResponse.json();
          const toolCall = aiResult.choices?.[0]?.message?.tool_calls?.[0];

          if (!toolCall?.function?.arguments) {
            lastError = `${model}: no tool call in response`;
            continue;
          }

          extracted = JSON.parse(toolCall.function.arguments);
          usedModel = model;
          break; // Success!
        } catch (e) {
          lastError = `${model} attempt ${attempt + 1}: ${e}`;
          console.warn(`AI error: ${lastError}`);
        }
      }
      if (extracted) break; // Got result, stop trying models
    }

    if (!extracted) {
      console.error(`All models failed. Last: ${lastError}`);
      await supabase.from("documents").update({ status: "error" }).eq("id", documentId);
      return new Response(
        JSON.stringify({ error: `AI extraction failed: ${lastError}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    console.log(`Extracted with ${usedModel}:`, JSON.stringify(extracted).slice(0, 300));

    // ── TAX PERIOD ──

    const taxDate = extracted.delivery_date || extracted.issue_date;
    let taxPeriodMonth: number | null = null;
    let taxPeriodYear: number | null = null;
    if (taxDate) {
      const d = new Date(taxDate);
      if (!isNaN(d.getTime())) {
        taxPeriodMonth = d.getMonth() + 1;
        taxPeriodYear = d.getFullYear();
      }
    }

    // ── SEMANTIC DEDUP ──

    let isDuplicate = false;
    if (extracted.supplier_ico && extracted.document_number && extracted.total_amount != null) {
      const { data: dupes } = await supabase
        .from("documents")
        .select("id")
        .eq("client_id", doc.client_id)
        .eq("supplier_ico", extracted.supplier_ico)
        .eq("document_number", extracted.document_number)
        .neq("id", documentId)
        .limit(1);

      if (dupes?.length) {
        isDuplicate = true;
        console.log(`Duplicate detected: ${extracted.supplier_ico} / ${extracted.document_number}`);
      }
    }

    // ── UPDATE DOCUMENT ──

    const updateData: Record<string, any> = {
      status: isDuplicate ? "duplicate" : "pending_approval",
      ai_confidence: extracted.confidence ?? null,
      ai_raw_data: extracted,
    };

    if (extracted.document_type) updateData.document_type = extracted.document_type;
    if (extracted.supplier_name) updateData.supplier_name = extracted.supplier_name;
    if (extracted.supplier_ico) updateData.supplier_ico = extracted.supplier_ico;
    if (extracted.supplier_dic) updateData.supplier_dic = extracted.supplier_dic;
    if (extracted.supplier_ic_dph) updateData.supplier_ic_dph = extracted.supplier_ic_dph;
    if (extracted.document_number) updateData.document_number = extracted.document_number;
    if (extracted.variable_symbol) updateData.variable_symbol = extracted.variable_symbol;
    if (extracted.issue_date) updateData.issue_date = extracted.issue_date;
    if (extracted.due_date) updateData.due_date = extracted.due_date;
    if (extracted.delivery_date) updateData.delivery_date = extracted.delivery_date;
    if (extracted.total_amount != null) updateData.total_amount = extracted.total_amount;
    if (extracted.currency) updateData.currency = extracted.currency;
    if (extracted.tax_base != null) updateData.tax_base = extracted.tax_base;
    if (extracted.vat_amount != null) updateData.vat_amount = extracted.vat_amount;
    if (extracted.vat_rate != null) updateData.vat_rate = extracted.vat_rate;
    if (extracted.vat_breakdown) updateData.vat_breakdown = extracted.vat_breakdown;
    if (extracted.expense_category) updateData.expense_category = extracted.expense_category;
    if (taxPeriodMonth) updateData.tax_period_month = taxPeriodMonth;
    if (taxPeriodYear) updateData.tax_period_year = taxPeriodYear;

    const { error: updateError } = await supabase
      .from("documents").update(updateData).eq("id", documentId);

    if (updateError) {
      console.error("Update failed:", updateError);
      return new Response(
        JSON.stringify({ error: "Failed to save extracted data" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ success: true, extracted, model: usedModel, isDuplicate, confidence: extracted.confidence }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("extract-document error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
