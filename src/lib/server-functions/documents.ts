import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

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

export const createDocumentRecord = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      clientId: z.string().uuid(),
      officeId: z.string().uuid(),
      fileName: z.string().max(500),
      fileSize: z.number(),
      fileType: z.string().max(100),
      fileUrl: z.string().url(),
      source: z.enum(["email", "upload", "bank"]).default("upload"),
    })
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const { data: doc, error } = await supabase
      .from("documents")
      .insert({
        client_id: data.clientId,
        office_id: data.officeId,
        file_name: data.fileName,
        file_size: data.fileSize,
        file_type: data.fileType,
        file_url: data.fileUrl,
        source: data.source,
        status: "processing",
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return doc;
  });
