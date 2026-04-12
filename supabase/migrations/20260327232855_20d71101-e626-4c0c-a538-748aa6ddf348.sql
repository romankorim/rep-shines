
-- 1. PROFILES: Restrict SELECT so users only see own profile, admins see all
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;

CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = id OR public.has_role(auth.uid(), 'admin'));

-- 2. REPS: Replace open SELECT with admin-sees-all, reps-see-non-sensitive
DROP POLICY IF EXISTS "Authenticated can read reps" ON public.reps;

CREATE POLICY "Admins can read all reps" ON public.reps
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Reps can read own record" ON public.reps
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- 3. DEALS: Restrict SELECT so reps see own deals, admins see all
DROP POLICY IF EXISTS "Authenticated can read active deals" ON public.deals;

CREATE POLICY "Admins can read all active deals" ON public.deals
  FOR SELECT TO authenticated
  USING (deleted_at IS NULL AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Reps can read own deals" ON public.deals
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM public.reps r
      WHERE r.id = deals.rep_id AND r.user_id = auth.uid()
    )
  );

-- 4. AUDIT_LOG: Remove direct user insert policy (inserts handled by security definer trigger)
DROP POLICY IF EXISTS "Authenticated can insert audit_log" ON public.audit_log;

-- 5. QUOTA_TIERS: Already has good policies, but verify read is auth-only (already is)

-- 6. COMP_PLANS / COMP_TIERS: Already properly restricted, no changes needed
