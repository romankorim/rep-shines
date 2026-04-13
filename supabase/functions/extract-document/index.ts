import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function normalizeMimeType(contentType?: string | null) {
  return contentType?.split(";")[0]?.trim().toLowerCase() || "application/octet-stream";
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { documentId } = await req.json();
    if (!documentId) {
      return new Response(JSON.stringify({ error: "documentId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY")!;

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Fetch document record
    const { data: doc, error: docError } = await supabase
      .from("documents")
      .select("*")
      .eq("id", documentId)
      .single();

    if (docError || !doc) {
      console.error("Document not found:", docError);
      return new Response(JSON.stringify({ error: "Document not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get a signed URL for the private documents bucket
    let fileUrl = doc.file_url;
    if (doc.file_url && doc.file_url.includes("/storage/v1/object/public/documents/")) {
      const storagePath = doc.file_url.split("/storage/v1/object/public/documents/")[1];
      if (storagePath) {
        const { data: signedData } = await supabase.storage
          .from("documents")
          .createSignedUrl(storagePath, 300);
        if (signedData?.signedUrl) {
          fileUrl = signedData.signedUrl;
        }
      }
    }

    let fileContent: any = null;
    const normalizedFileType = normalizeMimeType(doc.file_type);
    const isImage = normalizedFileType.startsWith("image/");
    const isPdf = normalizedFileType === "application/pdf";

    if (isImage && fileUrl) {
      try {
        const imgResp = await fetch(fileUrl);
        if (imgResp.ok) {
          const bytes = new Uint8Array(await imgResp.arrayBuffer());
          let binary = "";
          const chunkSize = 0x8000;
          for (let i = 0; i < bytes.length; i += chunkSize) {
            binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
          }

          fileContent = {
            type: "image_url",
            image_url: { url: `data:${normalizedFileType || "image/jpeg"};base64,${btoa(binary)}` },
          };
        }
      } catch (e) {
        console.error("Failed to download image:", e);
      }
    } else if (isPdf && fileUrl) {
      fileContent = {
        type: "input_file",
        file_url: fileUrl,
      };
    }

    const systemPrompt = `Si expert na OCR a extrahovanie dát z účtovných dokladov (faktúry, účtenky, dobropisy) pre slovenské a české firmy.

    Analyzuj priložený doklad a extrahuj VŠETKY dostupné údaje. Použi tool calling na vrátenie štruktúrovaných dát.

    Pravidlá:
    - Ak je vstup fotka alebo sken, najprv sprav dôkladné OCR celého dokumentu a až potom extrahuj polia
    - Ignoruj pozadie, tiene a perspektívu; čítaj aj slabšie viditeľný text, ak je rozpoznateľný
    - Dátumy formátuj ako YYYY-MM-DD
    - Sumy ako čísla (bez meny a medzier)
    - IČO, DIČ, IČ DPH presne ako na doklade
    - Ak údaj nie je na doklade, vráť null
    - confidence je 0-100, podľa čitateľnosti a úplnosti
    - document_type: received_invoice (prijatá faktúra), issued_invoice (vydaná), receipt (účtenka/pokladničný blok), credit_note (dobropis), advance_invoice (zálohová), bank_statement (výpis), other
    - vat_breakdown: pole objektov {rate, base, vat, total} pre každú sadzbu DPH na doklade
    - Sadzby DPH na SK: 20%, 10%, 5%; CZ: 21%, 12%`;

    const userMessage: any[] = [
      { type: "text", text: `Extrahuj všetky dáta z tohto dokladu. Súbor: ${doc.file_name || "unknown"}` },
    ];

    if (fileContent) {
      userMessage.push(fileContent);
    } else {
      userMessage.push({ type: "text", text: "[Súbor nie je dostupný pre vizuálnu analýzu. Extrahuj čo sa dá z názvu súboru.]" });
    }

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_document_data",
              description: "Extract structured data from an accounting document",
              parameters: {
                type: "object",
                properties: {
                  document_type: {
                    type: "string",
                    enum: ["received_invoice", "issued_invoice", "receipt", "credit_note", "advance_invoice", "bank_statement", "other"],
                    description: "Type of document",
                  },
                  supplier_name: { type: "string", description: "Name of supplier/vendor" },
                  supplier_ico: { type: "string", description: "IČO of supplier" },
                  supplier_dic: { type: "string", description: "DIČ of supplier" },
                  supplier_ic_dph: { type: "string", description: "IČ DPH of supplier" },
                  document_number: { type: "string", description: "Invoice/document number" },
                  variable_symbol: { type: "string", description: "Variabilný symbol" },
                  issue_date: { type: "string", description: "Date of issue (YYYY-MM-DD)" },
                  due_date: { type: "string", description: "Due date (YYYY-MM-DD)" },
                  delivery_date: { type: "string", description: "Delivery date (YYYY-MM-DD)" },
                  total_amount: { type: "number", description: "Total amount including VAT" },
                  currency: { type: "string", description: "Currency code (EUR, CZK, etc.)" },
                  tax_base: { type: "number", description: "Tax base (amount without VAT)" },
                  vat_amount: { type: "number", description: "Total VAT amount" },
                  vat_rate: { type: "number", description: "Primary VAT rate percentage" },
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
                    description: "Breakdown by VAT rate",
                  },
                  expense_category: { type: "string", description: "Suggested expense category" },
                  confidence: { type: "number", description: "Confidence score 0-100" },
                },
                required: ["confidence"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "extract_document_data" } },
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errText);

      // Update document status to error
      await supabase
        .from("documents")
        .update({ status: "error" })
        .eq("id", documentId);

      return new Response(
        JSON.stringify({ error: `AI extraction failed: ${aiResponse.status}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiResult = await aiResponse.json();
    const toolCall = aiResult.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall?.function?.arguments) {
      console.error("No tool call in AI response:", JSON.stringify(aiResult));
      await supabase.from("documents").update({ status: "error" }).eq("id", documentId);
      return new Response(
        JSON.stringify({ error: "AI did not return structured data" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let extracted: any;
    try {
      extracted = JSON.parse(toolCall.function.arguments);
    } catch {
      console.error("Failed to parse AI output:", toolCall.function.arguments);
      await supabase.from("documents").update({ status: "error" }).eq("id", documentId);
      return new Response(
        JSON.stringify({ error: "Failed to parse AI response" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Extracted data:", JSON.stringify(extracted));

    // Determine tax period from delivery_date or issue_date
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

    // Update document with extracted data
    const updateData: Record<string, any> = {
      status: "pending_approval",
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
      .from("documents")
      .update(updateData)
      .eq("id", documentId);

    if (updateError) {
      console.error("Failed to update document:", updateError);
      return new Response(
        JSON.stringify({ error: "Failed to save extracted data" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, extracted, confidence: extracted.confidence }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("extract-document error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
