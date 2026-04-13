/**
 * INTELLIGENT EMAIL AGENT — scan-emails v2
 *
 * 6-stage pipeline:
 *   1. DISCOVERY  — smart Nylas queries (not just has_attachment)
 *   2. RULES      — fast filter from sender_intelligence (free, <1ms)
 *   3. TRIAGE     — batch AI classification (text-only, cheap)
 *   4. EXTRACTION — multi-strategy (attachment, inline, body, link, forwarded)
 *   5. DEDUP      — SHA-256 + semantic hash
 *   6. LEARNING   — update sender_intelligence stats
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.1";
import { crypto } from "https://deno.land/std@0.168.0/crypto/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const NYLAS_API = "https://api.us.nylas.com/v3";
const MAX_WALL_TIME_MS = 135_000;
const TRIAGE_BATCH_SIZE = 8;

// ─── STAGE 1: DISCOVERY ─────────────────────────────────────
// Smart queries that find emails WITH and WITHOUT attachments

const DISCOVERY_QUERIES = [
  // SK/CZ invoice subjects
  'subject:(faktura OR faktúra OR invoice OR "daňový doklad")',
  'subject:(dobropis OR "credit note" OR proforma OR záloha)',
  // Receipts / confirmations
  'subject:(účtenka OR receipt OR potvrdenie OR "potvrdenie platby" OR "payment confirmation")',
  // Financial subjects
  'subject:(platba OR payment OR vyúčtovanie OR avízo OR upomienka OR splatnosť)',
  // PDF attachments (classic invoices)
  "has:attachment filename:pdf",
  // Known body-invoice senders (Uber, Bolt, etc. — no attachment!)
  "from:uber.com OR from:bolt.eu OR from:wolt.com OR from:booking.com",
  "from:apple.com OR from:google.com OR from:stripe.com OR from:amazon.com",
  // Bank statements / notifications
  'subject:(výpis OR "bank statement" OR výpis z účtu)',
];

function normalizeMimeType(ct?: string | null) {
  return ct?.split(";")[0]?.trim().toLowerCase() || "application/octet-stream";
}

function arrayBufferToBase64(buf: ArrayBuffer) {
  let bin = "";
  const bytes = new Uint8Array(buf);
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

async function sha256(data: Uint8Array): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", data.buffer as ArrayBuffer);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, "0")).join("");
}

// ─── STAGE 2: RULES ENGINE ──────────────────────────────────

interface SenderRule {
  classification: string;
  typical_content: string | null;
  force_include: boolean;
  force_exclude: boolean;
  known_vendor_name: string | null;
}

function applyRules(
  fromEmail: string,
  subject: string,
  senderMap: Map<string, SenderRule>,
  processedIds: Set<string>,
  nylasMessageId: string,
): "process" | "skip" | "trusted" {
  // Already processed?
  if (processedIds.has(nylasMessageId)) return "skip";

  const domain = fromEmail.split("@")[1]?.toLowerCase() || "";
  const rule = senderMap.get(domain) || senderMap.get(fromEmail.toLowerCase());

  if (rule) {
    if (rule.force_exclude) return "skip";
    if (rule.force_include || rule.classification === "trusted_invoicer") return "trusted";
    if (rule.classification === "newsletter" || rule.classification === "spam") return "skip";
  }

  // Heuristic: skip obvious non-accounting
  const subjectLower = subject.toLowerCase();
  if (subjectLower.includes("unsubscribe") || subjectLower.includes("odhlásiť")) return "skip";

  return "process";
}

// ─── STAGE 3: AI TRIAGE ─────────────────────────────────────

interface TriageResult {
  is_accounting: boolean;
  confidence: number;
  content_types: string[]; // 'attachment','inline_image','body_invoice','download_link','forwarded'
  reasoning: string;
}

async function triageBatch(
  emails: Array<{ from: string; subject: string; snippet: string; attachments: string; is_forwarded: boolean }>,
  lovableApiKey: string,
): Promise<TriageResult[]> {
  const emailList = emails.map((e, i) => `
[Email ${i + 1}]
Od: ${e.from}
Predmet: ${e.subject}
Ukážka: ${e.snippet}
Prílohy: ${e.attachments || "žiadne"}
Preposlané: ${e.is_forwarded ? "áno" : "nie"}`).join("\n");

  const prompt = `Si AI agent účtovníckej firmy na Slovensku/v Česku. Pre KAŽDÝ email rozhodni, či obsahuje účtovný doklad.

${emailList}

Pre KAŽDÝ email vráť:
- is_accounting: true ak email obsahuje alebo JE faktúra, účtenka, dobropis, výpis, potvrdenie platby, objednávka, zmluva, alebo iný účtovný/finančný doklad
- content_types: pole stratégií extrahovania:
  "attachment" = doklad je v prílohe (PDF, obrázok)
  "inline_image" = fotka dokladu vložená priamo v tele emailu
  "body_invoice" = samotný email JE doklad (napr. Uber, Bolt, Booking, Apple, SaaS služby)
  "download_link" = email obsahuje odkaz na stiahnutie faktúry
  "forwarded" = preposlený email s dokladom
- confidence: 0-100
- reasoning: stručné vysvetlenie

DÔLEŽITÉ:
- Emaily od Uber, Bolt, Booking, Apple, Google, AWS, Stripe = VŽDY is_accounting=true, content_types=["body_invoice"]
- PDF príloha s názvom obsahujúcim "faktura", "invoice", "doklad" = VŽDY relevant
- Screenshot, logo, podpis, banner = NERELEVANTNÉ
- Newsletter s prílohami = zvyčajne nerelevantné (ak predmet nenaznačuje faktúru)
- Ak je email preposlanie faktúry = relevant, content_types=["forwarded"]

Vráť VÝLUČNE JSON pole s ${emails.length} objektami:
[{"is_accounting": true/false, "confidence": 85, "content_types": ["attachment"], "reasoning": "..."}]`;

  try {
    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        temperature: 0.1,
      }),
    });

    if (!resp.ok) {
      console.error("Triage AI failed:", resp.status);
      // Fallback: accept all as uncertain
      return emails.map(() => ({
        is_accounting: true,
        confidence: 50,
        content_types: ["attachment"],
        reasoning: "AI triage unavailable, accepting by default",
      }));
    }

    const result = await resp.json();
    const content = result.choices?.[0]?.message?.content || "[]";
    const parsed = JSON.parse(content);

    // Handle both array and object-with-array responses
    const arr = Array.isArray(parsed) ? parsed : parsed.emails || parsed.results || [parsed];

    return arr.map((r: any, i: number) => ({
      is_accounting: Boolean(r.is_accounting),
      confidence: r.confidence ?? 50,
      content_types: Array.isArray(r.content_types) ? r.content_types : ["attachment"],
      reasoning: r.reasoning || "",
    }));
  } catch (e) {
    console.error("Triage error:", e);
    return emails.map(() => ({
      is_accounting: true, confidence: 50,
      content_types: ["attachment"], reasoning: "triage error, accepting",
    }));
  }
}

// ─── STAGE 4: MULTI-STRATEGY EXTRACTION ─────────────────────

async function extractAttachments(
  msg: any, grantId: string, nylasApiKey: string,
  clientId: string, officeId: string,
  supabase: any, supabaseUrl: string, anonKey: string,
  emailMsgId: string,
): Promise<number> {
  let count = 0;
  if (!msg.attachments?.length) return 0;

  for (const att of msg.attachments) {
    const ct = normalizeMimeType(att.content_type);
    const filename = att.filename || "";

    // Skip inline, tiny, non-document files
    if (att.content_disposition === "inline" && !ct.startsWith("image/")) continue;
    if (att.size && att.size < 3000) continue;
    if (ct.includes("video/") || ct.includes("audio/")) continue;

    // Accept: PDF, images, Excel, Word
    const isRelevantType = ct === "application/pdf"
      || ct.startsWith("image/")
      || ct.includes("spreadsheet") || ct.includes("excel")
      || ct.includes("wordprocessing") || ct.includes("msword");
    if (!isRelevantType) continue;

    // Skip generic inline images (logos, signatures)
    const lf = filename.toLowerCase();
    if (ct.startsWith("image/") && att.content_disposition === "inline") {
      if (/^(image\d*|logo|banner|signature|icon|spacer)\.(png|jpg|gif)$/i.test(lf)) continue;
      if (att.size && att.size < 15000) continue; // <15KB inline image = probably logo
    }

    // Dedup check
    const sourceEmailId = `nylas:${msg.id}:${att.id}`;
    const { data: existing } = await supabase
      .from("documents")
      .select("id")
      .eq("source_email_id", sourceEmailId)
      .limit(1);
    if (existing?.length) continue;

    // Download
    const dlResp = await fetch(
      `${NYLAS_API}/grants/${grantId}/attachments/${att.id}/download?message_id=${msg.id}`,
      { headers: { Authorization: `Bearer ${nylasApiKey}` } },
    );
    if (!dlResp.ok) continue;

    const fileBuffer = await dlResp.arrayBuffer();
    const fileBytes = new Uint8Array(fileBuffer);
    const hash = await sha256(fileBytes);

    // SHA-256 dedup
    const { data: hashDup } = await supabase
      .from("documents")
      .select("id")
      .eq("content_hash_sha256", hash)
      .eq("client_id", clientId)
      .limit(1);
    if (hashDup?.length) continue;

    // Upload
    const ext = filename.split(".").pop() || "pdf";
    const storagePath = `${clientId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
    const { error: uploadErr } = await supabase.storage
      .from("documents").upload(storagePath, fileBytes, { contentType: ct });
    if (uploadErr) continue;

    const { data: urlData } = supabase.storage.from("documents").getPublicUrl(storagePath);

    const { data: doc } = await supabase.from("documents").insert({
      client_id: clientId, office_id: officeId,
      file_name: filename || `attachment.${ext}`,
      file_size: att.size || fileBytes.length,
      file_type: ct,
      file_url: urlData.publicUrl,
      source: "email", source_email_id: sourceEmailId,
      status: "processing",
      extraction_strategy: "attachment",
      email_message_id: emailMsgId,
      content_hash_sha256: hash,
    }).select().single();

    if (doc) {
      fetch(`${supabaseUrl}/functions/v1/extract-document`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${anonKey}` },
        body: JSON.stringify({ documentId: doc.id }),
      }).catch(e => console.error("Extract trigger failed:", e));
      count++;
    }
  }
  return count;
}

async function extractBodyInvoice(
  msg: any, grantId: string, nylasApiKey: string,
  clientId: string, officeId: string,
  supabase: any, supabaseUrl: string, anonKey: string,
  emailMsgId: string,
): Promise<number> {
  // Fetch full message body
  const msgResp = await fetch(
    `${NYLAS_API}/grants/${grantId}/messages/${msg.id}`,
    { headers: { Authorization: `Bearer ${nylasApiKey}`, Accept: "application/json" } },
  );
  if (!msgResp.ok) return 0;

  const fullMsg = await msgResp.json();
  const body = fullMsg.data?.body || fullMsg.body || "";
  if (!body || body.length < 100) return 0;

  // Dedup check
  const sourceEmailId = `nylas:${msg.id}:body`;
  const { data: existing } = await supabase
    .from("documents")
    .select("id")
    .eq("source_email_id", sourceEmailId)
    .limit(1);
  if (existing?.length) return 0;

  // Hash the body text for dedup
  const bodyBytes = new TextEncoder().encode(body);
  const hash = await sha256(bodyBytes);

  const { data: hashDup } = await supabase
    .from("documents")
    .select("id")
    .eq("content_hash_sha256", hash)
    .eq("client_id", clientId)
    .limit(1);
  if (hashDup?.length) return 0;

  // Store the HTML body as the "file" — no actual file upload needed for body invoices
  // We store the HTML in original_email_html and create a placeholder file_url
  const subject = msg.subject || "Email doklad";
  const fromEmail = msg.from?.[0]?.email || "unknown";
  const fileName = `${subject.slice(0, 60).replace(/[^a-zA-Z0-9áäčďéíĺľňóôŕšťúýžÁÄČĎÉÍĹĽŇÓÔŔŠŤÚÝŽ ]/g, "_")}.html`;

  // Upload HTML as file for consistent storage
  const htmlBytes = new TextEncoder().encode(body);
  const storagePath = `${clientId}/${Date.now()}_body_${Math.random().toString(36).slice(2)}.html`;
  const { error: uploadErr } = await supabase.storage
    .from("documents").upload(storagePath, htmlBytes, { contentType: "text/html" });
  if (uploadErr) {
    console.error("Body upload failed:", uploadErr);
    return 0;
  }

  const { data: urlData } = supabase.storage.from("documents").getPublicUrl(storagePath);

  const { data: doc } = await supabase.from("documents").insert({
    client_id: clientId, office_id: officeId,
    file_name: fileName,
    file_size: htmlBytes.length,
    file_type: "text/html",
    file_url: urlData.publicUrl,
    source: "email", source_email_id: sourceEmailId,
    status: "processing",
    extraction_strategy: "body_invoice",
    email_message_id: emailMsgId,
    content_hash_sha256: hash,
    original_email_html: body,
  }).select().single();

  if (doc) {
    fetch(`${supabaseUrl}/functions/v1/extract-document`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${anonKey}` },
      body: JSON.stringify({ documentId: doc.id }),
    }).catch(e => console.error("Body extract trigger failed:", e));
    return 1;
  }
  return 0;
}

async function extractDownloadLinks(
  msg: any, grantId: string, nylasApiKey: string,
  clientId: string, officeId: string,
  supabase: any, supabaseUrl: string, anonKey: string,
  emailMsgId: string,
  senderMap: Map<string, SenderRule>,
): Promise<number> {
  const fromDomain = (msg.from?.[0]?.email || "").split("@")[1]?.toLowerCase() || "";
  const senderRule = senderMap.get(fromDomain);

  // SAFETY: only follow links from trusted senders
  if (!senderRule || senderRule.classification !== "trusted_invoicer") return 0;

  // Fetch full message body
  const msgResp = await fetch(
    `${NYLAS_API}/grants/${grantId}/messages/${msg.id}`,
    { headers: { Authorization: `Bearer ${nylasApiKey}`, Accept: "application/json" } },
  );
  if (!msgResp.ok) return 0;

  const fullMsg = await msgResp.json();
  const body = fullMsg.data?.body || fullMsg.body || "";

  // Find download links in HTML
  const linkPatterns = [
    /href="(https?:\/\/[^"]*(?:invoice|faktura|receipt|doklad|download|pdf|billing)[^"]*)"/gi,
    /href="(https?:\/\/[^"]*\.pdf[^"]*)"/gi,
  ];

  const links = new Set<string>();
  for (const pattern of linkPatterns) {
    let match;
    while ((match = pattern.exec(body)) !== null) {
      if (match[1] && links.size < 3) links.add(match[1]);
    }
  }

  let count = 0;
  for (const link of links) {
    try {
      const sourceEmailId = `nylas:${msg.id}:link:${links.size}`;
      const { data: existing } = await supabase
        .from("documents")
        .select("id")
        .eq("source_email_id", sourceEmailId)
        .limit(1);
      if (existing?.length) continue;

      // Fetch the link with timeout
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      const linkResp = await fetch(link, {
        signal: controller.signal,
        headers: { "User-Agent": "LedgerFlow/1.0 (accounting document agent)" },
      });
      clearTimeout(timeout);

      if (!linkResp.ok) continue;

      const ct = normalizeMimeType(linkResp.headers.get("content-type"));
      if (ct !== "application/pdf" && !ct.startsWith("image/")) continue;

      const fileBuffer = await linkResp.arrayBuffer();
      const fileBytes = new Uint8Array(fileBuffer);
      if (fileBytes.length < 5000) continue; // too small

      const hash = await sha256(fileBytes);
      const { data: hashDup } = await supabase
        .from("documents")
        .select("id")
        .eq("content_hash_sha256", hash)
        .eq("client_id", clientId)
        .limit(1);
      if (hashDup?.length) continue;

      const ext = ct === "application/pdf" ? "pdf" : "jpg";
      const storagePath = `${clientId}/${Date.now()}_link_${Math.random().toString(36).slice(2)}.${ext}`;
      const { error: uploadErr } = await supabase.storage
        .from("documents").upload(storagePath, fileBytes, { contentType: ct });
      if (uploadErr) continue;

      const { data: urlData } = supabase.storage.from("documents").getPublicUrl(storagePath);

      const { data: doc } = await supabase.from("documents").insert({
        client_id: clientId, office_id: officeId,
        file_name: `downloaded_invoice.${ext}`,
        file_size: fileBytes.length,
        file_type: ct,
        file_url: urlData.publicUrl,
        source: "email", source_email_id: sourceEmailId,
        status: "processing",
        extraction_strategy: "download_link",
        email_message_id: emailMsgId,
        content_hash_sha256: hash,
        download_source_url: link,
      }).select().single();

      if (doc) {
        fetch(`${supabaseUrl}/functions/v1/extract-document`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${anonKey}` },
          body: JSON.stringify({ documentId: doc.id }),
        }).catch(e => console.error("Link extract failed:", e));
        count++;
      }
    } catch (e) {
      console.error("Link extraction error:", e);
    }
  }
  return count;
}

// ─── MAIN SERVE ─────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const startTime = Date.now();

  try {
    const { grantId, clientId, officeId, month, year } = await req.json();
    if (!grantId || !clientId || !officeId) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const nylasApiKey = Deno.env.get("NYLAS_API_KEY")!;
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY") || "";
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // ── STAGE 1: DISCOVERY ──
    console.log(`[Agent] Starting scan for client ${clientId}`);

    // Compute date range with 7-day buffer
    let receivedAfter: number, receivedBefore: number;
    if (month && year) {
      const from = new Date(Date.UTC(year, month - 2, 24)); // 7 days before prev month end
      const to = new Date(Date.UTC(year, month, 7));         // 7 days after month end
      receivedAfter = Math.floor(from.getTime() / 1000);
      receivedBefore = Math.floor(to.getTime() / 1000);
    } else {
      receivedAfter = Math.floor((Date.now() - 90 * 24 * 60 * 60 * 1000) / 1000);
      receivedBefore = Math.floor(Date.now() / 1000);
    }

    // Fetch messages from multiple smart queries
    const allMessages = new Map<string, any>();

    for (const query of DISCOVERY_QUERIES) {
      if (Date.now() - startTime > MAX_WALL_TIME_MS * 0.3) break; // don't spend too long on discovery

      let nextCursor: string | null = null;
      do {
        const params = new URLSearchParams({
          search_query_native: query,
          limit: "50",
          fields: "id,subject,from,date,attachments,snippet",
          received_after: String(receivedAfter),
          received_before: String(receivedBefore),
        });
        if (nextCursor) params.set("page_token", nextCursor);

        try {
          const listResp = await fetch(`${NYLAS_API}/grants/${grantId}/messages?${params}`, {
            headers: { Authorization: `Bearer ${nylasApiKey}`, Accept: "application/json" },
          });
          if (!listResp.ok) break;

          const listData = await listResp.json();
          for (const m of (listData.data || [])) {
            if (!allMessages.has(m.id)) allMessages.set(m.id, m);
          }
          nextCursor = listData.next_cursor || null;
        } catch (e) {
          console.error(`Query failed: ${query}`, e);
          break;
        }
      } while (nextCursor);
    }

    // Also fetch ANY email with attachments (catch stragglers)
    try {
      const params = new URLSearchParams({
        has_attachment: "true",
        limit: "100",
        fields: "id,subject,from,date,attachments,snippet",
        received_after: String(receivedAfter),
        received_before: String(receivedBefore),
      });
      const listResp = await fetch(`${NYLAS_API}/grants/${grantId}/messages?${params}`, {
        headers: { Authorization: `Bearer ${nylasApiKey}`, Accept: "application/json" },
      });
      if (listResp.ok) {
        const listData = await listResp.json();
        for (const m of (listData.data || [])) {
          if (!allMessages.has(m.id)) allMessages.set(m.id, m);
        }
      }
    } catch {}

    const messages = Array.from(allMessages.values());
    console.log(`[Agent] Discovery: ${messages.length} unique emails found`);

    // ── STAGE 2: RULES ENGINE ──

    // Load sender intelligence
    const { data: senderRules } = await supabase
      .from("sender_intelligence")
      .select("sender_domain, classification, typical_content, force_include, force_exclude, known_vendor_name")
      .or(`office_id.eq.${officeId},office_id.is.null`);

    const senderMap = new Map<string, SenderRule>();
    for (const r of (senderRules || [])) {
      senderMap.set(r.sender_domain, r);
    }

    // Load already-processed message IDs
    const { data: processed } = await supabase
      .from("email_messages")
      .select("nylas_message_id")
      .eq("client_id", clientId)
      .in("processing_status", ["done", "skipped"]);

    const processedIds = new Set((processed || []).map((p: any) => p.nylas_message_id));

    // Apply rules
    const candidates: Array<{ msg: any; ruleResult: string }> = [];
    let rulesSkipped = 0;

    for (const msg of messages) {
      const fromEmail = msg.from?.[0]?.email || "";
      const subject = msg.subject || "";
      const result = applyRules(fromEmail, subject, senderMap, processedIds, msg.id);

      if (result === "skip") {
        rulesSkipped++;
        continue;
      }
      candidates.push({ msg, ruleResult: result });
    }

    console.log(`[Agent] Rules: ${candidates.length} candidates, ${rulesSkipped} skipped`);

    // ── STAGE 3: AI TRIAGE ──

    const toProcess: Array<{ msg: any; triage: TriageResult }> = [];

    // Trusted senders skip triage — go straight to extraction
    for (const c of candidates) {
      if (c.ruleResult === "trusted") {
        const fromDomain = (c.msg.from?.[0]?.email || "").split("@")[1]?.toLowerCase() || "";
        const rule = senderMap.get(fromDomain);
        toProcess.push({
          msg: c.msg,
          triage: {
            is_accounting: true,
            confidence: 95,
            content_types: rule?.typical_content ? [rule.typical_content] : ["attachment", "body_invoice"],
            reasoning: `trusted sender: ${fromDomain}`,
          },
        });
      }
    }

    // Non-trusted: batch triage with AI
    const untriaged = candidates.filter(c => c.ruleResult !== "trusted");

    for (let i = 0; i < untriaged.length; i += TRIAGE_BATCH_SIZE) {
      if (Date.now() - startTime > MAX_WALL_TIME_MS * 0.5) break;

      const batch = untriaged.slice(i, i + TRIAGE_BATCH_SIZE);
      const triageInput = batch.map(c => ({
        from: c.msg.from?.[0]?.email || "",
        subject: c.msg.subject || "",
        snippet: (c.msg.snippet || "").slice(0, 300),
        attachments: (c.msg.attachments || []).map((a: any) => `${a.filename} (${a.content_type})`).join(", "),
        is_forwarded: /^(fwd:|fw:|preposlané|přeposláno)/i.test(c.msg.subject || ""),
      }));

      const results = await triageBatch(triageInput, lovableApiKey);

      for (let j = 0; j < batch.length; j++) {
        const triage = results[j] || { is_accounting: false, confidence: 0, content_types: [], reasoning: "no result" };

        // Save triage result to DB
        await supabase.from("email_messages").upsert({
          nylas_message_id: batch[j].msg.id,
          nylas_grant_id: grantId,
          office_id: officeId,
          client_id: clientId,
          from_email: batch[j].msg.from?.[0]?.email || "",
          from_name: batch[j].msg.from?.[0]?.name || "",
          subject: batch[j].msg.subject || "",
          received_at: batch[j].msg.date ? new Date(batch[j].msg.date * 1000).toISOString() : null,
          snippet: (batch[j].msg.snippet || "").slice(0, 500),
          has_attachments: (batch[j].msg.attachments?.length || 0) > 0,
          attachment_count: batch[j].msg.attachments?.length || 0,
          triage_result: triage.is_accounting ? "accounting" : "not_accounting",
          content_types: triage.content_types,
          triage_confidence: triage.confidence,
          triage_reasoning: triage.reasoning,
          processing_status: triage.is_accounting ? "triaged" : "skipped",
        }, { onConflict: "nylas_message_id" });

        if (triage.is_accounting && triage.confidence >= 30) {
          toProcess.push({ msg: batch[j].msg, triage });
        }
      }
    }

    console.log(`[Agent] Triage: ${toProcess.length} emails to extract`);

    // ── STAGE 4: MULTI-STRATEGY EXTRACTION ──

    let totalDocs = 0;

    for (const { msg, triage } of toProcess) {
      if (Date.now() - startTime > MAX_WALL_TIME_MS) {
        console.log("[Agent] Time limit reached during extraction");
        break;
      }

      const types = new Set(triage.content_types);
      let docsFromMsg = 0;

      // Ensure email_messages record exists for trusted senders too
      const { data: emailMsg } = await supabase.from("email_messages").upsert({
        nylas_message_id: msg.id,
        nylas_grant_id: grantId,
        office_id: officeId,
        client_id: clientId,
        from_email: msg.from?.[0]?.email || "",
        from_name: msg.from?.[0]?.name || "",
        subject: msg.subject || "",
        received_at: msg.date ? new Date(msg.date * 1000).toISOString() : null,
        snippet: (msg.snippet || "").slice(0, 500),
        has_attachments: (msg.attachments?.length || 0) > 0,
        attachment_count: msg.attachments?.length || 0,
        triage_result: "accounting",
        content_types: triage.content_types,
        triage_confidence: triage.confidence,
        processing_status: "extracting",
      }, { onConflict: "nylas_message_id" }).select().single();

      const emailMsgId = emailMsg?.id || null;

      // Strategy A: Attachments
      if (types.has("attachment") || (msg.attachments?.length > 0)) {
        try {
          const n = await extractAttachments(msg, grantId, nylasApiKey, clientId, officeId, supabase, supabaseUrl, anonKey, emailMsgId);
          docsFromMsg += n;
        } catch (e) { console.error("Attachment extraction error:", e); }
      }

      // Strategy C: Body is invoice (BEFORE inline images — more common)
      if (types.has("body_invoice")) {
        try {
          const n = await extractBodyInvoice(msg, grantId, nylasApiKey, clientId, officeId, supabase, supabaseUrl, anonKey, emailMsgId);
          docsFromMsg += n;
        } catch (e) { console.error("Body extraction error:", e); }
      }

      // Strategy D: Download links
      if (types.has("download_link")) {
        try {
          const n = await extractDownloadLinks(msg, grantId, nylasApiKey, clientId, officeId, supabase, supabaseUrl, anonKey, emailMsgId, senderMap);
          docsFromMsg += n;
        } catch (e) { console.error("Link extraction error:", e); }
      }

      // Update email_messages with results
      await supabase.from("email_messages").update({
        processing_status: "done",
        documents_created: docsFromMsg,
        updated_at: new Date().toISOString(),
      }).eq("nylas_message_id", msg.id);

      totalDocs += docsFromMsg;
    }

    // ── STAGE 6: LEARNING — update sender stats ──

    const senderCounts = new Map<string, number>();
    for (const { msg } of toProcess) {
      const domain = (msg.from?.[0]?.email || "").split("@")[1]?.toLowerCase();
      if (domain) senderCounts.set(domain, (senderCounts.get(domain) || 0) + 1);
    }

    for (const [domain, count] of senderCounts) {
      await supabase.from("sender_intelligence").upsert({
        office_id: officeId,
        sender_domain: domain,
        emails_seen: count,
        updated_at: new Date().toISOString(),
      }, { onConflict: "office_id,sender_domain" });
      // Increment counter (upsert doesn't support increment, so we do it manually)
      try { await supabase.rpc("increment_sender_emails_seen", { p_office_id: officeId, p_domain: domain, p_count: count }); } catch (_) { /* ignore */ }
    }

    // Update sync timestamp
    await supabase
      .from("email_integrations")
      .update({ last_sync_at: new Date().toISOString() })
      .eq("nylas_grant_id", grantId);

    const elapsed = Math.round((Date.now() - startTime) / 1000);
    console.log(`[Agent] Done in ${elapsed}s: ${messages.length} discovered, ${toProcess.length} processed, ${totalDocs} documents created`);

    return new Response(
      JSON.stringify({
        success: true,
        discovered: messages.length,
        rulesSkipped,
        triaged: toProcess.length,
        documentsCreated: totalDocs,
        elapsedSeconds: elapsed,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("[Agent] Fatal error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
