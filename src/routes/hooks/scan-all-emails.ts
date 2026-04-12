import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

export const Route = createFileRoute("/hooks/scan-all-emails")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authHeader = request.headers.get("authorization");
        const token = authHeader?.replace("Bearer ", "");

        if (!token) {
          return new Response(
            JSON.stringify({ error: "Missing authorization" }),
            { status: 401, headers: { "Content-Type": "application/json" } }
          );
        }

        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL!;
        const supabase = createClient(supabaseUrl, token, {
          auth: { autoRefreshToken: false, persistSession: false },
        });

        // Get all connected email integrations
        const { data: integrations, error } = await supabase
          .from("email_integrations")
          .select("nylas_grant_id, client_id, office_id")
          .eq("status", "connected")
          .not("nylas_grant_id", "is", null);

        if (error || !integrations) {
          return Response.json({ error: error?.message || "No integrations" }, { status: 500 });
        }

        console.log(`Cron: scanning ${integrations.length} connected email accounts`);

        const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY!;
        let scanned = 0;

        for (const int of integrations) {
          try {
            await fetch(`${supabaseUrl}/functions/v1/scan-emails`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${anonKey}`,
              },
              body: JSON.stringify({
                grantId: int.nylas_grant_id,
                clientId: int.client_id,
                officeId: int.office_id,
              }),
            });
            scanned++;
          } catch (err) {
            console.error(`Failed to scan for client ${int.client_id}:`, err);
          }
        }

        return Response.json({ success: true, scanned, total: integrations.length });
      },
    },
  },
});
