
-- Add 'client' value to existing app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'client';

-- Create new enums
CREATE TYPE public.client_status AS ENUM ('invited', 'active', 'paused', 'archived');
CREATE TYPE public.document_status AS ENUM ('processing', 'pending_approval', 'approved', 'rejected', 'duplicate', 'error');
CREATE TYPE public.document_source AS ENUM ('email', 'upload', 'bank');
CREATE TYPE public.document_type AS ENUM ('received_invoice', 'issued_invoice', 'receipt', 'credit_note', 'advance_invoice', 'bank_statement', 'other');
CREATE TYPE public.integration_status AS ENUM ('connected', 'disconnected', 'error');
CREATE TYPE public.invitation_status AS ENUM ('pending', 'accepted', 'expired');

-- Accountant offices
CREATE TABLE public.accountant_offices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  ico TEXT,
  dic TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.accountant_offices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own office" ON public.accountant_offices
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own office" ON public.accountant_offices
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own office" ON public.accountant_offices
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- Clients
CREATE TABLE public.clients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  office_id UUID NOT NULL REFERENCES public.accountant_offices(id) ON DELETE CASCADE,
  user_id UUID, -- linked after client accepts invitation
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  company_name TEXT,
  ico TEXT,
  dic TEXT,
  ic_dph TEXT,
  notes TEXT,
  status public.client_status NOT NULL DEFAULT 'invited',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

-- Accountant sees their office's clients
CREATE POLICY "Accountant can read office clients" ON public.clients
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.accountant_offices ao WHERE ao.id = office_id AND ao.user_id = auth.uid()));
CREATE POLICY "Accountant can insert office clients" ON public.clients
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.accountant_offices ao WHERE ao.id = office_id AND ao.user_id = auth.uid()));
CREATE POLICY "Accountant can update office clients" ON public.clients
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.accountant_offices ao WHERE ao.id = office_id AND ao.user_id = auth.uid()));
CREATE POLICY "Accountant can delete office clients" ON public.clients
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.accountant_offices ao WHERE ao.id = office_id AND ao.user_id = auth.uid()));
-- Client sees own record
CREATE POLICY "Client can read own record" ON public.clients
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Documents
CREATE TABLE public.documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  office_id UUID NOT NULL REFERENCES public.accountant_offices(id) ON DELETE CASCADE,
  -- File info
  file_url TEXT,
  file_name TEXT,
  file_size BIGINT,
  file_type TEXT,
  thumbnail_url TEXT,
  -- Source
  source public.document_source NOT NULL DEFAULT 'upload',
  source_email_id TEXT,
  -- Status
  status public.document_status NOT NULL DEFAULT 'processing',
  -- AI extracted data
  document_type public.document_type,
  supplier_name TEXT,
  supplier_ico TEXT,
  supplier_dic TEXT,
  supplier_ic_dph TEXT,
  document_number TEXT,
  variable_symbol TEXT,
  issue_date DATE,
  due_date DATE,
  delivery_date DATE,
  total_amount NUMERIC,
  currency TEXT DEFAULT 'EUR',
  tax_base NUMERIC,
  vat_amount NUMERIC,
  vat_rate NUMERIC,
  vat_breakdown JSONB, -- [{rate: 20, base: 100, vat: 20, total: 120}]
  tax_period_month INT,
  tax_period_year INT,
  -- Accounting
  expense_category TEXT,
  accounting_code TEXT,
  -- AI metadata
  ai_confidence NUMERIC, -- 0-100
  ai_raw_data JSONB,
  -- Bank matching
  matched_transaction_id UUID,
  -- Notes
  accountant_notes TEXT,
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Accountant can read office documents" ON public.documents
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.accountant_offices ao WHERE ao.id = office_id AND ao.user_id = auth.uid()));
CREATE POLICY "Accountant can insert office documents" ON public.documents
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.accountant_offices ao WHERE ao.id = office_id AND ao.user_id = auth.uid()));
CREATE POLICY "Accountant can update office documents" ON public.documents
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.accountant_offices ao WHERE ao.id = office_id AND ao.user_id = auth.uid()));
-- Client can read and upload own documents
CREATE POLICY "Client can read own documents" ON public.documents
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.clients c WHERE c.id = client_id AND c.user_id = auth.uid()));
CREATE POLICY "Client can upload own documents" ON public.documents
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.clients c WHERE c.id = client_id AND c.user_id = auth.uid()));

