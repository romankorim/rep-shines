import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { messages, documentContext } = await req.json();

    // Build context from database
    let contextParts: string[] = [];

    // Get user's office
    const { data: office } = await supabase
      .from("accountant_offices")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (office) {
      // Get clients summary
      const { data: clients } = await supabase
        .from("clients")
        .select("id, name, company_name, ico, dic, status")
        .eq("office_id", office.id)
        .limit(50);

      if (clients?.length) {
        contextParts.push(
          `Klienti kancelárie (${clients.length}):\n` +
          clients.map(c => `- ${c.company_name || c.name} (IČO: ${c.ico || "—"}, status: ${c.status})`).join("\n")
        );
      }

      // Get recent documents summary
      const { data: docs } = await supabase
        .from("documents")
        .select("id, file_name, supplier_name, document_type, status, total_amount, currency, issue_date, tax_period_month, tax_period_year, client_id, ai_confidence")
        .eq("office_id", office.id)
        .order("created_at", { ascending: false })
        .limit(100);

      if (docs?.length) {
        const pending = docs.filter(d => d.status === "pending_approval").length;
        const approved = docs.filter(d => d.status === "approved").length;
        const errors = docs.filter(d => d.status === "error").length;
        const totalSum = docs.reduce((s, d) => s + (d.total_amount || 0), 0);

        contextParts.push(
          `Doklady (${docs.length} posledných): ${pending} na schválenie, ${approved} schválených, ${errors} chýb. Celková suma: ${totalSum.toLocaleString("sk-SK")} €.`
        );
      }

      // Get VAT summary for current period
      const now = new Date();
      const currentMonth = now.getMonth() + 1;
      const currentYear = now.getFullYear();
      const { data: vatDocs } = await supabase
        .from("documents")
        .select("document_type, total_amount, tax_base, vat_amount, vat_rate")
        .eq("office_id", office.id)
        .eq("tax_period_month", currentMonth)
        .eq("tax_period_year", currentYear)
        .eq("status", "approved");

      if (vatDocs?.length) {
        const received = vatDocs.filter(d => d.document_type === "received_invoice");
        const issued = vatDocs.filter(d => d.document_type === "issued_invoice");
        const inputVat = received.reduce((s, d) => s + (d.vat_amount || 0), 0);
        const outputVat = issued.reduce((s, d) => s + (d.vat_amount || 0), 0);
        contextParts.push(
          `DPH ${currentMonth}/${currentYear}: Vstupná DPH ${inputVat.toLocaleString("sk-SK")} €, Výstupná DPH ${outputVat.toLocaleString("sk-SK")} €, Daňová povinnosť: ${(outputVat - inputVat).toLocaleString("sk-SK")} €`
        );
      }
    }

    // If there's document context (for document assistant)
    if (documentContext) {
      contextParts.push(`\nAktuálne zobrazený doklad:\n${JSON.stringify(documentContext, null, 2)}`);
    }

    const systemPrompt = `Si AI účtovný asistent pre slovenské a české účtovné kancelárie v systéme "fantozzi".
Odpovedáš po slovensky. Si odborník na:
- Slovenské a české účtovníctvo, DPH, daňové priznania
- Analýzu faktúr a dokladov
- Účtovné predkontácie a kategorizáciu výdavkov
- Daňové lehoty a povinnosti

Aktuálne dáta z databázy:
${contextParts.join("\n\n")}

Pravidlá:
- Odpovedaj stručne a vecne
- Keď sa pýtajú na konkrétny doklad, analyzuj ho podrobne
- Navrhuj účtovné predkontácie podľa SK legislatívy
- Upozorni na potenciálne problémy (chýbajúce údaje, duplicity, splatnosť)
- Použi formátovanie markdown pre prehľadnosť`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Príliš veľa požiadaviek, skúste neskôr." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Nedostatok kreditov pre AI. Dobite si kredit v nastaveniach." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);
      return new Response(JSON.stringify({ error: "AI chyba" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("ai-chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Neznáma chyba" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
