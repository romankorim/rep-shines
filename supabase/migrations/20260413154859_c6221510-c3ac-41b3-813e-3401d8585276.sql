ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'documents'
      AND policyname = 'Accountant can delete office documents'
  ) THEN
    CREATE POLICY "Accountant can delete office documents"
    ON public.documents
    FOR DELETE
    TO authenticated
    USING (
      EXISTS (
        SELECT 1
        FROM public.accountant_offices ao
        WHERE ao.id = documents.office_id
          AND ao.user_id = auth.uid()
      )
    );
  END IF;
END
$$;