
-- Drop admin-only policies on deals
DROP POLICY IF EXISTS "Admins can insert deals" ON public.deals;
DROP POLICY IF EXISTS "Admins can update deals" ON public.deals;

-- Create open policies for authenticated users on deals
CREATE POLICY "Authenticated users can insert deals" ON public.deals
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update deals" ON public.deals
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- Drop admin-only policies on reps
DROP POLICY IF EXISTS "Admins can insert reps" ON public.reps;
DROP POLICY IF EXISTS "Admins can update reps" ON public.reps;
DROP POLICY IF EXISTS "Admins can delete reps" ON public.reps;

-- Create open policies for authenticated users on reps
CREATE POLICY "Authenticated users can insert reps" ON public.reps
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update reps" ON public.reps
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can delete reps" ON public.reps
  FOR DELETE TO authenticated USING (true);
