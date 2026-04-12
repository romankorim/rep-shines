import { createFileRoute, Outlet, useNavigate, useLocation } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { currentUserQueryOptions } from "@/lib/query-options";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated")({
  component: AuthenticatedLayout,
});

const ACCOUNTANT_ROUTES = ["/dashboard", "/clients", "/documents", "/vat"];
const CLIENT_ROUTES = ["/portal"];

function AuthenticatedLayout() {
  const { isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { data: currentUser, isLoading: userLoading, isError } = useQuery({
    ...currentUserQueryOptions(),
    enabled: isAuthenticated,
    retry: 1,
  });

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate({ to: "/login" });
    }
  }, [isLoading, isAuthenticated, navigate]);

  // Role-based route guard
  useEffect(() => {
    if (!currentUser || userLoading) return;

    const path = location.pathname;

    if (currentUser.isClient && !currentUser.isAccountant) {
      // Client trying to access accountant routes
      if (ACCOUNTANT_ROUTES.some((r) => path.startsWith(r))) {
        navigate({ to: "/portal" });
      }
    } else if (currentUser.isAccountant && !currentUser.isClient) {
      // Accountant trying to access client portal
      if (CLIENT_ROUTES.some((r) => path.startsWith(r))) {
        navigate({ to: "/dashboard" });
      }
    }
  }, [currentUser, userLoading, location.pathname, navigate]);

  if (isLoading || (isAuthenticated && userLoading && !isError)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="space-y-3 w-48">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return <Outlet />;
}
