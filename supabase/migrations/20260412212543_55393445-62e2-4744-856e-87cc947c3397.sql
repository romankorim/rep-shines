-- Add unique constraint for upsert on external_id
ALTER TABLE public.bank_transactions ADD CONSTRAINT bank_transactions_external_id_key UNIQUE (external_id);

-- Allow service role inserts (edge function uses service role, but add policy for accountant inserts too)
CREATE POLICY "Service and accountant can insert transactions"
ON public.bank_transactions
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM accountant_offices ao
    WHERE ao.id = bank_transactions.office_id AND ao.user_id = auth.uid()
  )
);

-- Allow accountant to update transactions (for matching)
CREATE POLICY "Accountant can update office transactions"
ON public.bank_transactions
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM accountant_offices ao
    WHERE ao.id = bank_transactions.office_id AND ao.user_id = auth.uid()
  )
);
