import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

// ── Reps ──────────────────────────────────────────────────────

export const getReps = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;

    const [{ data: reps, error: repsErr }, { data: deals, error: dealsErr }, { data: quotaTiers, error: qtErr }] = await Promise.all([
      supabase.from("reps").select("*").order("name"),
      supabase.from("deals").select("*").is("deleted_at", null),
      supabase.from("quota_tiers").select("*").order("min_attainment"),
    ]);

    if (repsErr) throw new Error(repsErr.message);
    if (dealsErr) throw new Error(dealsErr.message);
    if (qtErr) throw new Error(qtErr.message);

    return (reps ?? []).map((rep) => {
      const repDeals = (deals ?? []).filter((d) => d.rep_id === rep.id && d.status === "closed");
      const totalRevenue = repDeals.reduce((s, d) => s + Number(d.deal_size), 0);
      const totalCommission = repDeals.reduce((s, d) => s + Number(d.commission_amount), 0);
      const attainment = rep.quota_target > 0 ? (totalRevenue / Number(rep.quota_target)) * 100 : 0;
      const tiers = quotaTiers ?? [];
      const matching = tiers.filter((t) => attainment >= Number(t.min_attainment));
      const quotaTier = matching[matching.length - 1] ?? tiers[0];

      return {
        ...rep,
        totalRevenue,
        totalCommission,
        attainment,
        dealCount: repDeals.length,
        quotaTier: quotaTier ?? { id: "", tier_name: "Unknown", min_attainment: 0, max_attainment: null, rate_multiplier: 1, color: "primary", created_at: "" },
      };
    });
  });

export const getRep = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ repId: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const [{ data: rep, error: repErr }, { data: deals, error: dealsErr }, { data: quotaTiers, error: qtErr }] = await Promise.all([
      supabase.from("reps").select("*").eq("id", data.repId).single(),
      supabase.from("deals").select("*").eq("rep_id", data.repId).is("deleted_at", null).order("close_date", { ascending: false }),
      supabase.from("quota_tiers").select("*").order("min_attainment"),
    ]);

    if (repErr) throw new Error(repErr.message);
    if (dealsErr) throw new Error(dealsErr.message);
    if (qtErr) throw new Error(qtErr.message);

    const closedDeals = (deals ?? []).filter((d) => d.status === "closed");
    const totalRevenue = closedDeals.reduce((s, d) => s + Number(d.deal_size), 0);
    const totalCommission = closedDeals.reduce((s, d) => s + Number(d.commission_amount), 0);
    const attainment = rep.quota_target > 0 ? (totalRevenue / Number(rep.quota_target)) * 100 : 0;
    const tiers = quotaTiers ?? [];
    const matching = tiers.filter((t) => attainment >= Number(t.min_attainment));
    const quotaTier = matching[matching.length - 1] ?? tiers[0];

    return {
      rep,
      deals: deals ?? [],
      totalRevenue,
      totalCommission,
      attainment,
      quotaTier: quotaTier ?? { id: "", tier_name: "Unknown", min_attainment: 0, max_attainment: null, rate_multiplier: 1, color: "primary", created_at: "" },
      quotaTiers: tiers,
    };
  });

// ── Deals ──────────────────────────────────────────────────────

export const getDeals = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;

    const [{ data: deals, error: dealsErr }, { data: reps, error: repsErr }] = await Promise.all([
      supabase.from("deals").select("*").is("deleted_at", null).order("close_date", { ascending: false }),
      supabase.from("reps").select("id, name"),
    ]);

    if (dealsErr) throw new Error(dealsErr.message);
    if (repsErr) throw new Error(repsErr.message);

    return { deals: deals ?? [], reps: reps ?? [] };
  });

