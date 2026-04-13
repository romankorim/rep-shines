import { createFileRoute } from "@tanstack/react-router";

type ParsedState = {
  clientId: string;
  returnOrigin?: string;
};

function parseState(rawState: string | null): ParsedState | null {
  if (!rawState) return null;

  try {
    const parsed = JSON.parse(rawState) as ParsedState;
    if (typeof parsed.clientId !== "string") return null;

    if (parsed.returnOrigin) {
      try {
        parsed.returnOrigin = new URL(parsed.returnOrigin).origin;
      } catch {
        delete parsed.returnOrigin;
      }
    }

    return parsed;
  } catch {
    return { clientId: rawState };
  }
}

export const Route = createFileRoute("/api/nylas/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const code = url.searchParams.get("code");
        const state = parseState(url.searchParams.get("state"));

        if (!code || !state?.clientId) {
          return new Response(
            `<html><body><script>window.close();alert("Chyba: chýba autorizačný kód");</script></body></html>`,
            { headers: { "Content-Type": "text/html" } }
          );
        }

        const redirectPath = `/clients/${state.clientId}?nylas_code=${encodeURIComponent(code)}`;
        const redirectUrl = state.returnOrigin ? `${state.returnOrigin}${redirectPath}` : redirectPath;

        return new Response(null, {
          status: 302,
          headers: { Location: redirectUrl },
        });
      },
    },
  },
});