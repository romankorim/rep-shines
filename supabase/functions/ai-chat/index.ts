import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate user
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");

    if (!lovableApiKey) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Verify user
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { messages } = await req.json();

    // Fetch all data using service role
    const admin = createClient(supabaseUrl, supabaseKey);

    const [dealsRes, repsRes, compPlansRes, compTiersRes, quotaTiersRes] = await Promise.all([
      admin.from("deals").select("*").is("deleted_at", null).limit(500),
      admin.from("reps").select("*").limit(500),
      admin.from("comp_plans").select("*").limit(100),
      admin.from("comp_tiers").select("*").limit(200),
      admin.from("quota_tiers").select("*").limit(100),
    ]);

    const context = JSON.stringify({
      deals: dealsRes.data ?? [],
      reps: repsRes.data ?? [],
      comp_plans: compPlansRes.data ?? [],
      comp_tiers: compTiersRes.data ?? [],
      quota_tiers: quotaTiersRes.data ?? [],
    });

    const systemPrompt = `You are CommCalc AI, an intelligent assistant for a sales commission management platform. You have access to the following live database data:

${context}

Use this data to answer questions about:
- Deals: sizes, statuses, close dates, commissions, which rep owns them
- Sales reps: names, teams, quotas, performance
- Compensation plans: tiers, commission rates, deal size ranges
- Quota tiers: attainment levels, rate multipliers

FORMATTING RULES (follow strictly):
- Use markdown headers (##, ###) to organize sections
- Use bullet points for lists and summaries
- Format currency values with $ and commas (e.g. $42,500)
- When presenting tabular data, use proper markdown tables with EACH ROW ON ITS OWN LINE. Example:

| Name | Amount |
|------|--------|
| Alice | $1,000 |
| Bob | $2,000 |

- NEVER put multiple table rows on the same line
- Add blank lines before and after tables
- Use **bold** for key figures and important values
- Use horizontal rules (---) to separate major sections
- Keep answers concise but thorough
- If the data doesn't contain what's asked, say so clearly`;

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
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add funds in workspace settings." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const text = await response.text();
      console.error("AI gateway error:", response.status, text);
      return new Response(JSON.stringify({ error: "AI service error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("ai-chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