export const createDeal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      repId: z.string().uuid(),
      dealSize: z.number().positive().max(999999999),
      closeDate: z.string().min(1).max(20),
      dealType: z.string().min(1).max(100),
      notes: z.string().max(5000).optional(),
    })
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Fetch all needed data in parallel
    const [planRes, repRes, existingDealsRes, quotaTiersRes] = await Promise.all([
      supabase.from("comp_plans").select("id").eq("is_active", true).single(),
      supabase.from("reps").select("quota_target").eq("id", data.repId).single(),
      supabase.from("deals").select("deal_size").eq("rep_id", data.repId).eq("status", "closed").is("deleted_at", null),
      supabase.from("quota_tiers").select("*").order("min_attainment"),
    ]);

    let tierApplied = "Unknown";
    let commissionRate = 0;

    if (planRes.data) {
      const { data: tiers } = await supabase
        .from("comp_tiers")
        .select("*")
        .eq("comp_plan_id", planRes.data.id)
        .order("min_deal_size");

      const matchedTier = (tiers ?? []).find(
        (t) => data.dealSize >= Number(t.min_deal_size) && (t.max_deal_size === null || data.dealSize < Number(t.max_deal_size))
      );
      if (matchedTier) {
        tierApplied = matchedTier.tier_name;
        commissionRate = Number(matchedTier.commission_rate);
      }
    }

    const rep = repRes.data;
    const currentRevenue = (existingDealsRes.data ?? []).reduce((s, d) => s + Number(d.deal_size), 0);
    const attainment = rep && Number(rep.quota_target) > 0 ? ((currentRevenue + data.dealSize) / Number(rep.quota_target)) * 100 : 0;

    const matching = (quotaTiersRes.data ?? []).filter((t) => attainment >= Number(t.min_attainment));
    const quotaTier = matching[matching.length - 1];
    const multiplier = quotaTier ? Number(quotaTier.rate_multiplier) : 1;

    const commissionAmount = data.dealSize * (commissionRate / 100) * multiplier;

    const { data: newDeal, error } = await supabase
      .from("deals")
      .insert({
        rep_id: data.repId,
        deal_size: data.dealSize,
        close_date: data.closeDate,
        deal_type: data.dealType,
        commission_amount: commissionAmount,
        tier_applied: tierApplied,
        status: "closed",
        notes: data.notes,
        created_by: userId,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return newDeal;
  });

// ── Dashboard ──────────────────────────────────────────────────

export const getDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;

    const [{ data: reps }, { data: deals }, { data: quotaTiers }] = await Promise.all([
      supabase.from("reps").select("*").order("name"),
      supabase.from("deals").select("*").is("deleted_at", null),
      supabase.from("quota_tiers").select("*").order("min_attainment"),
    ]);

    const closedDeals = (deals ?? []).filter((d) => d.status === "closed");
    const totalCommissions = closedDeals.reduce((s, d) => s + Number(d.commission_amount), 0);
    const totalDeals = closedDeals.length;
    const avgDealSize = totalDeals > 0 ? closedDeals.reduce((s, d) => s + Number(d.deal_size), 0) / totalDeals : 0;

    const repData = (reps ?? []).map((rep) => {
      const repDeals = closedDeals.filter((d) => d.rep_id === rep.id);
      const totalRevenue = repDeals.reduce((s, d) => s + Number(d.deal_size), 0);
      const totalCommission = repDeals.reduce((s, d) => s + Number(d.commission_amount), 0);
      const attainment = Number(rep.quota_target) > 0 ? (totalRevenue / Number(rep.quota_target)) * 100 : 0;
      const tiers = quotaTiers ?? [];
      const matching = tiers.filter((t) => attainment >= Number(t.min_attainment));
      const quotaTier = matching[matching.length - 1] ?? tiers[0];
      return { ...rep, totalRevenue, totalCommission, attainment, dealCount: repDeals.length, quotaTier };
    });

    const tierCounts = (quotaTiers ?? []).map((tier) => ({
      ...tier,
      count: repData.filter((r) => r.quotaTier?.id === tier.id).length,
    }));

    return { totalCommissions, totalDeals, avgDealSize, reps: repData, tierCounts, quotaTiers: quotaTiers ?? [] };
  });

// ── Comp plans ──────────────────────────────────────────────────

export const getCompPlans = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;

    const [{ data: plans }, { data: tiers }, { data: quotaTiers }, { data: reps }] = await Promise.all([
      supabase.from("comp_plans").select("*").order("effective_date", { ascending: false }),
      supabase.from("comp_tiers").select("*").order("min_deal_size"),
      supabase.from("quota_tiers").select("*").order("min_attainment"),
      supabase.from("reps").select("*").order("name"),
    ]);

    const activePlan = (plans ?? []).find((p) => p.is_active);
    const activeTiers = activePlan ? (tiers ?? []).filter((t) => t.comp_plan_id === activePlan.id) : [];

    return {
      plans: plans ?? [],
      activePlan,
      activeTiers,
      quotaTiers: quotaTiers ?? [],
      reps: reps ?? [],
    };
  });

// ── Reps CRUD ──────────────────────────────────────────────────

