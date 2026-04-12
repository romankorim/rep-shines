import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/nylas/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state"); // clientId

        if (!code || !state) {
          return new Response(
            `<html><body><script>window.close();alert("Chyba: chýba autorizačný kód");</script></body></html>`,
            { headers: { "Content-Type": "text/html" } }
          );
        }

        // Redirect to the client detail page with the code in query params
        // The client-side will handle the exchange
        const redirectUrl = `/clients/${state}?nylas_code=${encodeURIComponent(code)}`;
        return new Response(null, {
          status: 302,
          headers: { Location: redirectUrl },
        });
      },
    },
  },
});
