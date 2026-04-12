import { Outlet, Link, HeadContent, Scripts } from "@tanstack/react-router";
import { createRootRouteWithContext } from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

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
          Page not found
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
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
      { title: "CommCalc — Commission & comp calculator" },
      { name: "description", content: "Internal commission calculator for real-time rep payouts, quota tracking, and comp plan management." },
      { property: "og:title", content: "CommCalc — Commission & comp calculator" },
      { name: "twitter:title", content: "CommCalc — Commission & comp calculator" },
      { property: "og:description", content: "Internal commission calculator for real-time rep payouts, quota tracking, and comp plan management." },
      { name: "twitter:description", content: "Internal commission calculator for real-time rep payouts, quota tracking, and comp plan management." },
      { property: "og:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/b9uXYmgdTyWTYhHfslbu4ZrHRZ73/social-images/social-1775640683451-commcalc.webp" },
      { name: "twitter:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/b9uXYmgdTyWTYhHfslbu4ZrHRZ73/social-images/social-1775640683451-commcalc.webp" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:type", content: "website" },
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
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
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
