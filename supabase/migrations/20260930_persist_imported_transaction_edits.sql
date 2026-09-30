ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS category_override TEXT,
  ADD COLUMN IF NOT EXISTS import_record_id TEXT;

CREATE INDEX IF NOT EXISTS transactions_import_record_id_idx
  ON public.transactions (import_record_id)
  WHERE import_record_id IS NOT NULL;
