import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const getCurrentUser = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const [{ data: profile }, { data: roles }, { data: office }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).single(),
      supabase.from("user_roles").select("role").eq("user_id", userId),
      supabase.from("accountant_offices").select("*").eq("user_id", userId).limit(1),
    ]);

    const userRoles = (roles ?? []).map((r) => r.role);
    const isAccountant = userRoles.includes("admin");
    const isClient = userRoles.includes("client");

    return {
      userId,
      profile,
      roles: userRoles,
      isAccountant,
      isClient,
      office: office?.[0] ?? null,
    };
  });

export const createOffice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      name: z.string().min(1).max(300),
      ico: z.string().max(20).optional(),
      dic: z.string().max(20).optional(),
    })
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: existing } = await supabase
      .from("accountant_offices")
      .select("id")
      .eq("user_id", userId)
      .limit(1);

    if (existing && existing.length > 0) {
      return existing[0];
    }

    const { data: office, error } = await supabase
      .from("accountant_offices")
      .insert({
        user_id: userId,
        name: data.name,
        ico: data.ico || null,
        dic: data.dic || null,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);

    await supabase.from("user_roles").upsert(
      { user_id: userId, role: "admin" },
      { onConflict: "user_id,role" }
    );

    return office;
  });
