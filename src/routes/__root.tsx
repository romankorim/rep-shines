import { Outlet, Link, HeadContent, Scripts } from "@tanstack/react-router";
import { createRootRouteWithContext } from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";

import appCss from "../styles.css?url";

interface RouterContext {
  queryClient: QueryClient;
}

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">
          Stránka nenájdená
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Stránka, ktorú hľadáte, neexistuje alebo bola presunutá.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-none bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Späť na úvod
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<RouterContext>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "fantozzi — Automatický zber dokladov pre účtovníkov" },
      { name: "description", content: "fantozzi automaticky zbiera faktúry z emailov klientov, AI extrahuje dáta, páruje s bankovými výpismi a pripravuje DPH." },
      { property: "og:title", content: "fantozzi — Automatický zber dokladov pre účtovníkov" },
      { name: "twitter:title", content: "fantozzi — Automatický zber dokladov pre účtovníkov" },
      { property: "og:description", content: "fantozzi automaticky zbiera faktúry z emailov klientov, AI extrahuje dáta, páruje s bankovými výpismi a pripravuje DPH." },
      { name: "twitter:description", content: "fantozzi automaticky zbiera faktúry z emailov klientov, AI extrahuje dáta, páruje s bankovými výpismi a pripravuje DPH." },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:type", content: "website" },
      { property: "og:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/attachments/og-images/92ce938f-1f35-49f9-874e-70c7b0c869fe" },
      { name: "twitter:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/attachments/og-images/92ce938f-1f35-49f9-874e-70c7b0c869fe" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="sk">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Toaster />
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
    </QueryClientProvider>
  );
}