-- Bank transactions
CREATE TABLE public.bank_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  office_id UUID NOT NULL REFERENCES public.accountant_offices(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  currency TEXT DEFAULT 'EUR',
  transaction_date DATE NOT NULL,
  counterparty_name TEXT,
  variable_symbol TEXT,
  description TEXT,
  matched_document_id UUID REFERENCES public.documents(id),
  bank_name TEXT,
  external_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.bank_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Accountant can read office transactions" ON public.bank_transactions
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.accountant_offices ao WHERE ao.id = office_id AND ao.user_id = auth.uid()));
CREATE POLICY "Client can read own transactions" ON public.bank_transactions
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.clients c WHERE c.id = client_id AND c.user_id = auth.uid()));

-- Email integrations
CREATE TABLE public.email_integrations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  office_id UUID NOT NULL REFERENCES public.accountant_offices(id) ON DELETE CASCADE,
  provider TEXT, -- gmail, outlook, imap
  email_address TEXT,
  status public.integration_status NOT NULL DEFAULT 'disconnected',
  nylas_grant_id TEXT,
  last_sync_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.email_integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Accountant can read office email integrations" ON public.email_integrations
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.accountant_offices ao WHERE ao.id = office_id AND ao.user_id = auth.uid()));
CREATE POLICY "Accountant can manage office email integrations" ON public.email_integrations
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.accountant_offices ao WHERE ao.id = office_id AND ao.user_id = auth.uid()));
CREATE POLICY "Client can read own email integration" ON public.email_integrations
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.clients c WHERE c.id = client_id AND c.user_id = auth.uid()));
CREATE POLICY "Client can manage own email integration" ON public.email_integrations
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.clients c WHERE c.id = client_id AND c.user_id = auth.uid()));

-- Bank integrations
CREATE TABLE public.bank_integrations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  office_id UUID NOT NULL REFERENCES public.accountant_offices(id) ON DELETE CASCADE,
  provider TEXT DEFAULT 'salt_edge',
  bank_name TEXT,
  status public.integration_status NOT NULL DEFAULT 'disconnected',
  salt_edge_connection_id TEXT,
  consent_expires_at TIMESTAMPTZ,
  last_sync_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.bank_integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Accountant can read office bank integrations" ON public.bank_integrations
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.accountant_offices ao WHERE ao.id = office_id AND ao.user_id = auth.uid()));
CREATE POLICY "Accountant can manage office bank integrations" ON public.bank_integrations
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.accountant_offices ao WHERE ao.id = office_id AND ao.user_id = auth.uid()));
CREATE POLICY "Client can read own bank integration" ON public.bank_integrations
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.clients c WHERE c.id = client_id AND c.user_id = auth.uid()));
CREATE POLICY "Client can manage own bank integration" ON public.bank_integrations
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.clients c WHERE c.id = client_id AND c.user_id = auth.uid()));

-- Client invitations
CREATE TABLE public.client_invitations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  office_id UUID NOT NULL REFERENCES public.accountant_offices(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  status public.invitation_status NOT NULL DEFAULT 'pending',
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '30 days'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.client_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Accountant can read office invitations" ON public.client_invitations
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.accountant_offices ao WHERE ao.id = office_id AND ao.user_id = auth.uid()));
CREATE POLICY "Accountant can create office invitations" ON public.client_invitations
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.accountant_offices ao WHERE ao.id = office_id AND ao.user_id = auth.uid()));
-- Public read for invitation acceptance (by token, checked in app logic)
CREATE POLICY "Anyone can read invitation by token" ON public.client_invitations
  FOR SELECT TO anon
  USING (true);

-- Storage bucket for documents
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('documents', 'documents', false, 52428800); -- 50MB limit

-- Storage policies
CREATE POLICY "Authenticated users can upload documents" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'documents');
CREATE POLICY "Authenticated users can read own documents" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'documents');

-- Updated_at triggers
CREATE TRIGGER update_accountant_offices_updated_at BEFORE UPDATE ON public.accountant_offices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_clients_updated_at BEFORE UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_documents_updated_at BEFORE UPDATE ON public.documents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_email_integrations_updated_at BEFORE UPDATE ON public.email_integrations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_bank_integrations_updated_at BEFORE UPDATE ON public.bank_integrations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