export const createRep = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      name: z.string().min(1).max(200),
      email: z.string().email().optional(),
      team: z.string().min(1).max(200).optional(),
      quotaTarget: z.number().min(0).optional(),
      quotaPeriod: z.enum(["month", "quarter", "year"]).optional(),
    })
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const { data: newRep, error } = await supabase
      .from("reps")
      .insert({
        name: data.name,
        email: data.email ?? null,
        team: data.team ?? "General",
        quota_target: data.quotaTarget ?? 100000,
        quota_period: data.quotaPeriod ?? "quarter",
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return newRep;
  });

// ── Update Deal ──────────────────────────────────────────────────

export const updateDeal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      dealId: z.string().uuid(),
      dealSize: z.number().positive().max(999999999),
      closeDate: z.string().min(1).max(20),
      dealType: z.string().min(1).max(100),
      notes: z.string().max(5000).optional(),
      status: z.enum(["closed", "open"]),
    })
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    // Get existing deal to find rep_id
    const { data: existingDeal, error: existErr } = await supabase
      .from("deals")
      .select("rep_id")
      .eq("id", data.dealId)
      .single();
    if (existErr) throw new Error(existErr.message);

    // Fetch all needed data in parallel
    const [planRes, repRes, otherDealsRes, quotaTiersRes] = await Promise.all([
      supabase.from("comp_plans").select("id").eq("is_active", true).single(),
      supabase.from("reps").select("quota_target").eq("id", existingDeal.rep_id).single(),
      supabase.from("deals").select("deal_size").eq("rep_id", existingDeal.rep_id).eq("status", "closed").neq("id", data.dealId).is("deleted_at", null),
      supabase.from("quota_tiers").select("*").order("min_attainment"),
    ]);

    let tierApplied = "Unknown";
    let commissionRate = 0;

    if (planRes.data) {
      const { data: tiers } = await supabase
        .from("comp_tiers")
        .select("*")
        .eq("comp_plan_id", planRes.data.id)
        .order("min_deal_size");

      const matchedTier = (tiers ?? []).find(
        (t) => data.dealSize >= Number(t.min_deal_size) && (t.max_deal_size === null || data.dealSize < Number(t.max_deal_size))
      );
      if (matchedTier) {
        tierApplied = matchedTier.tier_name;
        commissionRate = Number(matchedTier.commission_rate);
      }
    }

    const rep = repRes.data;
    const otherRevenue = (otherDealsRes.data ?? []).reduce((s, d) => s + Number(d.deal_size), 0);
    const newRevenue = data.status === "closed" ? otherRevenue + data.dealSize : otherRevenue;
    const attainment = rep && Number(rep.quota_target) > 0 ? (newRevenue / Number(rep.quota_target)) * 100 : 0;

    const matching = (quotaTiersRes.data ?? []).filter((t) => attainment >= Number(t.min_attainment));
    const quotaTier = matching[matching.length - 1];
    const multiplier = quotaTier ? Number(quotaTier.rate_multiplier) : 1;

    const commissionAmount = data.dealSize * (commissionRate / 100) * multiplier;

    const { data: updated, error } = await supabase
      .from("deals")
      .update({
        deal_size: data.dealSize,
        close_date: data.closeDate,
        deal_type: data.dealType,
        notes: data.notes ?? null,
        status: data.status,
        commission_amount: commissionAmount,
        tier_applied: tierApplied,
      })
      .eq("id", data.dealId)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return updated;
  });

// ── Update Rep ──────────────────────────────────────────────────

export const updateRep = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      repId: z.string().uuid(),
      name: z.string().min(1).max(200),
      email: z.string().email().optional().or(z.literal("")),
      team: z.string().min(1).max(200),
      quotaTarget: z.number().min(0),
      quotaPeriod: z.enum(["month", "quarter", "year"]),
    })
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const { data: updated, error } = await supabase
      .from("reps")
      .update({
        name: data.name,
        email: data.email || null,
        team: data.team,
        quota_target: data.quotaTarget,
        quota_period: data.quotaPeriod,
      })
      .eq("id", data.repId)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return updated;
  });

// ── Auth helpers ──────────────────────────────────────────────────

export const getCurrentUser = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const [{ data: profile }, { data: roles }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).single(),
      supabase.from("user_roles").select("role").eq("user_id", userId),
    ]);

    return {
      userId,
      profile,
      roles: (roles ?? []).map((r) => r.role),
      isAdmin: (roles ?? []).some((r) => r.role === "admin"),
    };
  });
