import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

// ── Auth / Current User ──────────────────────────────────────

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

// ── Create Office (post-registration) ──────────────────────

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

    // Check if office already exists
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

    // Assign admin role if not already assigned
    await supabase.from("user_roles").upsert(
      { user_id: userId, role: "admin" },
      { onConflict: "user_id,role" }
    );

    return office;
  });

// ── Dashboard ──────────────────────────────────────────────

export const getDashboardStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    // Get accountant's office
    const { data: offices } = await supabase
      .from("accountant_offices")
      .select("id")
      .eq("user_id", userId)
      .limit(1);

    const officeId = offices?.[0]?.id;
    if (!officeId) return { totalClients: 0, docsThisMonth: 0, pendingApproval: 0, pendingConnection: 0 };

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const [clientsRes, docsRes, pendingRes] = await Promise.all([
      supabase.from("clients").select("id, status", { count: "exact" }).eq("office_id", officeId),
      supabase.from("documents").select("*", { count: "exact", head: true }).eq("office_id", officeId).gte("created_at", startOfMonth),
      supabase.from("documents").select("*", { count: "exact", head: true }).eq("office_id", officeId).eq("status", "pending_approval"),
    ]);

    const clients = clientsRes.data ?? [];
    const pendingConnection = clients.filter((c) => c.status === "invited").length;

    return {
      totalClients: clients.length,
      docsThisMonth: docsRes.count ?? 0,
      pendingApproval: pendingRes.count ?? 0,
      pendingConnection,
    };
  });

// ── Clients ──────────────────────────────────────────────

export const getClients = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const { data: offices } = await supabase
      .from("accountant_offices")
      .select("id")
      .eq("user_id", userId)
      .limit(1);

    const officeId = offices?.[0]?.id;
    if (!officeId) return [];

    const { data, error } = await supabase
      .from("clients")
      .select("*")
      .eq("office_id", officeId)
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const getClient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ clientId: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const [clientRes, docsRes, txRes, emailRes, bankRes, documentsRes] = await Promise.all([
      supabase.from("clients").select("*").eq("id", data.clientId).single(),
      supabase.from("documents").select("*", { count: "exact", head: true }).eq("client_id", data.clientId),
      supabase.from("bank_transactions").select("*", { count: "exact", head: true }).eq("client_id", data.clientId),
      supabase.from("email_integrations").select("*").eq("client_id", data.clientId).limit(1),
      supabase.from("bank_integrations").select("*").eq("client_id", data.clientId).limit(1),
      supabase.from("documents").select("*").eq("client_id", data.clientId).order("created_at", { ascending: false }).limit(20),
    ]);

    if (clientRes.error) throw new Error(clientRes.error.message);

    return {
      client: clientRes.data,
      docCount: docsRes.count ?? 0,
      txCount: txRes.count ?? 0,
      emailIntegration: emailRes.data?.[0] ?? null,
      bankIntegration: bankRes.data?.[0] ?? null,
      documents: documentsRes.data ?? [],
    };
  });

export const createClient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      name: z.string().min(1).max(200),
      email: z.string().email(),
      companyName: z.string().max(300).optional(),
      ico: z.string().max(20).optional(),
      dic: z.string().max(20).optional(),
      icDph: z.string().max(20).optional(),
      notes: z.string().max(5000).optional(),
      sendInvite: z.boolean().default(false),
    })
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Get or create office
    let { data: offices } = await supabase
      .from("accountant_offices")
      .select("id")
      .eq("user_id", userId)
      .limit(1);

    let officeId: string;
    if (offices && offices.length > 0) {
      officeId = offices[0].id;
    } else {
      const { data: newOffice, error: officeError } = await supabase
        .from("accountant_offices")
        .insert({ user_id: userId, name: "Moja kancelária" })
        .select("id")
        .single();
      if (officeError) throw new Error(officeError.message);
      officeId = newOffice.id;
    }

    const { data: newClient, error } = await supabase
      .from("clients")
      .insert({
        office_id: officeId,
        name: data.name,
        email: data.email,
        company_name: data.companyName || null,
        ico: data.ico || null,
        dic: data.dic || null,
        ic_dph: data.icDph || null,
        notes: data.notes || null,
        status: "invited",
      })
      .select()
      .single();

    if (error) throw new Error(error.message);

    if (data.sendInvite && newClient) {
      await supabase.from("client_invitations").insert({
        client_id: newClient.id,
        office_id: officeId,
      });
    }

    return newClient;
  });

