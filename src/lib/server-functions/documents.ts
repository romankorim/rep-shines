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

export const updateDocumentFields = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      documentId: z.string().uuid(),
      documentType: z.enum(["received_invoice", "issued_invoice", "receipt", "credit_note", "advance_invoice", "bank_statement", "other"]).optional(),
      supplierName: z.string().max(500).optional(),
      supplierIco: z.string().max(50).optional(),
      supplierDic: z.string().max(50).optional(),
      supplierIcDph: z.string().max(50).optional(),
      documentNumber: z.string().max(100).optional(),
      variableSymbol: z.string().max(50).optional(),
      issueDate: z.string().max(10).optional(),
      dueDate: z.string().max(10).optional(),
      deliveryDate: z.string().max(10).optional(),
      totalAmount: z.number().optional(),
      currency: z.string().max(10).optional(),
      taxBase: z.number().optional(),
      vatAmount: z.number().optional(),
      vatRate: z.number().optional(),
    })
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const fieldMap: Record<string, string> = {
      documentType: "document_type",
      supplierName: "supplier_name",
      supplierIco: "supplier_ico",
      supplierDic: "supplier_dic",
      supplierIcDph: "supplier_ic_dph",
      documentNumber: "document_number",
      variableSymbol: "variable_symbol",
      issueDate: "issue_date",
      dueDate: "due_date",
      deliveryDate: "delivery_date",
      totalAmount: "total_amount",
      currency: "currency",
      taxBase: "tax_base",
      vatAmount: "vat_amount",
      vatRate: "vat_rate",
    };

    const updateData: Record<string, unknown> = {};
    for (const [key, dbCol] of Object.entries(fieldMap)) {
      if ((data as any)[key] !== undefined) {
        updateData[dbCol] = (data as any)[key];
      }
    }

    if (Object.keys(updateData).length === 0) return null;

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

    // Trigger AI extraction asynchronously
    if (doc) {
      const supabaseUrl = process.env.SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL;
      const anonKey = process.env.SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      if (supabaseUrl && anonKey) {
        fetch(`${supabaseUrl}/functions/v1/extract-document`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${anonKey}`,
          },
          body: JSON.stringify({ documentId: doc.id }),
        }).catch((err) => console.error("Failed to trigger extraction:", err));
      }
    }

    return doc;
  });

// Move document to a different tax period (month/year)
export const moveDocumentPeriod = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      documentId: z.string().uuid(),
      targetMonth: z.number().min(1).max(12),
      targetYear: z.number().min(2000).max(2100),
    })
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase
      .from("documents")
      .update({
        tax_period_month: data.targetMonth,
        tax_period_year: data.targetYear,
      })
      .eq("id", data.documentId);

    if (error) throw new Error(error.message);
    return { success: true };
  });
