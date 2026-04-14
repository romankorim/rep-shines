ALTER TABLE public.documents
ADD COLUMN IF NOT EXISTS content_hash_sha256 text,
ADD COLUMN IF NOT EXISTS download_source_url text;

CREATE INDEX IF NOT EXISTS idx_documents_client_content_hash_sha256
ON public.documents (client_id, content_hash_sha256);

CREATE INDEX IF NOT EXISTS idx_documents_source_email_id
ON public.documents (source_email_id);