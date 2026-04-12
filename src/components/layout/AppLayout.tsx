import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { LayoutDashboard, FileText, Users, Settings, TrendingUp, LogOut, Menu, X, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";

const navItems = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/deals", label: "Deals", icon: FileText },
  { to: "/reps", label: "Reps", icon: Users },
  { to: "/comp-plans", label: "Comp plans", icon: Settings },
  { to: "/ai-chat", label: "AI chat", icon: MessageSquare },
] as const;

export function AppLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const email = user?.email ?? "";
  const name = user?.user_metadata?.full_name ?? user?.user_metadata?.name ?? email.split("@")[0];
  const initials = name
    ? name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)
    : "?";

  async function handleSignOut() {
    await signOut();
    navigate({ to: "/login" });
  }

  return (
    <div className="flex min-h-screen">
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-60 flex-col border-r border-border bg-sidebar transition-transform duration-200",
          mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        )}
      >
        {/* Logo */}
        <div className="flex h-14 items-center justify-between border-b border-border px-5">
          <div className="flex items-center gap-2.5">
            <TrendingUp className="h-5 w-5 text-primary" />
            <span className="text-sm font-semibold text-sidebar-foreground tracking-tight">CommCalc</span>
          </div>
          <button
            onClick={() => setMobileOpen(false)}
            className="rounded-md p-1 text-muted-foreground hover:text-sidebar-foreground md:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-0.5 p-3">
          {navItems.map((item) => {
            const isActive = item.to === "/dashboard" ? location.pathname === "/dashboard" : location.pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "flex items-center gap-2.5 rounded-md px-3 py-2.5 text-sm font-medium transition-colors min-h-[44px]",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-primary"
                    : "text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Footer — user info */}
        <div className="border-t border-border p-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-medium text-secondary-foreground">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-sidebar-foreground truncate">{name}</p>
              <p className="text-[11px] text-muted-foreground truncate">{email}</p>
            </div>
            <button
              onClick={handleSignOut}
              className="shrink-0 rounded-md p-1.5 min-h-[44px] min-w-[44px] flex items-center justify-center text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
              title="Sign out"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 md:pl-60">
        {/* Mobile header */}
        <div className="sticky top-0 z-30 flex h-14 items-center border-b border-border bg-background px-4 md:hidden">
          <button
            onClick={() => setMobileOpen(true)}
            className="rounded-md p-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-foreground hover:bg-muted transition-colors"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2 ml-3">
            <TrendingUp className="h-5 w-5 text-primary" />
            <span className="text-sm font-semibold tracking-tight">CommCalc</span>
          </div>
        </div>

        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 sm:py-6">
          {children}
        </div>
      </main>
    </div>
  );
}
