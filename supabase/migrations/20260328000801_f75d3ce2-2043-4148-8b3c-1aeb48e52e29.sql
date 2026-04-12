
-- Fix RLS: This is a template — all authenticated users should see all data

-- REPS: Replace admin-only + own-record SELECT with all-authenticated
DROP POLICY IF EXISTS "Admins can read all reps" ON public.reps;
DROP POLICY IF EXISTS "Reps can read own record" ON public.reps;

CREATE POLICY "Authenticated can read all reps" ON public.reps
  FOR SELECT TO authenticated
  USING (true);

-- DEALS: Replace admin-only + own-deals SELECT with all-authenticated
DROP POLICY IF EXISTS "Admins can read all active deals" ON public.deals;
DROP POLICY IF EXISTS "Reps can read own deals" ON public.deals;

CREATE POLICY "Authenticated can read all active deals" ON public.deals
  FOR SELECT TO authenticated
  USING (deleted_at IS NULL);

-- PROFILES: Allow all authenticated users to see profiles
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;

CREATE POLICY "Authenticated can read all profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (true);

-- Also assign admin role to existing users so write operations work
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::app_role FROM auth.users
ON CONFLICT (user_id, role) DO NOTHING;
