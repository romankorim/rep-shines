import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { TrendingUp } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { lovable } from "@/integrations/lovable/index";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const { signIn, signUp, isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      navigate({ to: "/dashboard" });
    }
  }, [isLoading, isAuthenticated, navigate]);

  async function handleGoogleSignIn() {
    setError("");
    setGoogleLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result.error) {
        setError(result.error instanceof Error ? result.error.message : String(result.error));
      }
    } catch {
      setError("Failed to sign in with Google");
    } finally {
      setGoogleLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    if (isSignUp) {
      const { error } = await signUp(email, password, name);
      if (error) setError(error);
      else setError("Check your email to confirm your account.");
    } else {
      const { error } = await signIn(email, password);
      if (error) setError(error);
      else navigate({ to: "/dashboard" });
    }

    setLoading(false);
  }

  if (isLoading || isAuthenticated) {
    return null;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-sm border-border/50">
        <CardHeader className="text-center">
          <div className="mx-auto mb-3">
            <TrendingUp className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-lg">CommCalc</CardTitle>
          <CardDescription>{isSignUp ? "Create your account" : "Sign in to continue"}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            type="button"
            variant="outline"
            className="w-full"
            size="sm"
            disabled={googleLoading}
            onClick={handleGoogleSignIn}
          >
            <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            {googleLoading ? "Signing in..." : "Continue with Google"}
          </Button>

          <div className="flex items-center gap-3">
            <Separator className="flex-1" />
            <span className="text-xs text-muted-foreground">or</span>
            <Separator className="flex-1" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignUp && (
              <div className="space-y-1.5">
                <Label className="text-xs">Name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" className="h-9 text-sm" />
              </div>
            )}
            <div className="space-y-1.5">
              <Label className="text-xs">Email</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" required className="h-9 text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Password</Label>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required minLength={6} className="h-9 text-sm" />
            </div>
            {error && <p className="text-xs text-destructive">{error}</p>}
            <Button type="submit" className="w-full" size="sm" disabled={loading}>
              {loading ? "Loading..." : isSignUp ? "Sign up" : "Sign in"}
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              {isSignUp ? "Already have an account?" : "Don't have an account?"}{" "}
              <button type="button" onClick={() => { setIsSignUp(!isSignUp); setError(""); }} className="text-primary hover:underline">
                {isSignUp ? "Sign in" : "Sign up"}
              </button>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
