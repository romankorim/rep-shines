import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { LayoutDashboard, Upload, FileText, Link2, LogOut, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";

const navItems = [
  { to: "/portal", label: "Prehľad", icon: LayoutDashboard, exact: true },
  { to: "/portal/upload", label: "Nahrať doklad", icon: Upload, exact: false },
  { to: "/portal/documents", label: "Moje doklady", icon: FileText, exact: false },
  { to: "/portal/connections", label: "Pripojenia", icon: Link2, exact: false },
] as const;

export function PortalLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const email = user?.email ?? "";
  const name = user?.user_metadata?.full_name ?? user?.user_metadata?.name ?? email.split("@")[0];

  async function handleSignOut() {
    await signOut();
    navigate({ to: "/login" });
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b border-border bg-card">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-6">
            <Link to="/portal" className="flex items-center gap-2">
              <span className="text-base font-bold text-primary">fantozzi</span>
            </Link>

            <nav className="hidden items-center gap-1 md:flex">
              {navItems.map((item) => {
                const isActive = item.exact
                  ? location.pathname === item.to
                  : location.pathname.startsWith(item.to);
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={cn(
                      "flex items-center gap-2 rounded-none px-3 py-2 text-sm font-medium transition-colors min-h-[44px]",
                      isActive
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-muted-foreground sm:block">{name}</span>
            <button
              onClick={handleSignOut}
              className="flex items-center gap-1.5 rounded-none px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors min-h-[44px]"
              title="Odhlásiť sa"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Odhlásiť</span>
            </button>

            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="rounded-none p-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-foreground md:hidden"
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {mobileOpen && (
          <div className="border-t border-border px-4 py-3 space-y-1 md:hidden">
            {navItems.map((item) => {
              const isActive = item.exact
                ? location.pathname === item.to
                : location.pathname.startsWith(item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "flex items-center gap-2.5 rounded-none px-3 py-2.5 text-sm font-medium transition-colors min-h-[44px]",
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        )}
      </header>

      <main className="mx-auto max-w-7xl px-4 py-4 sm:px-6 sm:py-6">
        {children}
      </main>
    </div>
  );
}
