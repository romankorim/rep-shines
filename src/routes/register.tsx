import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { createOffice } from "@/lib/server-functions";

export const Route = createFileRoute("/register")({
  head: () => ({
    meta: [
      { title: "Registrácia — fantozzi" },
      { name: "description", content: "Vytvorte si účet a začnite automatizovať zber dokladov od klientov." },
    ],
  }),
  component: RegisterPage,
});

function RegisterPage() {
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    officeName: "",
    ico: "",
    dic: "",
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  function updateField(key: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const { error: signUpError } = await signUp(form.email, form.password, form.name);
    if (signUpError) {
      setError(signUpError);
      setLoading(false);
      return;
    }

    // Office will be created after email confirmation + first login
    // Store office data in localStorage temporarily
    if (typeof window !== "undefined" && form.officeName) {
      localStorage.setItem("fantozzi_pending_office", JSON.stringify({
        name: form.officeName,
        ico: form.ico,
        dic: form.dic,
      }));
    }

    setSuccess(true);
    setLoading(false);
  }

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <Card className="w-full max-w-sm border-border/50">
          <CardContent className="p-6 text-center space-y-4">
            <div className="text-4xl">📬</div>
            <h2 className="text-lg font-semibold">Skontrolujte si email</h2>
            <p className="text-sm text-muted-foreground">
              Poslali sme vám overovací email na <strong>{form.email}</strong>. Kliknite na odkaz v emaile pre aktiváciu účtu.
            </p>
            <Button asChild variant="outline" size="sm" className="mt-4">
              <Link to="/login">Späť na prihlásenie</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      {/* Left panel - desktop only */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-[#002333] via-[#003345] to-[#004455] p-12 flex-col justify-center">
        <div className="max-w-md">
          <span className="text-2xl font-bold text-primary">fantozzi</span>
          <h2 className="mt-6 text-3xl font-semibold text-white leading-tight">
            Automatizujte zber dokladov od klientov
          </h2>
          <ul className="mt-8 space-y-4">
            {[
              "AI extrakcia údajov z faktúr",
              "Automatický import z emailov a bánk",
              "GDPR compliant, dáta v EU",
            ].map((item) => (
              <li key={item} className="flex items-center gap-3 text-white/80">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-none bg-primary/20">
                  <svg className="h-3.5 w-3.5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <span className="text-sm">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Right panel - form */}
      <div className="flex flex-1 items-center justify-center px-4 py-8 sm:px-6">
        <Card className="w-full max-w-md border-border/50">
          <CardHeader className="text-center lg:text-left pb-2">
            <div className="lg:hidden mb-3">
              <span className="text-xl font-bold text-primary">fantozzi</span>
            </div>
            <h1 className="text-lg font-semibold">Vytvoriť účet</h1>
            <p className="text-sm text-muted-foreground">Začnite zbierať doklady automaticky</p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Meno a priezvisko *</Label>
                <Input
                  value={form.name}
                  onChange={(e) => updateField("name", e.target.value)}
                  placeholder="Ján Novák"
                  required
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Pracovný e-mail *</Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => updateField("email", e.target.value)}
                  placeholder="jan@uctovnictvo.sk"
                  required
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Heslo * (min. 8 znakov)</Label>
                <Input
                  type="password"
                  value={form.password}
                  onChange={(e) => updateField("password", e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={8}
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Názov kancelárie</Label>
                <Input
                  value={form.officeName}
                  onChange={(e) => updateField("officeName", e.target.value)}
                  placeholder="Účtovníctvo Novák s.r.o."
                  className="h-9 text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">IČO</Label>
                  <Input
                    value={form.ico}
                    onChange={(e) => updateField("ico", e.target.value)}
                    placeholder="12345678"
                    className="h-9 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">DIČ</Label>
                  <Input
                    value={form.dic}
                    onChange={(e) => updateField("dic", e.target.value)}
                    placeholder="2012345678"
                    className="h-9 text-sm"
                  />
                </div>
              </div>

              {error && <p className="text-xs text-destructive">{error}</p>}

              <Button type="submit" className="w-full min-h-[44px]" disabled={loading}>
                {loading ? "Vytváram účet..." : "Vytvoriť účet"}
              </Button>

              <p className="text-center text-xs text-muted-foreground">
                Už máte účet?{" "}
                <Link to="/login" className="text-primary hover:underline">
                  Prihlásiť sa
                </Link>
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