// ── Documents ──────────────────────────────────────────────

export const getDocuments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const { data: offices } = await supabase
      .from("accountant_offices")
      .select("id")
      .eq("user_id", userId)
      .limit(1);

    const officeId = offices?.[0]?.id;
    if (!officeId) return [];

    const { data, error } = await supabase
      .from("documents")
      .select("*, clients!inner(name, company_name)")
      .eq("office_id", officeId)
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const updateDocumentStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      documentId: z.string().uuid(),
      status: z.enum(["approved", "rejected", "pending_approval"]),
      accountantNotes: z.string().max(5000).optional(),
      expenseCategory: z.string().max(100).optional(),
      accountingCode: z.string().max(50).optional(),
    })
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const updateData: Record<string, unknown> = { status: data.status };
    if (data.accountantNotes !== undefined) updateData.accountant_notes = data.accountantNotes;
    if (data.expenseCategory !== undefined) updateData.expense_category = data.expenseCategory;
    if (data.accountingCode !== undefined) updateData.accounting_code = data.accountingCode;

    const { data: updated, error } = await supabase
      .from("documents")
      .update(updateData)
      .eq("id", data.documentId)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return updated;
  });

// ── VAT ──────────────────────────────────────────────

export const getVatOverview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ month: z.number().min(1).max(12), year: z.number() }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: offices } = await supabase
      .from("accountant_offices")
      .select("id")
      .eq("user_id", userId)
      .limit(1);

    const officeId = offices?.[0]?.id;
    if (!officeId) return { clients: [], complete: 0, pending: 0, none: 0 };

    const [clientsRes, docsRes] = await Promise.all([
      supabase.from("clients").select("*").eq("office_id", officeId).order("name"),
      supabase.from("documents").select("client_id, status").eq("office_id", officeId).eq("tax_period_month", data.month).eq("tax_period_year", data.year),
    ]);

    const clients = clientsRes.data ?? [];
    const docs = docsRes.data ?? [];

    const clientStats = clients.map((client) => {
      const clientDocs = docs.filter((d) => d.client_id === client.id);
      const total = clientDocs.length;
      const approved = clientDocs.filter((d) => d.status === "approved").length;
      const completeness = total > 0 ? Math.round((approved / total) * 100) : 0;
      const vatStatus = total === 0 ? "none" as const : approved === total ? "complete" as const : "pending" as const;
      return { ...client, total, approved, completeness, vatStatus };
    });

    return {
      clients: clientStats,
      complete: clientStats.filter((c) => c.vatStatus === "complete").length,
      pending: clientStats.filter((c) => c.vatStatus === "pending").length,
      none: clientStats.filter((c) => c.vatStatus === "none").length,
    };
  });

// ── Portal (client-side) ──────────────────────────────────

export const getPortalStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    // Find client record linked to this user
    const { data: clientRecord } = await supabase
      .from("clients")
      .select("id, office_id")
      .eq("user_id", userId)
      .limit(1);

    const client = clientRecord?.[0];
    if (!client) return { clientId: null, totalDocs: 0, approvedDocs: 0, unmatchedTx: 0 };

    const [docsRes, approvedRes, txRes] = await Promise.all([
      supabase.from("documents").select("*", { count: "exact", head: true }).eq("client_id", client.id),
      supabase.from("documents").select("*", { count: "exact", head: true }).eq("client_id", client.id).eq("status", "approved"),
      supabase.from("bank_transactions").select("*", { count: "exact", head: true }).eq("client_id", client.id).is("matched_document_id", null),
    ]);

    return {
      clientId: client.id,
      officeId: client.office_id,
      totalDocs: docsRes.count ?? 0,
      approvedDocs: approvedRes.count ?? 0,
      unmatchedTx: txRes.count ?? 0,
    };
  });

export const getPortalDocuments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const { data: clientRecord } = await supabase
      .from("clients")
      .select("id")
      .eq("user_id", userId)
      .limit(1);

    const clientId = clientRecord?.[0]?.id;
    if (!clientId) return [];

    const { data, error } = await supabase
      .from("documents")
      .select("*")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);
    return data ?? [];
  });
