import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { z } from "zod";

type DocumentWithPreview = {
  file_url?: string | null;
  thumbnail_url?: string | null;
  file_type?: string | null;
};

function getDocumentsStoragePath(url?: string | null) {
  if (!url) return null;
  const publicMarker = "/storage/v1/object/public/documents/";
  const signedMarker = "/storage/v1/object/sign/documents/";

  if (url.includes(publicMarker)) return url.split(publicMarker)[1]?.split("?")[0] || null;
  if (url.includes(signedMarker)) return url.split(signedMarker)[1]?.split("?")[0] || null;

  return null;
}

async function attachSignedPreviewUrls(
  documents: DocumentWithPreview[],
  createSignedUrl?: (path: string, expiresIn: number) => Promise<{ data?: { signedUrl?: string | null } | null }>
) {
  try {
    return await Promise.all(
      documents.map(async (doc) => {
        const nextDoc = { ...doc };
        const candidates = [doc.file_url, doc.thumbnail_url].filter(Boolean) as string[];

        for (const originalUrl of candidates) {
          const storagePath = getDocumentsStoragePath(originalUrl);
          if (!storagePath) continue;

          try {
            const signedUrlResult = createSignedUrl
              ? await createSignedUrl(storagePath, 60 * 60)
              : await supabaseAdmin.storage.from("documents").createSignedUrl(storagePath, 60 * 60);
            const data = signedUrlResult?.data;
            if (!data?.signedUrl) continue;

            if (originalUrl === doc.file_url) nextDoc.file_url = data.signedUrl;
            if (originalUrl === doc.thumbnail_url) nextDoc.thumbnail_url = data.signedUrl;
          } catch {
            // Signed URL generation failed, keep original URL
          }
        }

        return nextDoc;
      })
    );
  } catch {
    // supabaseAdmin not available (missing env vars), return docs as-is
    return documents;
  }
}

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
      supabase.from("email_integrations").select("*").eq("client_id", data.clientId).order("created_at", { ascending: false }),
      supabase.from("bank_integrations").select("*").eq("client_id", data.clientId).limit(1),
      supabase.from("documents").select("*").eq("client_id", data.clientId).order("created_at", { ascending: false }).limit(50),
    ]);

    if (clientRes.error) throw new Error(clientRes.error.message);

    const documents = await attachSignedPreviewUrls(
      documentsRes.data ?? [],
      async (storagePath, expiresIn) => {
        try {
          const result = await supabase.storage.from("documents").createSignedUrl(storagePath, expiresIn);
          if (result.data?.signedUrl) return result;
        } catch {
          // fall through to admin client
        }

        return supabaseAdmin.storage.from("documents").createSignedUrl(storagePath, expiresIn);
      }
    );

    return {
      client: clientRes.data,
      docCount: docsRes.count ?? 0,
      txCount: txRes.count ?? 0,
      emailIntegrations: emailRes.data ?? [],
      bankIntegration: bankRes.data?.[0] ?? null,
      documents,
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
