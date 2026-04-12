import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { verifyInvitation, acceptInvitation } from "@/lib/server-functions/invitations";

export const Route = createFileRoute("/invite")({
  head: () => ({
    meta: [
      { title: "Pozvánka — fantozzi" },
      { name: "description", content: "Prijmite pozvánku a získajte prístup k portálu fantozzi" },
    ],
  }),
  validateSearch: (search: Record<string, unknown>) => ({
    token: (search.token as string) || "",
  }),
  component: InvitePage,
});

function InvitePage() {
  const { token } = Route.useSearch();
  const { isAuthenticated, isLoading: authLoading, user, signUp, signIn } = useAuth();
  const navigate = useNavigate();

  const [verifying, setVerifying] = useState(true);
  const [inviteData, setInviteData] = useState<{
    valid: boolean;
    error?: string;
    clientId?: string;
    clientName?: string;
    clientEmail?: string;
    companyName?: string;
    officeName?: string;
  } | null>(null);

  const [mode, setMode] = useState<"register" | "login">("register");
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [accepting, setAccepting] = useState(false);

  // Verify token on mount
  useEffect(() => {
    if (!token) {
      setInviteData({ valid: false, error: "Chýba token pozvánky" });
      setVerifying(false);
      return;
    }
    verifyInvitation({ data: { token } })
      .then((result) => {
        setInviteData(result);
        if (result.valid && result.clientEmail) {
          setForm((prev) => ({ ...prev, email: result.clientEmail!, name: result.clientName || "" }));
        }
      })
      .catch(() => {
        setInviteData({ valid: false, error: "Nepodarilo sa overiť pozvánku" });
      })
      .finally(() => setVerifying(false));
  }, [token]);

  // Auto-accept if already authenticated
  useEffect(() => {
    if (!authLoading && isAuthenticated && user && inviteData?.valid && !accepted && !accepting) {
      handleAccept();
    }
  }, [authLoading, isAuthenticated, inviteData, accepted]);

  async function handleAccept() {
    setAccepting(true);
    try {
      const result = await acceptInvitation({ data: { token } });
      if (result.success) {
        setAccepted(true);
        setTimeout(() => navigate({ to: "/portal" }), 2000);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Nepodarilo sa prijať pozvánku");
    } finally {
      setAccepting(false);
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const { error: signUpError } = await signUp(form.email, form.password, form.name);
    if (signUpError) {
      setError(signUpError);
      setLoading(false);
      return;
    }

    // Store token for after email confirmation
    if (typeof window !== "undefined") {
      localStorage.setItem("fantozzi_invite_token", token);
    }

    setLoading(false);
    setError("Skontrolujte email a potvrďte registráciu. Po potvrdení sa vráťte na tento link.");
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const { error: signInError } = await signIn(form.email, form.password);
    if (signInError) {
      setError(signInError);
      setLoading(false);
      return;
    }
    // Accept will trigger via useEffect when isAuthenticated changes
    setLoading(false);
  }

  if (verifying || authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!inviteData?.valid) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <Card className="w-full max-w-sm border-border/50">
          <CardContent className="p-6 text-center space-y-4">
            <XCircle className="h-12 w-12 text-destructive mx-auto" />
            <h2 className="text-lg font-semibold">Neplatná pozvánka</h2>
            <p className="text-sm text-muted-foreground">{inviteData?.error}</p>
            <Button asChild variant="outline" size="sm">
              <Link to="/login">Prejsť na prihlásenie</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (accepted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <Card className="w-full max-w-sm border-border/50">
          <CardContent className="p-6 text-center space-y-4">
            <CheckCircle2 className="h-12 w-12 text-primary mx-auto" />
            <h2 className="text-lg font-semibold">Pozvánka prijatá!</h2>
            <p className="text-sm text-muted-foreground">
              Presmerúvame vás do klientskeho portálu...
            </p>
            <Loader2 className="h-4 w-4 animate-spin text-primary mx-auto" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (accepting) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <Card className="w-full max-w-sm border-border/50">
          <CardContent className="p-6 text-center space-y-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
            <p className="text-sm text-muted-foreground">Prijímam pozvánku...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-sm border-border/50">
        <CardHeader className="text-center">
          <div className="mx-auto mb-3">
            <span className="text-xl font-bold text-primary">fantozzi</span>
          </div>
          <CardTitle className="text-lg">Pozvánka do portálu</CardTitle>
          <CardDescription>
            <strong>{inviteData.officeName}</strong> vás pozýva na prístup k vašim dokladom
            {inviteData.companyName && (
              <> pre <strong>{inviteData.companyName}</strong></>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {mode === "register" ? (
            <form onSubmit={handleRegister} className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Meno a priezvisko *</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Ján Novák"
                  required
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Email *</Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  required
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Heslo * (min. 8 znakov)</Label>
                <Input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="••••••••"
                  required
                  minLength={8}
                  className="h-9 text-sm"
                />
              </div>

              {error && <p className="text-xs text-destructive">{error}</p>}

              <Button type="submit" className="w-full min-h-[44px]" disabled={loading}>
                {loading ? "Registrujem..." : "Vytvoriť účet a prijať pozvánku"}
              </Button>

              <div className="flex items-center gap-3">
                <Separator className="flex-1" />
                <span className="text-xs text-muted-foreground">alebo</span>
                <Separator className="flex-1" />
              </div>

              <Button
                type="button"
                variant="outline"
                className="w-full"
                size="sm"
                onClick={() => { setMode("login"); setError(""); }}
              >
                Mám už účet — prihlásiť sa
              </Button>
            </form>
          ) : (
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Email *</Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  required
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Heslo *</Label>
                <Input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="••••••••"
                  required
                  className="h-9 text-sm"
                />
              </div>

              {error && <p className="text-xs text-destructive">{error}</p>}

              <Button type="submit" className="w-full min-h-[44px]" disabled={loading}>
                {loading ? "Prihlasujem..." : "Prihlásiť sa a prijať pozvánku"}
              </Button>

              <div className="flex items-center gap-3">
                <Separator className="flex-1" />
                <span className="text-xs text-muted-foreground">alebo</span>
                <Separator className="flex-1" />
              </div>

              <Button
                type="button"
                variant="outline"
                className="w-full"
                size="sm"
                onClick={() => { setMode("register"); setError(""); }}
              >
                Nemám účet — registrovať sa
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
