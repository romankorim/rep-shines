
-- Fix audit_log insert policy to require user_id matches
DROP POLICY "Authenticated can insert audit_log" ON public.audit_log;
CREATE POLICY "Authenticated can insert audit_log" ON public.audit_log FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
