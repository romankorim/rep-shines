import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useQueryClient } from "@tanstack/react-query";

export const Route = createFileRoute("/_authenticated/clients/new")({
  component: NewClientPage,
});

function NewClientPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    name: "",
    email: "",
    companyName: "",
    ico: "",
    dic: "",
    icDph: "",
    notes: "",
  });

  function updateField(key: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent, sendInvite: boolean) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // Get or create office
      const { data: offices } = await supabase
        .from("accountant_offices")
        .select("id")
        .eq("user_id", user!.id)
        .limit(1);

      let officeId: string;
      if (offices && offices.length > 0) {
        officeId = offices[0].id;
      } else {
        const { data: newOffice, error: officeError } = await supabase
          .from("accountant_offices")
          .insert({ user_id: user!.id, name: "Moja kancelária" })
          .select("id")
          .single();
        if (officeError) throw officeError;
        officeId = newOffice.id;
      }

      // Create client
      const { data: newClient, error: clientError } = await supabase
        .from("clients")
        .insert({
          office_id: officeId,
          name: form.name,
          email: form.email,
          company_name: form.companyName || null,
          ico: form.ico || null,
          dic: form.dic || null,
          ic_dph: form.icDph || null,
          notes: form.notes || null,
          status: "invited",
        })
        .select("id")
        .single();

      if (clientError) throw clientError;

      // Create invitation if requested
      if (sendInvite && newClient) {
        await supabase.from("client_invitations").insert({
          client_id: newClient.id,
          office_id: officeId,
        });
      }

      await queryClient.invalidateQueries({ queryKey: ["clients"] });
      navigate({ to: "/clients" });
    } catch (err: any) {
      setError(err.message || "Chyba pri vytváraní klienta");
    } finally {
      setLoading(false);
    }
  }

  return (
    <DashboardLayout>
      <div className="max-w-2xl">
        <h1 className="text-lg sm:text-xl font-semibold tracking-tight mb-6">Pridať klienta</h1>

        <form onSubmit={(e) => handleSubmit(e, false)}>
          <Card className="mb-4">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Základné údaje</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Meno / Kontaktná osoba *</Label>
                <Input
                  value={form.name}
                  onChange={(e) => updateField("name", e.target.value)}
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
                  onChange={(e) => updateField("email", e.target.value)}
                  placeholder="jan@firma.sk"
                  required
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Názov firmy</Label>
                <Input
                  value={form.companyName}
                  onChange={(e) => updateField("companyName", e.target.value)}
                  placeholder="Firma s.r.o."
                  className="h-9 text-sm"
                />
              </div>
            </CardContent>
          </Card>

          <Card className="mb-4">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Daňové údaje</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-3">
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
                <div className="space-y-1.5">
                  <Label className="text-xs">IČ DPH</Label>
                  <Input
                    value={form.icDph}
                    onChange={(e) => updateField("icDph", e.target.value)}
                    placeholder="SK2012345678"
                    className="h-9 text-sm"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="mb-6">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Poznámky</CardTitle>
            </CardHeader>
            <CardContent>
              <textarea
                value={form.notes}
                onChange={(e) => updateField("notes", e.target.value)}
                placeholder="Interné poznámky..."
                className="w-full min-h-[80px] rounded-none border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </CardContent>
          </Card>

          {error && <p className="text-xs text-destructive mb-4">{error}</p>}

          <div className="flex items-center gap-3">
            <Button type="submit" variant="outline" disabled={loading}>
              Uložiť klienta
            </Button>
            <Button
              type="button"
              disabled={loading}
              onClick={(e) => handleSubmit(e as any, true)}
            >
              {loading ? "Ukladám..." : "Uložiť a poslať pozvánku"}
            </Button>
          </div>
        </form>
      </div>
    </DashboardLayout>
  );
}
