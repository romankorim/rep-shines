-- Accountants can upload files for their clients
CREATE POLICY "Accountant can upload documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'documents'
  AND EXISTS (
    SELECT 1 FROM public.clients c
    JOIN public.accountant_offices ao ON ao.id = c.office_id
    WHERE ao.user_id = auth.uid()
    AND c.id::text = (storage.foldername(storage.objects.name))[1]
  )
);

-- Accountants can read files for their clients
CREATE POLICY "Accountant can read documents"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'documents'
  AND EXISTS (
    SELECT 1 FROM public.clients c
    JOIN public.accountant_offices ao ON ao.id = c.office_id
    WHERE ao.user_id = auth.uid()
    AND c.id::text = (storage.foldername(storage.objects.name))[1]
  )
);

-- Clients can upload files to their own folder
CREATE POLICY "Client can upload own documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'documents'
  AND EXISTS (
    SELECT 1 FROM public.clients c
    WHERE c.user_id = auth.uid()
    AND c.id::text = (storage.foldername(storage.objects.name))[1]
  )
);

-- Clients can read their own files
CREATE POLICY "Client can read own documents"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'documents'
  AND EXISTS (
    SELECT 1 FROM public.clients c
    WHERE c.user_id = auth.uid()
    AND c.id::text = (storage.foldername(storage.objects.name))[1]
  )
);

-- Accountants can delete documents for their clients
CREATE POLICY "Accountant can delete documents"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'documents'
  AND EXISTS (
    SELECT 1 FROM public.clients c
    JOIN public.accountant_offices ao ON ao.id = c.office_id
    WHERE ao.user_id = auth.uid()
    AND c.id::text = (storage.foldername(storage.objects.name))[1]
  )
);