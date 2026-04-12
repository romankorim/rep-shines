
-- Enums
CREATE TYPE public.app_role AS ENUM ('admin', 'rep');
CREATE TYPE public.quota_period AS ENUM ('month', 'quarter', 'year');
CREATE TYPE public.deal_status AS ENUM ('closed', 'open');

-- Profiles (auto-created on signup)
CREATE TABLE public.profiles (
  id UUID NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view all profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- User roles (separate table per security best practices)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Security definer function for role checks (avoids RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

-- Admins can view all roles
CREATE POLICY "Admins can view all roles" ON public.user_roles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Reps table
CREATE TABLE public.reps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  email TEXT,
  team TEXT NOT NULL DEFAULT 'General',
  quota_target NUMERIC NOT NULL DEFAULT 100000,
  quota_period quota_period NOT NULL DEFAULT 'quarter',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.reps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read reps" ON public.reps FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert reps" ON public.reps FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update reps" ON public.reps FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete reps" ON public.reps FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Comp plans
CREATE TABLE public.comp_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  effective_date DATE NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.comp_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read comp_plans" ON public.comp_plans FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert comp_plans" ON public.comp_plans FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update comp_plans" ON public.comp_plans FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Comp tiers
CREATE TABLE public.comp_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comp_plan_id UUID NOT NULL REFERENCES public.comp_plans(id) ON DELETE CASCADE,
  tier_name TEXT NOT NULL,
  min_deal_size NUMERIC NOT NULL DEFAULT 0,
  max_deal_size NUMERIC,
  commission_rate NUMERIC NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.comp_tiers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read comp_tiers" ON public.comp_tiers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert comp_tiers" ON public.comp_tiers FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update comp_tiers" ON public.comp_tiers FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete comp_tiers" ON public.comp_tiers FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Quota tiers
CREATE TABLE public.quota_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tier_name TEXT NOT NULL,
  min_attainment NUMERIC NOT NULL DEFAULT 0,
  max_attainment NUMERIC,
  rate_multiplier NUMERIC NOT NULL DEFAULT 1.0,
  color TEXT NOT NULL DEFAULT 'primary',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.quota_tiers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read quota_tiers" ON public.quota_tiers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert quota_tiers" ON public.quota_tiers FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update quota_tiers" ON public.quota_tiers FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Deals
CREATE TABLE public.deals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rep_id UUID NOT NULL REFERENCES public.reps(id) ON DELETE CASCADE,
  deal_size NUMERIC NOT NULL,
  close_date DATE NOT NULL,
  deal_type TEXT NOT NULL,
  commission_amount NUMERIC NOT NULL DEFAULT 0,
  tier_applied TEXT,
  status deal_status NOT NULL DEFAULT 'closed',
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);
ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read active deals" ON public.deals FOR SELECT TO authenticated USING (deleted_at IS NULL);
CREATE POLICY "Admins can insert deals" ON public.deals FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update deals" ON public.deals FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE INDEX idx_deals_rep_id ON public.deals(rep_id);
CREATE INDEX idx_deals_close_date ON public.deals(close_date);
CREATE INDEX idx_deals_status ON public.deals(status);

-- Audit log
CREATE TABLE public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name TEXT NOT NULL,
  record_id UUID NOT NULL,
  action TEXT NOT NULL,
  changes JSONB,
  user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can read audit_log" ON public.audit_log FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Authenticated can insert audit_log" ON public.audit_log FOR INSERT TO authenticated WITH CHECK (true);

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_reps_updated_at BEFORE UPDATE ON public.reps FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_comp_plans_updated_at BEFORE UPDATE ON public.comp_plans FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_deals_updated_at BEFORE UPDATE ON public.deals FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data ->> 'name', ''), NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Audit trigger for deals
CREATE OR REPLACE FUNCTION public.audit_deals_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_log (table_name, record_id, action, changes, user_id)
    VALUES ('deals', NEW.id, 'insert', to_jsonb(NEW), NEW.created_by);
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.audit_log (table_name, record_id, action, changes, user_id)
    VALUES ('deals', NEW.id, 'update', jsonb_build_object('old', to_jsonb(OLD), 'new', to_jsonb(NEW)), NEW.created_by);
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_log (table_name, record_id, action, changes, user_id)
    VALUES ('deals', OLD.id, 'delete', to_jsonb(OLD), OLD.created_by);
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER audit_deals
  AFTER INSERT OR UPDATE OR DELETE ON public.deals
  FOR EACH ROW EXECUTE FUNCTION public.audit_deals_changes();

-- Enable realtime for deals
ALTER PUBLICATION supabase_realtime ADD TABLE public.deals;
