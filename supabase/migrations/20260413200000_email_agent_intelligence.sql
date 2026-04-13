-- ============================================================
-- EMAIL AGENT INTELLIGENCE: Smart email scanning & learning
-- ============================================================

-- 1. Track every email the agent has seen (dedup + learning)
CREATE TABLE IF NOT EXISTS email_messages (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id           uuid REFERENCES accountant_offices(id) ON DELETE CASCADE,
  client_id           uuid REFERENCES clients(id) ON DELETE CASCADE,
  nylas_message_id    text NOT NULL,
  nylas_grant_id      text,
  from_email          text,
  from_name           text,
  subject             text,
  received_at         timestamptz,
  snippet             text,
  has_attachments     boolean DEFAULT false,
  attachment_count    int DEFAULT 0,

  -- AI triage results
  triage_result       text DEFAULT 'pending',  -- 'accounting' | 'not_accounting' | 'uncertain' | 'pending'
  content_types       text[] DEFAULT '{}',     -- {'attachment','inline_image','body_invoice','download_link','forwarded'}
  triage_confidence   real,
  triage_reasoning    text,

  -- Processing state
  processing_status   text DEFAULT 'pending',  -- 'pending','triaged','extracting','done','skipped','error'
  documents_created   int DEFAULT 0,
  error_message       text,

  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now(),

  UNIQUE(nylas_message_id)
);

CREATE INDEX idx_email_messages_client ON email_messages(client_id);
CREATE INDEX idx_email_messages_status ON email_messages(processing_status);
CREATE INDEX idx_email_messages_from ON email_messages(from_email);

-- 2. Agent memory: learns which senders send invoices
CREATE TABLE IF NOT EXISTS sender_intelligence (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id           uuid REFERENCES accountant_offices(id) ON DELETE CASCADE,
  sender_domain       text NOT NULL,
  sender_email        text,

  -- Classification
  classification      text DEFAULT 'unknown',  -- 'trusted_invoicer','newsletter','spam','personal','unknown'
  typical_content     text,                     -- 'attachment','body_invoice','download_link','mixed'
  typical_doc_type    text,                     -- 'received_invoice','receipt', etc.

  -- Known vendor info (speeds up extraction)
  known_vendor_name   text,
  known_vendor_ico    text,
  known_vendor_dic    text,

  -- Stats from feedback loop
  emails_seen         int DEFAULT 0,
  docs_extracted      int DEFAULT 0,
  docs_approved       int DEFAULT 0,
  docs_rejected       int DEFAULT 0,

  -- Manual overrides by accountant
  force_include       boolean DEFAULT false,
  force_exclude       boolean DEFAULT false,

  -- For download-link strategy
  invoice_link_pattern text,  -- keyword pattern to find download links

  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now(),

  UNIQUE(office_id, sender_domain)
);

CREATE INDEX idx_sender_intel_domain ON sender_intelligence(sender_domain);
CREATE INDEX idx_sender_intel_class ON sender_intelligence(classification);

-- 3. Add new columns to documents table
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='documents' AND column_name='extraction_strategy') THEN
    ALTER TABLE documents ADD COLUMN extraction_strategy text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='documents' AND column_name='email_message_id') THEN
    ALTER TABLE documents ADD COLUMN email_message_id uuid REFERENCES email_messages(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='documents' AND column_name='content_hash_sha256') THEN
    ALTER TABLE documents ADD COLUMN content_hash_sha256 text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='documents' AND column_name='original_email_html') THEN
    ALTER TABLE documents ADD COLUMN original_email_html text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='documents' AND column_name='download_source_url') THEN
    ALTER TABLE documents ADD COLUMN download_source_url text;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_documents_hash ON documents(content_hash_sha256);
CREATE INDEX IF NOT EXISTS idx_documents_email_msg ON documents(email_message_id);

