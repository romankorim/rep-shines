
-- 1. email_messages table
CREATE TABLE public.email_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nylas_message_id text NOT NULL,
  nylas_grant_id text,
  office_id uuid NOT NULL,
  client_id uuid NOT NULL,
  from_email text,
  from_name text,
  subject text,
  received_at timestamptz,
  snippet text,
  has_attachments boolean DEFAULT false,
  attachment_count integer DEFAULT 0,
  triage_result text,
  content_types text[],
  triage_confidence numeric,
  triage_reasoning text,
  processing_status text DEFAULT 'pending',
  documents_created integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (nylas_message_id)
);

ALTER TABLE public.email_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Accountant can read office email_messages" ON public.email_messages
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM accountant_offices ao WHERE ao.id = email_messages.office_id AND ao.user_id = auth.uid()));

CREATE POLICY "Accountant can manage office email_messages" ON public.email_messages
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM accountant_offices ao WHERE ao.id = email_messages.office_id AND ao.user_id = auth.uid()));

CREATE POLICY "Service role full access email_messages" ON public.email_messages
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- 2. sender_intelligence table
CREATE TABLE public.sender_intelligence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id uuid,
  sender_domain text NOT NULL,
  classification text,
  typical_content text,
  force_include boolean DEFAULT false,
  force_exclude boolean DEFAULT false,
  known_vendor_name text,
  emails_seen integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (office_id, sender_domain)
);

ALTER TABLE public.sender_intelligence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Accountant can read office sender_intelligence" ON public.sender_intelligence
  FOR SELECT TO authenticated
  USING (office_id IS NULL OR EXISTS (SELECT 1 FROM accountant_offices ao WHERE ao.id = sender_intelligence.office_id AND ao.user_id = auth.uid()));

CREATE POLICY "Accountant can manage office sender_intelligence" ON public.sender_intelligence
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM accountant_offices ao WHERE ao.id = sender_intelligence.office_id AND ao.user_id = auth.uid()));

CREATE POLICY "Service role full access sender_intelligence" ON public.sender_intelligence
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- 3. New columns on documents
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS extraction_strategy text;
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS original_email_html text;
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS email_message_id uuid;

-- 4. Indexes
CREATE INDEX IF NOT EXISTS idx_email_messages_client_id ON public.email_messages(client_id);
CREATE INDEX IF NOT EXISTS idx_email_messages_office_id ON public.email_messages(office_id);
CREATE INDEX IF NOT EXISTS idx_email_messages_processing_status ON public.email_messages(processing_status);
CREATE INDEX IF NOT EXISTS idx_sender_intelligence_domain ON public.sender_intelligence(sender_domain);
CREATE INDEX IF NOT EXISTS idx_documents_email_message_id ON public.documents(email_message_id);

-- 5. Pre-seed common SaaS senders (global, office_id = NULL)
INSERT INTO public.sender_intelligence (office_id, sender_domain, classification, typical_content, force_include, known_vendor_name) VALUES
  (NULL, 'uber.com', 'saas_vendor', 'receipt', true, 'Uber'),
  (NULL, 'bolt.eu', 'saas_vendor', 'receipt', true, 'Bolt'),
  (NULL, 'wolt.com', 'saas_vendor', 'receipt', true, 'Wolt'),
  (NULL, 'booking.com', 'saas_vendor', 'receipt', true, 'Booking.com'),
  (NULL, 'apple.com', 'saas_vendor', 'receipt', true, 'Apple'),
  (NULL, 'google.com', 'saas_vendor', 'invoice', true, 'Google'),
  (NULL, 'stripe.com', 'saas_vendor', 'invoice', true, 'Stripe'),
  (NULL, 'amazon.com', 'saas_vendor', 'invoice', true, 'Amazon'),
  (NULL, 'aws.amazon.com', 'saas_vendor', 'invoice', true, 'AWS'),
  (NULL, 'digitalocean.com', 'saas_vendor', 'invoice', true, 'DigitalOcean'),
  (NULL, 'hetzner.com', 'saas_vendor', 'invoice', true, 'Hetzner'),
  (NULL, 'github.com', 'saas_vendor', 'invoice', true, 'GitHub'),
  (NULL, 'atlassian.com', 'saas_vendor', 'invoice', true, 'Atlassian'),
  (NULL, 'slack.com', 'saas_vendor', 'invoice', true, 'Slack'),
  (NULL, 'zoom.us', 'saas_vendor', 'invoice', true, 'Zoom'),
  (NULL, 'microsoft.com', 'saas_vendor', 'invoice', true, 'Microsoft'),
  (NULL, 'adobe.com', 'saas_vendor', 'invoice', true, 'Adobe'),
  (NULL, 'notion.so', 'saas_vendor', 'invoice', true, 'Notion'),
  (NULL, 'figma.com', 'saas_vendor', 'invoice', true, 'Figma'),
  (NULL, 'vercel.com', 'saas_vendor', 'invoice', true, 'Vercel'),
  (NULL, 'netlify.com', 'saas_vendor', 'invoice', true, 'Netlify'),
  (NULL, 'heroku.com', 'saas_vendor', 'invoice', true, 'Heroku'),
  (NULL, 'twilio.com', 'saas_vendor', 'invoice', true, 'Twilio'),
  (NULL, 'sendgrid.com', 'saas_vendor', 'invoice', true, 'SendGrid'),
  (NULL, 'mailchimp.com', 'saas_vendor', 'invoice', true, 'Mailchimp'),
  (NULL, 'openai.com', 'saas_vendor', 'invoice', true, 'OpenAI'),
  (NULL, 'anthropic.com', 'saas_vendor', 'invoice', true, 'Anthropic'),
  (NULL, 'canva.com', 'saas_vendor', 'invoice', true, 'Canva'),
  (NULL, 'spotify.com', 'saas_vendor', 'receipt', true, 'Spotify'),
  (NULL, 'netflix.com', 'saas_vendor', 'receipt', true, 'Netflix'),
  (NULL, 'linkedin.com', 'saas_vendor', 'invoice', true, 'LinkedIn'),
  (NULL, 'dropbox.com', 'saas_vendor', 'invoice', true, 'Dropbox'),
  (NULL, 'intercom.io', 'saas_vendor', 'invoice', true, 'Intercom'),
  (NULL, 'hubspot.com', 'saas_vendor', 'invoice', true, 'HubSpot'),
  (NULL, 'freshworks.com', 'saas_vendor', 'invoice', true, 'Freshworks'),
  (NULL, 'monday.com', 'saas_vendor', 'invoice', true, 'Monday.com'),
  (NULL, 'asana.com', 'saas_vendor', 'invoice', true, 'Asana'),
  (NULL, 'miro.com', 'saas_vendor', 'invoice', true, 'Miro'),
  (NULL, 'loom.com', 'saas_vendor', 'invoice', true, 'Loom'),
  (NULL, 'calendly.com', 'saas_vendor', 'invoice', true, 'Calendly')
ON CONFLICT (office_id, sender_domain) DO NOTHING;

-- 6. Function for incrementing sender emails_seen
CREATE OR REPLACE FUNCTION public.increment_sender_emails_seen(p_office_id uuid, p_domain text, p_count integer)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.sender_intelligence
  SET emails_seen = emails_seen + p_count, updated_at = now()
  WHERE office_id = p_office_id AND sender_domain = p_domain;
$$;
