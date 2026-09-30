-- Schema de base para o Supabase. Em bases existentes, aplique a migration
-- supabase/migrations/20260930_persist_imported_transaction_edits.sql.

CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  description TEXT NOT NULL,
  amount INTEGER NOT NULL,
  category TEXT NOT NULL,
  category_override TEXT,
  import_record_id TEXT,
  group_name TEXT,
  subcategory TEXT,
  status TEXT NOT NULL,
  payment_method TEXT,
  date TEXT NOT NULL,
  month INTEGER NOT NULL,
  year INTEGER NOT NULL,
  installments INTEGER DEFAULT 1,
  installment_month INTEGER,
  titular TEXT DEFAULT 'salomao',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS transactions_import_record_id_idx
  ON transactions (import_record_id)
  WHERE import_record_id IS NOT NULL;

-- Habilitar Row Level Security (permite tudo por enquanto)
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all" ON transactions FOR ALL USING (true) WITH CHECK (true);

-- Habilitar Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE transactions;