-- 4. Pre-seed known SaaS invoice senders (global, office_id NULL)
INSERT INTO sender_intelligence (office_id, sender_domain, classification, typical_content, known_vendor_name)
VALUES
  -- Ride-sharing / delivery (body invoices)
  (NULL, 'uber.com', 'trusted_invoicer', 'body_invoice', 'Uber'),
  (NULL, 'bolt.eu', 'trusted_invoicer', 'body_invoice', 'Bolt'),
  (NULL, 'wolt.com', 'trusted_invoicer', 'body_invoice', 'Wolt'),
  (NULL, 'foodora.com', 'trusted_invoicer', 'body_invoice', 'Foodora'),
  -- Travel / accommodation
  (NULL, 'booking.com', 'trusted_invoicer', 'body_invoice', 'Booking.com'),
  (NULL, 'airbnb.com', 'trusted_invoicer', 'body_invoice', 'Airbnb'),
  (NULL, 'ryanair.com', 'trusted_invoicer', 'attachment', 'Ryanair'),
  (NULL, 'wizzair.com', 'trusted_invoicer', 'attachment', 'Wizz Air'),
  -- Tech / SaaS
  (NULL, 'apple.com', 'trusted_invoicer', 'body_invoice', 'Apple'),
  (NULL, 'google.com', 'trusted_invoicer', 'body_invoice', 'Google'),
  (NULL, 'microsoft.com', 'trusted_invoicer', 'body_invoice', 'Microsoft'),
  (NULL, 'amazon.com', 'trusted_invoicer', 'body_invoice', 'Amazon'),
  (NULL, 'aws.amazon.com', 'trusted_invoicer', 'attachment', 'Amazon Web Services'),
  (NULL, 'stripe.com', 'trusted_invoicer', 'body_invoice', 'Stripe'),
  (NULL, 'github.com', 'trusted_invoicer', 'body_invoice', 'GitHub'),
  (NULL, 'openai.com', 'trusted_invoicer', 'body_invoice', 'OpenAI'),
  (NULL, 'anthropic.com', 'trusted_invoicer', 'body_invoice', 'Anthropic'),
  (NULL, 'vercel.com', 'trusted_invoicer', 'body_invoice', 'Vercel'),
  (NULL, 'netlify.com', 'trusted_invoicer', 'body_invoice', 'Netlify'),
  (NULL, 'digitalocean.com', 'trusted_invoicer', 'body_invoice', 'DigitalOcean'),
  (NULL, 'heroku.com', 'trusted_invoicer', 'body_invoice', 'Heroku'),
  (NULL, 'slack.com', 'trusted_invoicer', 'body_invoice', 'Slack'),
  (NULL, 'zoom.us', 'trusted_invoicer', 'body_invoice', 'Zoom'),
  (NULL, 'adobe.com', 'trusted_invoicer', 'download_link', 'Adobe'),
  (NULL, 'figma.com', 'trusted_invoicer', 'body_invoice', 'Figma'),
  (NULL, 'notion.so', 'trusted_invoicer', 'body_invoice', 'Notion'),
  (NULL, 'canva.com', 'trusted_invoicer', 'body_invoice', 'Canva'),
  -- SK/CZ telecom
  (NULL, 'orange.sk', 'trusted_invoicer', 'attachment', 'Orange Slovensko'),
  (NULL, 'telekom.sk', 'trusted_invoicer', 'attachment', 'Slovak Telekom'),
  (NULL, 'o2.sk', 'trusted_invoicer', 'download_link', 'O2 Slovakia'),
  (NULL, '4ka.sk', 'trusted_invoicer', 'attachment', '4ka'),
  (NULL, 'upc.sk', 'trusted_invoicer', 'attachment', 'UPC Slovensko'),
  (NULL, 't-mobile.cz', 'trusted_invoicer', 'attachment', 'T-Mobile CZ'),
  (NULL, 'o2.cz', 'trusted_invoicer', 'download_link', 'O2 Czech Republic'),
  (NULL, 'vodafone.cz', 'trusted_invoicer', 'attachment', 'Vodafone CZ'),
  -- Known newsletters / spam (block)
  (NULL, 'facebookmail.com', 'newsletter', NULL, NULL),
  (NULL, 'linkedin.com', 'newsletter', NULL, NULL),
  (NULL, 'twitter.com', 'newsletter', NULL, NULL),
  (NULL, 'instagram.com', 'newsletter', NULL, NULL),
  (NULL, 'tiktok.com', 'newsletter', NULL, NULL),
  (NULL, 'pinterest.com', 'newsletter', NULL, NULL),
  (NULL, 'youtube.com', 'newsletter', NULL, NULL),
  (NULL, 'mailchimp.com', 'newsletter', NULL, NULL),
  (NULL, 'sendinblue.com', 'newsletter', NULL, NULL)
ON CONFLICT DO NOTHING;

-- 5. RLS policies
ALTER TABLE email_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE sender_intelligence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view email_messages for their offices" ON email_messages
  FOR ALL USING (
    office_id IN (SELECT id FROM accountant_offices WHERE user_id = auth.uid())
    OR client_id IN (SELECT id FROM clients WHERE id = client_id)
  );

CREATE POLICY "Users can view sender_intelligence for their offices" ON sender_intelligence
  FOR ALL USING (
    office_id IS NULL  -- global seeds visible to all
    OR office_id IN (SELECT id FROM accountant_offices WHERE user_id = auth.uid())
  );
