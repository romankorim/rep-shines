import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

// Generate invitation link (accountant only)
export const createInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ clientId: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    // Get client + office
    const { data: client, error: clientErr } = await supabase
      .from("clients")
      .select("id, office_id, name, email")
      .eq("id", data.clientId)
      .single();

    if (clientErr || !client) throw new Error("Klient nebol nájdený");

    // Check for existing pending invitation
    const { data: existing } = await supabase
      .from("client_invitations")
      .select("id, token")
      .eq("client_id", data.clientId)
      .eq("status", "pending")
      .limit(1);

    if (existing && existing.length > 0) {
      // Return existing token
      return { token: existing[0].token, clientName: client.name };
    }

    // Create new invitation
    const { data: invitation, error } = await supabase
      .from("client_invitations")
      .insert({
        client_id: data.clientId,
        office_id: client.office_id,
      })
      .select("token")
      .single();

    if (error) throw new Error(error.message);

    return { token: invitation.token, clientName: client.name };
  });

// Verify invitation token (public - no auth needed, uses anon key via client)
export const verifyInvitation = createServerFn({ method: "POST" })
  .inputValidator(z.object({ token: z.string().min(1).max(200) }))
  .handler(async ({ data }) => {
    // Use admin client for reading invitation by token
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: invitation, error } = await supabaseAdmin
      .from("client_invitations")
      .select("id, client_id, office_id, status, expires_at")
      .eq("token", data.token)
      .eq("status", "pending")
      .single();

    if (error || !invitation) {
      return { valid: false, error: "Pozvánka neexistuje alebo už bola použitá" };
    }

    // Check expiry
    if (new Date(invitation.expires_at) < new Date()) {
      return { valid: false, error: "Pozvánka vypršala" };
    }

    // Get client info
    const { data: client } = await supabaseAdmin
      .from("clients")
      .select("name, company_name, email")
      .eq("id", invitation.client_id)
      .single();

    // Get office info
    const { data: office } = await supabaseAdmin
      .from("accountant_offices")
      .select("name")
      .eq("id", invitation.office_id)
      .single();

    return {
      valid: true,
      clientId: invitation.client_id,
      clientName: client?.name || "",
      clientEmail: client?.email || "",
      companyName: client?.company_name || "",
      officeName: office?.name || "",
    };
  });

// Accept invitation after registration/login
export const acceptInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ token: z.string().min(1).max(200) }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Verify token again
    const { data: invitation, error } = await supabaseAdmin
      .from("client_invitations")
      .select("id, client_id, status, expires_at")
      .eq("token", data.token)
      .eq("status", "pending")
      .single();

    if (error || !invitation) {
      throw new Error("Pozvánka neexistuje alebo už bola použitá");
    }

    if (new Date(invitation.expires_at) < new Date()) {
      throw new Error("Pozvánka vypršala");
    }

    // Link user to client record
    const { error: updateErr } = await supabaseAdmin
      .from("clients")
      .update({ user_id: userId, status: "active" })
      .eq("id", invitation.client_id);

    if (updateErr) throw new Error(updateErr.message);

    // Mark invitation as accepted
    await supabaseAdmin
      .from("client_invitations")
      .update({ status: "accepted" })
      .eq("id", invitation.id);

    // Add client role
    await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: userId, role: "client" }, { onConflict: "user_id,role" });

    return { success: true, clientId: invitation.client_id };
  });
